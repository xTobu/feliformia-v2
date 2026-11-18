import { requireAdmin } from '~/server/utils/auth'
import { careItemStorage, careThumbOf, isCareItemPhotoPath } from '~/server/utils/careItemPhotos'

// 管理員：刪掉不再用的附圖檔（項目拿掉照片、整項刪除、或上傳了沒存）。大圖與縮圖一起刪。
// 刪不掉只記 log：檔案留著沒人用，不影響畫面
export default defineEventHandler(async (event) => {
    await requireAdmin(event)

    const { paths } = await readBody(event)
    if (!Array.isArray(paths) || paths.length > 50 || !paths.every(isCareItemPhotoPath)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    if (!paths.length) return { success: true }

    const { error } = await careItemStorage().remove(paths.flatMap((p) => [p, careThumbOf(p)]))
    if (error) console.error('remove care item photos error:', error)
    return { success: true }
})
