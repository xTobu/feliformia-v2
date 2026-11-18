import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { requireOwnComment } from '~/server/utils/comments'
import { storage } from '~/server/utils/photos'

// 刪除自己的留言，附的照片一起刪（Storage 的檔案先刪，再刪紀錄；照片紀錄會跟著留言 cascade 掉）
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const commentId = Number((await readBody(event))?.id)
    if (!Number.isInteger(commentId) || commentId <= 0) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    await requireOwnComment(commentId, userId)

    const { data: photos, error: photoError } = await supabase
        .from('shift_photos')
        .select('path, thumb_path')
        .eq('comment_id', commentId)
    if (photoError) throw createError({ statusCode: 500, message: photoError.message })
    if (photos.length) {
        const { error } = await storage().remove(photos.flatMap((p) => [p.path, p.thumb_path]))
        if (error) throw createError({ statusCode: 500, message: error.message })
    }

    const { error } = await supabase.from('shift_comments').delete().eq('id', commentId)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { success: true }
})
