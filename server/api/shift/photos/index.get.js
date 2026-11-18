import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { LIBRARY_COLUMNS, withComment, withSignedUrls } from '~/server/utils/photos'

// 唯讀：這一班的 🗂️ 照片庫（含大圖與縮圖的有時效網址），照上傳時間排。直接上傳的與留言附的都有，留言附的帶著那則留言
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const shiftId = Number(getQuery(event).shiftId)
    if (!Number.isInteger(shiftId) || shiftId <= 0) {
        throw createError({ statusCode: 400, message: 'shiftId 格式錯誤' })
    }

    const { data, error } = await supabase
        .from('shift_photos')
        .select(LIBRARY_COLUMNS)
        .eq('shift_id', shiftId)
        .order('created_at')
    if (error) throw createError({ statusCode: 500, message: error.message })

    return withSignedUrls(data.map(withComment))
})
