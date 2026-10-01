import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'
import { pushToUser } from '~/server/utils/line'
import { loadRosterSource, eventPeopleIds } from '~/server/utils/roster'
import { buildDigest } from '~/server/utils/calendar-message'

// 管理員在行事曆選好某一天、挑好要通知誰之後，私訊那幾個人「那天的活動摘要」。
//
// 跟 remind.get.js 的差別：
//   remind — Vercel Cron 觸發，驗 CRON_SECRET，發給「今天有活動的所有人」
//   notify — 管理員手動觸發，驗登入身分，日期與收件人都由管理員指定
//
// CRON_SECRET 不能放進前端（等於公開），所以兩支不能合併。

export default defineEventHandler(async (event) => {
    await requireAdmin(event)

    const { date, userIds } = await readBody(event)

    if (!date) {
        throw createError({ statusCode: 400, message: '缺少日期' })
    }
    if (!Array.isArray(userIds) || !userIds.length) {
        throw createError({ statusCode: 400, message: '沒有選擇要通知的人' })
    }

    // 刻意從資料庫撈，不信任前端傳來的活動內容 ——
    // 否則有人改 request body 就能用系統名義發任意訊息
    const { data: events, error } = await supabase
        .from('calendar_events')
        .select()
        .eq('date', date)
        .is('deleted_at', null)
        .order('time_start', { ascending: true })

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    if (!events.length) {
        return { total: userIds.length, notified: 0, skipped: userIds.length }
    }

    const source = await loadRosterSource([date])

    // 先算出每個人那天有哪些活動
    const byUser = new Map()
    for (const ev of events) {
        for (const userId of eventPeopleIds(source, ev)) {
            if (!userIds.includes(userId)) continue
            if (!byUser.has(userId)) byUser.set(userId, [])
            byUser.get(userId).push(ev)
        }
    }

    const lineIds = await loadLineUserIds(userIds)

    let notified = 0

    for (const [userId, list] of byUser) {
        const lineUserId = lineIds.get(userId)
        if (!lineUserId) continue

        const result = await pushToUser(lineUserId, buildDigest(date, list))
        if (result.success) notified++
    }

    return {
        total: userIds.length,
        notified,
        skipped: userIds.length - notified,
    }
})

async function loadLineUserIds(userIds) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, line_user_id')
        .in('id', userIds)
        .not('line_user_id', 'is', null)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return new Map((data || []).map((p) => [p.id, p.line_user_id]))
}
