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
    const cats = await getCatList()
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

async function getCatList() {
    const { data, error } = await supabase.from('cats').select()
    if (error) throw error

    return data
        .sort((a, b) => a.order - b.order)
        .filter((record) => record.name)
        .map((record) => ({
            recordId: record.id,
            name: record.name,
            room: record.room,
            diet_note: record.diet_note,
        }))
}