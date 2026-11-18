import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'
import { itemUsage, recordsWithItem } from '~/server/utils/health'

// 管理員：自己加的項目用在幾筆醫療紀錄（所有貓）。blocking：只剩這個項目的紀錄（刪了會沒有項目，要先換）
export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const item = String(getQuery(event).item || '').trim()
    if (!item) throw createError({ statusCode: 400, message: '資料格式錯誤' })
    return itemUsage(await recordsWithItem(supabase, item))
})

