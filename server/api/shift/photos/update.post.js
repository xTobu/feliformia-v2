import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { cleanNote } from '~/server/utils/photos'

// 改照片描述：只有上傳的人或管理員可以。空字串＝清掉描述
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const { id, note } = await readBody(event)
    const { data: photo, error } = await supabase
        .from('shift_photos')
        .select('id, uploaded_by')
        .eq('id', id)
        .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!photo) throw createError({ statusCode: 404, message: '照片不存在' })

    if (photo.uploaded_by !== userId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .maybeSingle()
        if (!profile?.is_admin) {
            throw createError({ statusCode: 403, message: '只能修改自己上傳的照片' })
        }
    }

    const { error: updateError } = await supabase
        .from('shift_photos')
        .update({ note: cleanNote(note) })
        .eq('id', photo.id)
    if (updateError) throw createError({ statusCode: 500, message: updateError.message })

    return { note: cleanNote(note) }
})
