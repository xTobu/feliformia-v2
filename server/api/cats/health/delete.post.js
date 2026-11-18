import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'
import { removeHealthFiles } from '~/server/utils/health'

// 管理員：刪除一筆醫療紀錄（照片紀錄 on delete cascade，Storage 檔在這裡一起刪）
export default defineEventHandler(async (event) => {
    await requireAdmin(event)

    const id = Number((await readBody(event))?.id)
    if (!Number.isInteger(id) || id <= 0) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { data: photos, error: findError } = await supabase
        .from('cat_health_photos')
        .select('path, thumb_path')
        .eq('record_id', id)
    if (findError) throw createError({ statusCode: 500, message: findError.message })

    const { error } = await supabase.from('cat_health_records').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })

    await removeHealthFiles(photos)
    return { success: true }
})
