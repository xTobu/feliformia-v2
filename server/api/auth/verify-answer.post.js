export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { answer } = body

    const correctAnswers = ['汐止', '汐止區', 'xizhi', 'Xizhi']

    if (!answer || !correctAnswers.includes(answer.trim())) {
        throw createError({ statusCode: 403, message: '答案錯誤' })
    }

    return { success: true }
})