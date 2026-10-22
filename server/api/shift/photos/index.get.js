import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { PHOTO_COLUMNS, withSignedUrls } from '~/server/utils/photos'

// 唯讀：這一班的 🗂️ 照片牆（含大圖與縮圖的有時效網址），照上傳時間排。留言附的照片不算，在留言頻道裡
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const shiftId = Number(getQuery(event).shiftId)
    if (!Number.isInteger(shiftId) || shiftId <= 0) {
        throw createError({ statusCode: 400, message: 'shiftId 格式錯誤' })
    }

    const { data, error } = await supabase
        .from('shift_photos')
        .select(PHOTO_COLUMNS)
        .eq('shift_id', shiftId)
        .is('comment_id', null)
        .order('created_at')
    if (error) throw createError({ statusCode: 500, message: error.message })

    return withSignedUrls(data)
})
