import { randomUUID } from 'node:crypto'
import { requireAdmin } from '~/server/utils/auth'
import { CARE_ITEM_TABLES, MAX_CARE_ITEM_PHOTOS, careItemStorage } from '~/server/utils/careItemPhotos'

// 管理員：發照護項目附圖的一次性上傳網址（手機壓好大圖、縮圖直接傳到 Storage）。
// 傳完由後台把路徑存進那一項的 photos
export default defineEventHandler(async (event) => {
    await requireAdmin(event)

    const { table, count = 1 } = await readBody(event)
    const n = Number(count)
    if (!CARE_ITEM_TABLES.includes(table) || !Number.isInteger(n) || n < 1 || n > MAX_CARE_ITEM_PHOTOS) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const slot = async (path) => {
        const { data, error } = await careItemStorage().createSignedUploadUrl(path)
        if (error) throw createError({ statusCode: 500, message: error.message })
        return data
    }
    const uploads = []
    for (let i = 0; i < n; i++) {
        const base = `${table}/${randomUUID()}`
        const [full, thumb] = await Promise.all([slot(`${base}.jpg`), slot(`${base}_thumb.jpg`)])
        uploads.push({ path: full.path, token: full.token, thumbPath: thumb.path, thumbToken: thumb.token })
    }
    return uploads
})
