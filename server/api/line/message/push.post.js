import { pushToGroups } from '~/server/utils/line'

// 推播到志工群組。/regular 與 /medicine 的手動發送按鈕在用。
export default defineEventHandler(async (event) => {
    const { text } = await readBody(event)

    if (!text) {
        throw createError({ statusCode: 400, message: 'empty body.text' })
    }

    try {
        return await pushToGroups(text)
    } catch (error) {
        console.error('LINE push error:', error)
        throw createError({ statusCode: 500, message: error.message })
    }
});
