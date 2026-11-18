import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { PHOTO_TABS, withSignedUrls } from '~/server/utils/photos'

// 唯讀：「LINE 發送至群組」要用的這一班、這個分頁的留言與照片（留言附的＋🗂️ 照片牆的）。
// 留言帶附了幾張照片；照片帶縮圖網址、上傳者、描述、是不是「重要」留言附的，給確認視窗勾選（並標出是哪則留言或照片牆的）
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const shiftId = Number(getQuery(event).shiftId)
    const { tab } = getQuery(event)
    if (!Number.isInteger(shiftId) || shiftId <= 0 || !PHOTO_TABS.includes(tab)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const [commentsRes, photosRes] = await Promise.all([
        supabase
            .from('shift_comments')
            .select('id, cat_id, body, for_next, author_name, created_at')
            .eq('shift_id', shiftId)
            .eq('tab', tab)
            .order('created_at'),
        supabase
            .from('shift_photos')
            .select('id, cat_id, comment_id, kinds, note, author_name, path, thumb_path, created_at')
            .eq('shift_id', shiftId)
            .eq('tab', tab)
            .order('created_at'),
    ])
    const failed = [commentsRes, photosRes].find((r) => r.error)
    if (failed) throw createError({ statusCode: 500, message: failed.error.message })

    const comments = commentsRes.data
    const important = new Set(comments.filter((c) => c.for_next).map((c) => c.id))
    const photos = await withSignedUrls(photosRes.data)

    return {
        comments: comments.map((c) => ({
            ...c,
            photo_count: photos.filter((p) => p.comment_id === c.id).length,
        })),
        photos: photos.map(({ path, thumb_path, url, ...p }) => ({
            ...p,
            important: important.has(p.comment_id),
        })),
    }
})
