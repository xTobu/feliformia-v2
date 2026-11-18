import { supabase } from '~/server/utils/supabase'
import { storage, withSignedUrls } from '~/server/utils/photos'
import {
    HEALTH_TYPES,
    MAX_COMPANIONS,
    MAX_COMPANION_LENGTH,
    MAX_HEALTH_ITEMS,
    MAX_HEALTH_ITEM_LENGTH,
    sortHealthItems,
} from '~/composables/healthKinds'

// 醫療紀錄（cat_health_records ＋ cat_health_photos，檔案在 Storage 私人 bucket cat-health）共用的東西。
// 讀取所有登入的人都可以；寫入只有管理員（server/api/cats/health*）
export const HEALTH_BUCKET = 'cat-health'
export const healthStorage = () => storage(HEALTH_BUCKET)
export const MAX_HEALTH_PHOTOS = 10
const MAX_NOTE = 2000

const RECORD_COLUMNS = 'id, cat_id, kind, items, companions, date, note, author_name, updated_by_name, created_at, updated_at'
const PHOTO_COLUMNS = 'id, record_id, path, thumb_path, width, height, size, uploader_name, created_at'

// 登入者當下的暱稱（存進紀錄與照片：之後改暱稱，舊紀錄還是當時的名字）
export async function nicknameOf(userId) {
    const { data } = await supabase.from('profiles').select('nickname').eq('id', userId).maybeSingle()
    return data?.nickname || null
}

// 照片檔都放在「貓 id/」底下，存紀錄時用來確認路徑是剛才發的那一組
export const healthPrefix = (catId) => `${catId}/`

// 表單 → 要存的欄位；格式不對回 null。項目可以是預設的或自己加的標籤（每個最多 20 字、最多 20 個），至少一個；
// 陪同者是名字（志工名單選的或自己打的）
export function cleanRecord({ kind, date, items, companions, note }) {
    if (!HEALTH_TYPES.some((t) => t.key === kind)) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null
    if (items != null && !Array.isArray(items)) return null
    const cleanItems = sortHealthItems((items || []).filter((i) => typeof i === 'string'))
    if (cleanItems.length > MAX_HEALTH_ITEMS || cleanItems.some((i) => i.length > MAX_HEALTH_ITEM_LENGTH)) return null
    if (!cleanItems.length) return null
    // 陪同者：名字去空白、去重複，最多 10 個、每個最多 20 字
    if (companions != null && !Array.isArray(companions)) return null
    const cleanCompanions = [
        ...new Set((companions || []).filter((c) => typeof c === 'string').map((c) => c.trim()).filter(Boolean)),
    ]
    if (cleanCompanions.length > MAX_COMPANIONS || cleanCompanions.some((c) => c.length > MAX_COMPANION_LENGTH)) return null
    const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null
    return { kind, date, items: cleanItems, companions: cleanCompanions, note: text(note, MAX_NOTE) }
}

// 手機已經傳到 Storage 的照片：檢查路徑是剛才發的那一組（貓 id/ 底下）
export function cleanHealthPhotos(photos, catId) {
    if (photos == null) return []
    if (!Array.isArray(photos) || photos.length > MAX_HEALTH_PHOTOS) return null
    const prefix = healthPrefix(catId)
    const ok = (path) => typeof path === 'string' && path.startsWith(prefix) && !path.includes('..')
    if (!photos.every((p) => ok(p?.path) && ok(p?.thumbPath))) return null
    const int = (v) => (Number.isInteger(v) && v > 0 ? v : null)
    return photos.map((p) => ({
        path: p.path,
        thumb_path: p.thumbPath,
        width: int(p.width),
        height: int(p.height),
        size: int(p.size),
    }))
}

// 一隻貓的紀錄（新的在前），每筆帶著照片（含有時效網址）。只要某幾筆時傳 ids
export async function loadHealthRecords(catId, ids = null) {
    let query = supabase
        .from('cat_health_records')
        .select(RECORD_COLUMNS)
        .eq('cat_id', catId)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
    if (ids) query = query.in('id', ids)
    const { data: records, error } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!records.length) return []

    const { data: photos, error: photoError } = await supabase
        .from('cat_health_photos')
        .select(PHOTO_COLUMNS)
        .in(
            'record_id',
            records.map((r) => r.id)
        )
        .order('id')
    if (photoError) throw createError({ statusCode: 500, message: photoError.message })

    const signed = await withSignedUrls(photos, HEALTH_BUCKET)
    return records.map((r) => ({ ...r, photos: signed.filter((p) => p.record_id === r.id) }))
}

// 用到某個項目的醫療紀錄（所有貓），帶著貓的名字。刪項目前查用量、刪的時候用。
// 自己打的項目可能有逗號、引號，不用 PostgREST 的陣列條件，抓回來自己比（紀錄不多）
export async function recordsWithItem(client, item) {
    const { data, error } = await client
        .from('cat_health_records')
        .select('id, date, items, cat_profiles(name)')
        .order('date', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data.filter((r) => (r.items || []).includes(item))
}

// 用量：幾筆；blocking 是只剩這個項目的（刪了會沒有項目，要先換）
export const itemUsage = (records) => ({
    count: records.length,
    blocking: records
        .filter((r) => r.items.length === 1)
        .map((r) => ({ id: r.id, date: r.date, cat_name: r.cat_profiles?.name || '' })),
})

// 刪掉照片的 Storage 檔案（紀錄已經刪了或要刪）。失敗只記 log：檔案留著沒人用，不影響畫面
export async function removeHealthFiles(photos) {
    if (!photos.length) return
    const { error } = await healthStorage().remove(photos.flatMap((p) => [p.path, p.thumb_path]))
    if (error) console.error('remove health files error:', error)
}
