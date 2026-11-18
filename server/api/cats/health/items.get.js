import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isPresetItem } from '~/composables/healthKinds'

// 唯讀：志工自己加過的項目標籤（所有貓的醫療紀錄裡、不在預設清單的），用得多的在前。
// 新增視窗裡接在預設項目後面，加過一次之後直接點就好
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { data, error } = await supabase.from('cat_health_records').select('items')
    if (error) throw createError({ statusCode: 500, message: error.message })

    const counts = new Map()
    for (const item of data.flatMap((r) => r.items || [])) {
        if (!isPresetItem(item)) counts.set(item, (counts.get(item) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([item]) => item)
})
