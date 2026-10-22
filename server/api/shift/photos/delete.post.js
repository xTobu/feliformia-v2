import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { storage } from '~/server/utils/photos'

// 刪照片：一張（{ id }）或一次多張（{ ids: [...] }，選取模式用）。
// 只有上傳的人或管理員可以；有任何一張沒有權限就整批不刪。Storage 的檔案和紀錄一起刪
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
        .select('id, path, thumb_path, uploaded_by')
        .in('id', ids)
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (photos.length !== ids.length) throw createError({ statusCode: 404, message: '照片不存在' })

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

    return { success: true, deleted: ids.length }
})
