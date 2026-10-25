import { randomUUID } from 'node:crypto'
import { requireAdmin } from '~/server/utils/auth'
import { MAX_HEALTH_PHOTOS, healthPrefix, healthStorage } from '~/server/utils/health'

// 管理員：發醫療紀錄照片的一次性上傳網址（同值班照片：手機壓縮好直接傳到 Storage，一張大圖一張縮圖）。
// 傳完再新增或修改紀錄時把路徑帶上
export default defineEventHandler(async (event) => {
    await requireAdmin(event)

    const { catId, count = 1 } = await readBody(event)
    const cat = Number(catId)
    const n = Number(count)
    if (!Number.isInteger(cat) || cat <= 0 || !Number.isInteger(n) || n < 1 || n > MAX_HEALTH_PHOTOS) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const uploads = []
    for (let i = 0; i < n; i++) {
        const base = `${healthPrefix(cat)}${randomUUID()}`
        const [full, thumb] = await Promise.all(
            [`${base}.jpg`, `${base}_thumb.jpg`].map(async (path) => {
                const { data, error } = await healthStorage().createSignedUploadUrl(path)
                if (error) throw createError({ statusCode: 500, message: error.message })
                return data
            })
        )
        uploads.push({ path: full.path, token: full.token, thumbPath: thumb.path, thumbToken: thumb.token })
    }
    return uploads
})
