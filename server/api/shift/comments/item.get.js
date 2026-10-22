import { requireUser } from '~/server/utils/auth'
import { loadMessage } from '~/server/utils/comments'

// 唯讀：單一則留言（含照片）。別人新增、編輯留言時，畫面收到即時通知後用這支補齊照片網址
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const id = Number(getQuery(event).id)
    if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, message: '資料格式錯誤' })

    const message = await loadMessage(id)
    if (!message) throw createError({ statusCode: 404, message: '找不到這則留言' })
    return message
})
