import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { cleanNote } from '~/server/utils/photos'
import { isPhotoKindChoice, sortPhotoKinds } from '~/composables/photoKinds'

// 改照片描述或類型：只有上傳的人或管理員可以。有帶的欄位才改；描述空字串＝清掉，類型空陣列＝不分類。
// 留言附的照片只能改類型（描述就是那則留言）
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const body = await readBody(event)
    const { id } = body
    const { data: photo, error } = await supabase
        .from('shift_photos')
        .select('id, tab, comment_id, note, kinds, uploaded_by')
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

    if (photo.comment_id && 'note' in body) {
        throw createError({ statusCode: 400, message: '留言的照片只能改類型' })
    }

    const changes = {}
    if ('note' in body) changes.note = cleanNote(body.note)
    if ('kinds' in body) {
        if (!isPhotoKindChoice(photo.tab, body.kinds)) {
            throw createError({ statusCode: 400, message: '資料格式錯誤' })
        }
        changes.kinds = sortPhotoKinds(photo.tab, body.kinds)
    }
    if (Object.keys(changes).length) {
        const { error: updateError } = await supabase.from('shift_photos').update(changes).eq('id', photo.id)
        if (updateError) throw createError({ statusCode: 500, message: updateError.message })
    }

    return { note: changes.note ?? photo.note, kinds: changes.kinds ?? photo.kinds }
})
