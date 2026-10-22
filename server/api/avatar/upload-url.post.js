import { randomUUID } from 'node:crypto'
import { avatarStorage, resolveAvatarTarget } from '~/server/utils/avatars'

// 發頭像的一次性上傳網址（手機裁好、壓好之後直接傳到 Storage）。傳完再呼叫 /api/avatar/save
export default defineEventHandler(async (event) => {
    const { prefix } = await resolveAvatarTarget(event, await readBody(event))
    const { data, error } = await avatarStorage().createSignedUploadUrl(`${prefix}${randomUUID()}.jpg`)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { path: data.path, token: data.token }
})
