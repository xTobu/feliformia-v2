import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'
import { cleanHealthPhotos, cleanRecord, loadHealthRecords, nicknameOf } from '~/server/utils/health'

// 管理員：新增一筆醫療紀錄（照片手機已經傳到 Storage，這裡只記紀錄）。回傳那一筆（含照片網址）
export default defineEventHandler(async (event) => {
    const userId = await requireAdmin(event)

    const body = await readBody(event)
    const cat = Number(body?.catId)
    const record = cleanRecord(body || {})
    const photos = cleanHealthPhotos(body?.photos, cat)
    if (!Number.isInteger(cat) || cat <= 0 || !record || !photos) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const name = await nicknameOf(userId)
    const { data: created, error } = await supabase
        .from('cat_health_records')
        .insert({ ...record, cat_id: cat, created_by: userId, author_name: name, updated_by: userId, updated_by_name: name })
        .select('id')
        .single()
    if (error) throw createError({ statusCode: 500, message: error.message })

    if (photos.length) {
        const { error: photoError } = await supabase
            .from('cat_health_photos')
            .insert(photos.map((p) => ({ ...p, record_id: created.id, uploaded_by: userId, uploader_name: name })))
        // 照片記不進去就整筆不要（Storage 裡的檔案會變成沒人用的，數量很少就不管）
        if (photoError) {
            await supabase.from('cat_health_records').delete().eq('id', created.id)
            throw createError({ statusCode: 500, message: photoError.message })
        }
    }

    const [row] = await loadHealthRecords(cat, [created.id])
    return row
})
