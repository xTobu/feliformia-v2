import { randomUUID } from 'node:crypto'
import { avatarStorage, resolveAvatarTarget } from '~/server/utils/avatars'

// 發頭像的一次性上傳網址（手機裁好、壓好之後直接傳到 Storage）。傳完再呼叫 /api/avatar/save。
// withSource：新選的照片，原圖（壓過的）也要傳，多發一組
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { prefix } = await resolveAvatarTarget(event, body)
    const base = `${prefix}${randomUUID()}`
    const slot = async (path) => {
        const { data, error } = await avatarStorage().createSignedUploadUrl(path)
        if (error) throw createError({ statusCode: 500, message: error.message })
        return data
    }
    const avatar = await slot(`${base}.jpg`)
    if (!body?.withSource) return { path: avatar.path, token: avatar.token }
    const source = await slot(`${base}_src.jpg`)
    return { path: avatar.path, token: avatar.token, sourcePath: source.path, sourceToken: source.token }
})
