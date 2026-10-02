import { pushToGroups } from '~/server/utils/line'
import { requireUser } from '~/server/utils/auth'

// 推播到志工群組。/regular 與 /medicine 的手動發送按鈕在用。
//
// ⚠️ 這支會把任意文字用大哥的名義發到志工主群組，沒有驗證的話
// 任何人都能冒名廣播。只要登入就能發是刻意的 —— 原本的手動發送
// 按鈕本來就是給一般志工用的。
export default defineEventHandler(async (event) => {
    await requireUser(event)

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
