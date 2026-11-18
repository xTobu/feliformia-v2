import { supabase } from '~/server/utils/supabase'
import { PHOTO_COLUMNS, photoPrefix, withSignedUrls } from '~/server/utils/photos'
import { isPhotoKindChoice, sortPhotoKinds } from '~/composables/photoKinds'

// 留言頻道（shift_comments）共用的東西。一隻貓、一個分頁是一個頻道，跨班一路往上看；
// 每則留言帶著它是哪一班（shifts 的 date、shift），畫面用來畫班與班之間的分隔線
export const COMMENT_TABS = ['arrive', 'care', 'meal', 'required']
export const MAX_COMMENT_LENGTH = 2000
export const MAX_COMMENT_PHOTOS = 10

export const COMMENT_COLUMNS =
    'id, shift_id, cat_id, tab, body, for_next, author_name, created_by, created_at, edited_at, shifts!inner(date, shift)'

// 查詢結果 → 畫面用的樣子：把 shifts 攤平成 date、shift，再掛上這則留言的照片（含有時效網址）
// 與作者的頭像路徑（author_avatar，公開 bucket，畫面自己組網址）
export async function toMessages(rows) {
    if (!rows.length) return []
    const authorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))]
    const { data: authors, error: authorError } = authorIds.length
        ? await supabase.from('profiles').select('id, avatar_path').in('id', authorIds)
        : { data: [], error: null }
    if (authorError) throw createError({ statusCode: 500, message: authorError.message })
    const avatarOf = new Map(authors.map((a) => [a.id, a.avatar_path]))

    const { data: photos, error } = await supabase
        .from('shift_photos')
        .select(PHOTO_COLUMNS)
        .in(
            'comment_id',
            rows.map((r) => r.id)
        )
        .order('created_at')
    if (error) throw createError({ statusCode: 500, message: error.message })

    const signed = await withSignedUrls(photos)
    return rows.map(({ shifts, ...row }) => ({
        ...row,
        date: shifts?.date ?? null,
        shift: shifts?.shift ?? null,
        author_avatar: avatarOf.get(row.created_by) || null,
        photos: signed.filter((p) => p.comment_id === row.id),
    }))
}

export async function loadMessage(id) {
    const { data, error } = await supabase
        .from('shift_comments')
        .select(COMMENT_COLUMNS)
        .eq('id', id)
        .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) return null
    const [message] = await toMessages([data])
    return message
}

// 留言附的照片：手機已經傳到 Storage 了，這裡檢查路徑是剛才發的那一組（班 id/貓 id/ 底下）。
// 每張可以帶類型（kinds，選填），規則跟照片庫一樣（composables/photoKinds.js）
export function cleanCommentPhotos(photos, shiftId, catId, tab) {
    if (photos == null) return []
    if (!Array.isArray(photos) || photos.length > MAX_COMMENT_PHOTOS) return null
    const prefix = photoPrefix(shiftId, catId)
    const int = (v) => (Number.isInteger(v) && v > 0 ? v : null)
    const ok = (path) => typeof path === 'string' && path.startsWith(prefix) && !path.includes('..')
    if (!photos.every((p) => ok(p?.path) && ok(p?.thumbPath))) return null
    const kindsOf = (p) => (p.kinds == null ? [] : p.kinds)
    if (!photos.every((p) => isPhotoKindChoice(tab, kindsOf(p)))) return null
    return photos.map((p) => ({
        path: p.path,
        thumb_path: p.thumbPath,
        kinds: sortPhotoKinds(tab, kindsOf(p)),
        width: int(p.width),
        height: int(p.height),
        size: int(p.size),
    }))
}

// 留言只有作者本人能改、能刪
export async function requireOwnComment(id, userId) {
    const { data, error } = await supabase
        .from('shift_comments')
        .select('id, shift_id, cat_id, tab, body, author_name, created_by')
        .eq('id', id)
        .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) throw createError({ statusCode: 404, message: '找不到這則留言' })
    if (data.created_by !== userId) throw createError({ statusCode: 403, message: '只能修改自己的留言' })
    return data
}
