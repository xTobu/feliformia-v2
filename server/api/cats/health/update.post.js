import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'
import {
    MAX_HEALTH_PHOTOS,
    cleanHealthPhotos,
    cleanRecord,
    loadHealthRecords,
    nicknameOf,
    removeHealthFiles,
} from '~/server/utils/health'

// 管理員：修改一筆醫療紀錄（記下最後編輯的人）。addPhotos：新傳的照片；removePhotoIds：要拿掉的照片（連 Storage 檔一起刪）
export default defineEventHandler(async (event) => {
    const userId = await requireAdmin(event)

    const body = await readBody(event)
    const id = Number(body?.id)
    const record = cleanRecord(body || {})
    const removeIds = Array.isArray(body?.removePhotoIds) ? body.removePhotoIds.map(Number) : []
    if (!Number.isInteger(id) || id <= 0 || !record || !removeIds.every((n) => Number.isInteger(n) && n > 0)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { data: existing, error: findError } = await supabase
        .from('cat_health_records')
        .select('id, cat_id, cat_health_photos(id, path, thumb_path)')
        .eq('id', id)
        .maybeSingle()
    if (findError) throw createError({ statusCode: 500, message: findError.message })
    if (!existing) throw createError({ statusCode: 404, message: '找不到這筆紀錄' })

    const addPhotos = cleanHealthPhotos(body?.addPhotos, existing.cat_id)
    const removing = existing.cat_health_photos.filter((p) => removeIds.includes(p.id))
    const remaining = existing.cat_health_photos.length - removing.length
    if (!addPhotos || remaining + addPhotos.length > MAX_HEALTH_PHOTOS) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    // 記下最後改的人（照片的增減也算）
    const name = await nicknameOf(userId)
    const { error } = await supabase
        .from('cat_health_records')
        .update({ ...record, updated_by: userId, updated_by_name: name })
        .eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })

    if (addPhotos.length) {
        const { error: photoError } = await supabase
            .from('cat_health_photos')
            .insert(addPhotos.map((p) => ({ ...p, record_id: id, uploaded_by: userId, uploader_name: name })))
        if (photoError) throw createError({ statusCode: 500, message: photoError.message })
    }
    if (removing.length) {
        const { error: deleteError } = await supabase
            .from('cat_health_photos')
            .delete()
            .in(
                'id',
                removing.map((p) => p.id)
            )
        if (deleteError) throw createError({ statusCode: 500, message: deleteError.message })
        await removeHealthFiles(removing)
    }

    const [row] = await loadHealthRecords(existing.cat_id, [id])
    return row
})
