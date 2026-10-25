import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'
import { isPresetItem } from '~/composables/healthKinds'
import { itemUsage, recordsWithItem } from '~/server/utils/health'

// 管理員：刪掉一個自己加的項目＝從所有用到它的醫療紀錄拿掉（預設項目不能刪）。
// 有紀錄只剩這個項目就整個不做（回 409 與那幾筆），請先幫那幾筆換項目。
// 這是整理標籤，不算編輯紀錄，不改最後編輯者
export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const item = String((await readBody(event))?.item || '').trim()
    if (!item || isPresetItem(item)) throw createError({ statusCode: 400, message: '資料格式錯誤' })

    const records = await recordsWithItem(supabase, item)
    const usage = itemUsage(records)
    if (usage.blocking.length) throw createError({ statusCode: 409, message: '有紀錄只剩這個項目', data: usage })

    for (const r of records) {
        const { error } = await supabase
            .from('cat_health_records')
            .update({ items: r.items.filter((i) => i !== item) })
            .eq('id', r.id)
        if (error) throw createError({ statusCode: 500, message: error.message })
    }
    return { count: records.length }
})
