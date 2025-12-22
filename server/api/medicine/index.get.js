import { supabase } from '~/server/utils/supabase'
import dayjs from 'dayjs'

export default defineEventHandler(async (event) => {
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
    const notices = await getNoticeList(shift)
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

async function getNoticeList(shift) {
    const { data, error } = await supabase
        .from('notices')
        .select()
        .or(`shift.eq.both,shift.eq.${shift}`)

    if (error) throw error

    return data
        .sort((a, b) => a.order - b.order)
        .map(({ id, ...rest }) => rest)
}