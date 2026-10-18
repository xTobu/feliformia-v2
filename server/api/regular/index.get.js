import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import dayjs from 'dayjs'

// ⚠️ 這支是 GET，但沒有當天記錄時會順手 INSERT 一筆 ——
// 沒驗證的話任何人都能用任意 date/shift 灌出記錄，不只是讀而已。
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const query = getQuery(event)
    const { date, shift } = query

    // 先嘗試取得現有記錄
    const { data, error } = await supabase
        .from('regulars')
        .select()
        .eq('date', date)
        .eq('shift', shift)
        .order('createdTime', { ascending: true })
        .limit(1)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    // 如果有記錄，直接回傳
    if (data && data.length > 0) {
        return {
            ...data[0],
            recordId: data[0].id,
            cats: JSON.parse(data[0].cats),
        }
    }

    // 沒有記錄，建立新的
    const cats = await getCatList(date, shift)
    const catList = cats.map((cat) => ({
        cat: cat,
        name: cat.name,
        feed: true,
        feed_detail: 0,
        can: false,
        can_detail: 0,
        feces: false,
        feces_warning: null,
        urine: false,
    }))

    const { data: newData, error: createError } = await supabase
        .from('regulars')
        .insert([
            {
                date,
                shift,
                cats: JSON.stringify(catList),
                createdTime: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
            },
        ])
        .select()
        .limit(1)

    // 重複 key error，重新取得
    if (createError && createError.code === '23505') {
        const { data: existData } = await supabase
            .from('regulars')
            .select()
            .eq('date', date)
            .eq('shift', shift)
            .limit(1)

        return {
            ...existData[0],
            recordId: existData[0].id,
            cats: JSON.parse(existData[0].cats),
        }
    }

    if (createError) {
        throw createError({ statusCode: 500, message: createError.message })
    }

    return {
        ...newData[0],
        recordId: newData[0].id,
        cats: JSON.parse(newData[0].cats),
    }
})

// 飲食備註改由飲食與待辦（notices 的乾乾、罐罐）提供：這一班、在期間內的串起來。
// 還沒在飲食與待辦設定的貓，退回貓咪資料上的 diet_note，過渡期不會空白
async function getCatList(date, shift) {
    const [{ data, error }, meals] = await Promise.all([
        supabase.from('cats').select(),
        getMealNotes(date, shift),
    ])
    if (error) throw error

    return data
        .sort((a, b) => a.order - b.order)
        .filter((record) => record.name)
        .map((record) => ({
            recordId: record.id,
            name: record.name,
            room: record.room,
            diet_note: meals.get(record.id) || record.diet_note,
        }))
}

// 回傳 Map<cat_id, '乾乾內容；罐罐內容'>。category 欄位還沒加的資料庫會拿到空 Map
const FOOD_CATEGORIES = ['dry', 'wet']
async function getMealNotes(date, shift) {
    const { data, error } = await supabase
        .from('notices')
        .select()
        .or(`shift.eq.both,shift.eq.${shift}`)
        .order('order')
    if (error) throw error

    const meals = new Map()
    for (const notice of data) {
        if (!FOOD_CATEGORIES.includes(notice.category) || !notice.cat_id) continue
        if (notice.start_date && notice.start_date > date) continue
        if (notice.end_date && notice.end_date < date) continue
        const list = meals.get(notice.cat_id) || []
        list.push(notice.treatment)
        meals.set(notice.cat_id, list)
    }
    return new Map([...meals].map(([id, list]) => [id, list.join('；')]))
}
