import { randomUUID } from 'node:crypto'
import { requireUser } from '~/server/utils/auth'
import { PHOTO_TABS, photoPrefix, storage } from '~/server/utils/photos'

// 發一次性上傳網址：手機壓縮好之後直接傳到 Storage，不經過 Vercel（Vercel 一次只收約 4.5MB）。
// 每張照片兩個檔：大圖與縮圖。傳完再呼叫 POST /api/shift/photos 記一筆
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { shiftId, catId, tab, count = 1 } = await readBody(event)
    const n = Number(count)
    if (!shiftId || !catId || !PHOTO_TABS.includes(tab) || !Number.isInteger(n) || n < 1 || n > 10) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const uploads = []
    for (let i = 0; i < n; i++) {
        const base = `${photoPrefix(shiftId, catId)}${randomUUID()}`
        const [full, thumb] = await Promise.all(
            [`${base}.jpg`, `${base}_thumb.jpg`].map(async (path) => {
                const { data, error } = await storage().createSignedUploadUrl(path)
                if (error) throw createError({ statusCode: 500, message: error.message })
                return data
            })
        )
        uploads.push({ path: full.path, token: full.token, thumbPath: thumb.path, thumbToken: thumb.token })
    }
    return uploads
})
