import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import {
    MAX_COMMENT_LENGTH,
    MAX_COMMENT_PHOTOS,
    cleanCommentPhotos,
    loadMessage,
    requireOwnComment,
} from '~/server/utils/comments'
import { storage } from '~/server/utils/photos'

// 編輯自己的留言：改文字、「重要」（for_next）、拿掉或新增照片。
// 文字或照片有變才記 edited_at（畫面顯示「已編輯」），只改重要不算。
// 新照片跟新增留言一樣，手機先傳到 Storage，這裡只記紀錄。
// 改完一定要還有文字或照片（都不要的話請刪除留言）
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const { id, body, forNext, removePhotoIds = [], photos } = await readBody(event)
    const commentId = Number(id)
    if (
        !Number.isInteger(commentId) ||
        commentId <= 0 ||
        typeof body !== 'string' ||
        (forNext !== undefined && typeof forNext !== 'boolean') ||
        !Array.isArray(removePhotoIds) ||
        !removePhotoIds.every((p) => Number.isInteger(p) && p > 0)
    ) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    const comment = await requireOwnComment(commentId, userId)
    const newPhotos = cleanCommentPhotos(photos, comment.shift_id, comment.cat_id)
    if (!newPhotos) throw createError({ statusCode: 400, message: '資料格式錯誤' })

    const { data: current, error: photoError } = await supabase
        .from('shift_photos')
        .select('id, path, thumb_path')
        .eq('comment_id', commentId)
    if (photoError) throw createError({ statusCode: 500, message: photoError.message })

    // 只能拿掉這則留言自己的照片
    const removing = current.filter((p) => removePhotoIds.includes(p.id))
    if (removing.length !== new Set(removePhotoIds).size) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    const remaining = current.length - removing.length + newPhotos.length
    if (remaining > MAX_COMMENT_PHOTOS) {
        throw createError({ statusCode: 400, message: `一則留言最多 ${MAX_COMMENT_PHOTOS} 張照片` })
    }

    const text = body.trim().slice(0, MAX_COMMENT_LENGTH)
    if (!text && !remaining) throw createError({ statusCode: 400, message: '留言不能是空的' })

    // 先記新照片，再刪拿掉的（Storage 檔先刪，再刪紀錄），最後改文字
    if (newPhotos.length) {
        const { error } = await supabase.from('shift_photos').insert(
            newPhotos.map((p) => ({
                ...p,
                shift_id: comment.shift_id,
                cat_id: comment.cat_id,
                tab: comment.tab,
                comment_id: commentId,
                uploaded_by: userId,
                author_name: comment.author_name,
            }))
        )
        if (error) throw createError({ statusCode: 500, message: error.message })
    }
    if (removing.length) {
        const { error: removeError } = await storage().remove(removing.flatMap((p) => [p.path, p.thumb_path]))
        if (removeError) throw createError({ statusCode: 500, message: removeError.message })
        const { error } = await supabase
            .from('shift_photos')
            .delete()
            .in(
                'id',
                removing.map((p) => p.id)
            )
        if (error) throw createError({ statusCode: 500, message: error.message })
    }

    const contentChanged = text !== comment.body || newPhotos.length > 0 || removing.length > 0
    const changes = {
        ...(contentChanged ? { body: text, edited_at: new Date().toISOString() } : {}),
        ...(forNext !== undefined ? { for_next: forNext } : {}),
    }
    if (Object.keys(changes).length) {
        const { error } = await supabase.from('shift_comments').update(changes).eq('id', commentId)
        if (error) throw createError({ statusCode: 500, message: error.message })
    }

    return loadMessage(commentId)
})
