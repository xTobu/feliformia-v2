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
        .from('medicines')
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
    const notices = await getNoticeList(shift, date)
    const catList = notices.map((notice) => ({
        ...notice,
        done: false,
    }))

    const { data: newData, error: insertError } = await supabase
        .from('medicines')
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
    if (insertError && insertError.code === '23505') {
        const { data: existData } = await supabase
            .from('medicines')
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

    if (insertError) {
        throw createError({ statusCode: 500, message: insertError.message })
    }

    return {
        ...newData[0],
        recordId: newData[0].id,
        cats: JSON.parse(newData[0].cats),
    }
})

// start_date / end_date 是期間，NULL 代表該端不限。
// 日期都是 'YYYY-MM-DD'，直接比字串就對了。
// 主食（category = 'meal'）歸飲食管理，不放進這份紀錄；隨餐藥在值班表做好前先留著。
// 在 JS 濾而不是 .neq()：category 欄位還沒加的資料庫也不會壞
async function getNoticeList(shift, date) {
    const { data, error } = await supabase
        .from('notices')
        .select()
        .or(`shift.eq.both,shift.eq.${shift}`)

    if (error) throw error

    return data
        .filter((notice) => notice.category !== 'meal')
        .filter(
            (notice) =>
                (!notice.start_date || notice.start_date <= date) &&
                (!notice.end_date || notice.end_date >= date)
        )
        .sort((a, b) => a.order - b.order)
        .map(({ id, ...rest }) => rest)
}