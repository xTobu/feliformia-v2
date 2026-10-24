import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isValidShiftQuery, previousShiftOf, releasedCatIds, unfinishedOf } from '~/server/utils/shift'

// 唯讀：給定這一班，回傳前一班的各分頁回報、放風的貓、各分頁沒勾完的項目。前一班沒有記錄就回空的，不會建立
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { date, shift } = getQuery(event)
    if (!isValidShiftQuery(date, shift)) {
        throw createError({ statusCode: 400, message: 'date 或 shift 格式錯誤' })
    }

    const prev = previousShiftOf(date, shift)
    const { data, error } = await supabase
        .from('shifts')
        .select('id, reports, cats, tasks')
        .eq('date', prev.date)
        .eq('shift', prev.shift)
        .maybeSingle()

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }
    if (!data) {
        return { ...prev, exists: false, reports: {}, released: [], unfinished: {} }
    }

    // 觀察項目拍了沒，看那一班的觀察照片（直接上傳的與留言附的都算）
    const { data: photos, error: photoError } = await supabase
        .from('shift_photos')
        .select('cat_id, kinds')
        .eq('shift_id', data.id)
        .eq('tab', 'arrive')
    if (photoError) throw createError({ statusCode: 500, message: photoError.message })

    return {
        ...prev,
        exists: true,
        // { 分頁: { user_id: { name, text, at } } }
        reports: data.reports || {},
        released: [...(await releasedCatIds({ ...prev, cats: data.cats }))],
        // { arrive, care, meal, required }：各分頁沒勾完（觀察是沒拍）的項目，見 unfinishedOf
        unfinished: unfinishedOf(data, photos),
    }
})
