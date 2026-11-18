import { supabase } from '~/server/utils/supabase'
import { avatarStorage, resolveAvatarTarget } from '~/server/utils/avatars'

// 換頭像（path 是剛傳好的檔）或拿掉頭像（path: null）。
// sourcePath：原圖（新傳的，或沿用原本的）；crop：在原圖上框的範圍 { left, top, width, height }。
// 不再用到的舊檔（舊頭像、換掉的原圖）一起刪掉
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { table, id, prefix } = await resolveAvatarTarget(event, body)
    const ok = (p) => typeof p === 'string' && p.startsWith(prefix) && !p.includes('..')
    const path = body.path ?? null
    const sourcePath = path === null ? null : (body.sourcePath ?? null)
    if ((path !== null && !ok(path)) || (sourcePath !== null && !ok(sourcePath))) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    const crop = path === null ? null : cleanCrop(body.crop)

    const { data: row, error } = await supabase
        .from(table)
        .select('avatar_path, avatar_source_path')
        .eq('id', id)
        .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!row) throw createError({ statusCode: 404, message: '找不到資料' })

    const changes = { avatar_path: path, avatar_source_path: sourcePath, avatar_crop: crop }
    const { error: updateError } = await supabase.from(table).update(changes).eq('id', id)
    if (updateError) throw createError({ statusCode: 500, message: updateError.message })

    // 舊頭像拿來當原圖（舊資料第一次調整位置）就留著。刪不掉也不影響（只是多一個沒人用的檔）
    const stale = [row.avatar_path, row.avatar_source_path].filter((p) => p && p !== path && p !== sourcePath)
    if (stale.length) {
        const { error: removeError } = await avatarStorage().remove(stale)
        if (removeError) console.warn('remove old avatar failed:', removeError.message)
    }

    return changes
})

// 框的範圍：四個非負的數字（寬高大於 0），取整數；格式不對就不存
function cleanCrop(crop) {
    const keys = ['left', 'top', 'width', 'height']
    if (!crop || typeof crop !== 'object') return null
    const values = keys.map((k) => Number(crop[k]))
    if (values.some((v) => !Number.isFinite(v) || v < 0) || values[2] <= 0 || values[3] <= 0) return null
    return Object.fromEntries(keys.map((k, i) => [k, Math.round(values[i])]))
}
