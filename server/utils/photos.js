import { supabase } from '~/server/utils/supabase'

// 值班照片（shift_photos ＋ Storage 的 shift-photos bucket）共用的東西。
// bucket 是私人的：上傳用一次性上傳網址，看照片用有時效的網址，都由 server 發
export const PHOTO_BUCKET = 'shift-photos'
export const PHOTO_TABS = ['arrive', 'care', 'meal', 'required']

// 有時效網址的有效時間：一班大約 12 小時，開著頁面不會中途失效
export const SIGNED_URL_SECONDS = 12 * 60 * 60

// 照片檔都放在「班 id/貓 id/」底下，存紀錄時用來確認路徑是剛才發的那一組
export function photoPrefix(shiftId, catId) {
    return `${shiftId}/${catId}/`
}

export const storage = () => supabase.storage.from(PHOTO_BUCKET)

// 一批照片紀錄 → 加上大圖與縮圖的有時效網址
export async function withSignedUrls(rows) {
    if (!rows.length) return []
    const paths = rows.flatMap((r) => [r.path, r.thumb_path])
    const { data, error } = await storage().createSignedUrls(paths, SIGNED_URL_SECONDS)
    if (error) throw createError({ statusCode: 500, message: error.message })
    const urlOf = new Map(data.map((d) => [d.path, d.signedUrl]))
    return rows.map((r) => ({ ...r, url: urlOf.get(r.path) || null, thumb_url: urlOf.get(r.thumb_path) || null }))
}

export const PHOTO_COLUMNS =
    'id, shift_id, cat_id, tab, kinds, note, path, thumb_path, width, height, size, uploaded_by, author_name, created_at'

// 照片描述：去頭尾空白，空的存 null，最多 500 字
export function cleanNote(note) {
    if (typeof note !== 'string') return null
    const text = note.trim().slice(0, 500)
    return text || null
}
