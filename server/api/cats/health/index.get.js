import { requireUser } from '~/server/utils/auth'
import { loadHealthRecords } from '~/server/utils/health'

// 唯讀：一隻貓的醫療紀錄（驅蟲、預防針、就醫），新的在前，每筆帶照片（有時效網址）
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const cat = Number(getQuery(event).catId)
    if (!Number.isInteger(cat) || cat <= 0) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    return loadHealthRecords(cat)
})
