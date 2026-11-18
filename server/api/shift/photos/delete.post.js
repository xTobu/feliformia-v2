import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { storage } from '~/server/utils/photos'
import { loadMessage } from '~/server/utils/comments'

// 刪照片：一張（{ id }）或一次多張（{ ids: [...] }，選取模式用）。
// 只有上傳的人或管理員可以；有任何一張沒有權限就整批不刪。Storage 的檔案和紀錄一起刪。
// 留言附的照片也可以刪（只有留言的本人），那則留言就少一張；留言沒有文字、照片又刪光了，留言一起刪掉（不留空的留言）。
// 回傳 comments：受影響的留言 [{ id, message }]，message 是刪完的樣子（整則刪掉的是 null），給前端更新留言頻道
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const body = await readBody(event)
    const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : [body?.id]).map(Number))].filter(
        (id) => Number.isInteger(id) && id > 0
    )
    if (ids.length === 0 || ids.length > 100) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { data: photos, error } = await supabase
        .from('shift_photos')
        .select('id, comment_id, path, thumb_path, uploaded_by')
        .in('id', ids)
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (photos.length !== ids.length) throw createError({ statusCode: 404, message: '照片不存在' })

    // 留言裡的照片跟留言一樣，只有留言的本人可以刪（管理員也不行）
    if (photos.some((p) => p.comment_id && p.uploaded_by !== userId)) {
        throw createError({ statusCode: 403, message: '留言裡的照片只有留言的人可以刪除' })
    }
    if (photos.some((p) => p.uploaded_by !== userId)) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .maybeSingle()
        if (!profile?.is_admin) {
            throw createError({ statusCode: 403, message: '只能刪除自己上傳的照片' })
        }
    }

    const { error: removeError } = await storage().remove(photos.flatMap((p) => [p.path, p.thumb_path]))
    if (removeError) throw createError({ statusCode: 500, message: removeError.message })

    const { error: deleteError } = await supabase.from('shift_photos').delete().in('id', ids)
    if (deleteError) throw createError({ statusCode: 500, message: deleteError.message })

    const comments = []
    for (const commentId of new Set(photos.map((p) => p.comment_id).filter(Boolean))) {
        const message = await loadMessage(commentId)
        if (message && !message.body.trim() && !message.photos.length) {
            const { error: commentError } = await supabase.from('shift_comments').delete().eq('id', commentId)
            if (commentError) throw createError({ statusCode: 500, message: commentError.message })
            comments.push({ id: commentId, message: null })
        } else {
            comments.push({ id: commentId, message })
        }
    }

    return { success: true, deleted: ids.length, comments }
})
