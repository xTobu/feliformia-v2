import { supabase } from '~/server/utils/supabase'
import { avatarStorage, resolveAvatarTarget } from '~/server/utils/avatars'

// 換頭像（path 是剛傳好的檔）或拿掉頭像（path: null）。舊的檔案一起刪掉
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { table, id, prefix } = await resolveAvatarTarget(event, body)
    const path = body.path ?? null
    if (path !== null && (typeof path !== 'string' || !path.startsWith(prefix) || path.includes('..'))) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { data: row, error } = await supabase.from(table).select('avatar_path').eq('id', id).maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!row) throw createError({ statusCode: 404, message: '找不到資料' })

    const { error: updateError } = await supabase.from(table).update({ avatar_path: path }).eq('id', id)
    if (updateError) throw createError({ statusCode: 500, message: updateError.message })

    // 舊檔刪不掉也不影響（只是多一個沒人用的檔）
    if (row.avatar_path && row.avatar_path !== path) {
        const { error: removeError } = await avatarStorage().remove([row.avatar_path])
        if (removeError) console.warn('remove old avatar failed:', removeError.message)
    }

    return { avatar_path: path }
})
