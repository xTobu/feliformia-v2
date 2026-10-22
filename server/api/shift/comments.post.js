import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import {
    COMMENT_TABS,
    MAX_COMMENT_LENGTH,
    cleanCommentPhotos,
    loadMessage,
} from '~/server/utils/comments'

// 新增一則留言，可以附照片（手機先傳到 Storage，這裡只記紀錄）。只新增、不覆蓋，多人同時留言不會互相蓋掉。
// 只附照片、不寫字也可以
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const { shiftId, catId, tab, body, forNext, photos } = await readBody(event)
    const text = String(body ?? '').trim().slice(0, MAX_COMMENT_LENGTH)
    const photoRows = cleanCommentPhotos(photos, shiftId, catId)
    if (!shiftId || !catId || !COMMENT_TABS.includes(tab) || !photoRows || (!text && !photoRows.length)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    // 留言當下的暱稱另外存一份：之後改暱稱，舊留言還是顯示當時的名字
    const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle()
    const authorName = profile?.nickname || null

    const { data: comment, error } = await supabase
        .from('shift_comments')
        .insert({
            shift_id: shiftId,
            cat_id: catId,
            tab,
            body: text,
            for_next: !!forNext,
            author_name: authorName,
            created_by: userId,
        })
        .select('id')
        .single()
    if (error) throw createError({ statusCode: 500, message: error.message })

    if (photoRows.length) {
        const { error: photoError } = await supabase.from('shift_photos').insert(
            photoRows.map((p) => ({
                ...p,
                shift_id: shiftId,
                cat_id: catId,
                tab,
                comment_id: comment.id,
                uploaded_by: userId,
                author_name: authorName,
            }))
        )
        // 照片記不進去就整則不要，免得留下一則空的留言（Storage 裡的檔案會變成沒人用的，數量很少就不管）
        if (photoError) {
            await supabase.from('shift_comments').delete().eq('id', comment.id)
            throw createError({ statusCode: 500, message: photoError.message })
        }
    }

    return loadMessage(comment.id)
})
