import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

// 整筆覆寫 cats / tasks（跟 regular / medicine 一樣）。
// 兩個人同時改不同的貓，後存的會蓋掉先存的；真的發生再改成只更新變動的那隻貓
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const { recordId, cats, tasks, note, member } = await readBody(event)
    if (!recordId || !Array.isArray(cats) || !Array.isArray(tasks)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { error } = await supabase
        .from('shifts')
        .update({
            cats,
            tasks,
            note: note || null,
            member: member || null,
            updated_by: userId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return { success: true }
})
