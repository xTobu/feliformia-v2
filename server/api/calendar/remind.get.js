import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { supabase } from '~/server/utils/supabase'
import { pushToUser } from '~/server/utils/line'
import { loadRosterSource, eventPeopleIds } from '~/server/utils/roster'
import { buildDigest } from '~/server/utils/calendar-message'

dayjs.extend(utc)
dayjs.extend(timezone)

// 每天早上私訊提醒「今天有什麼事」給活動相關人員。
//
// 由 Vercel Cron 觸發（見 vercel.json）。Vercel Cron 是發 GET，
// 並在有設定 CRON_SECRET 時自動帶 Authorization: Bearer <CRON_SECRET>。
//
// 也可以手動帶同樣的 header 呼叫來測試。

export default defineEventHandler(async (event) => {
    requireCronAuth(event)

    // Vercel 跑在 UTC，要換算成台灣時間才會是「今天」
    const today = dayjs().tz('Asia/Taipei').format('YYYY-MM-DD')

    const { data: events, error } = await supabase
        .from('calendar_events')
        .select()
        .eq('date', today)
        .is('deleted_at', null)
        .order('time_start', { ascending: true })

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    if (!events.length) {
        return { date: today, events: 0, notified: 0, skipped: 0 }
    }

    const source = await loadRosterSource([today])

    // 一個人可能同一天有好幾筆活動，先依人分組，一次發一則就好
    const byUser = new Map()
    for (const ev of events) {
        for (const userId of eventPeopleIds(source, ev)) {
            if (!byUser.has(userId)) byUser.set(userId, [])
            byUser.get(userId).push(ev)
        }
    }

    if (!byUser.size) {
        return { date: today, events: events.length, notified: 0, skipped: 0 }
    }

    const lineIds = await loadLineUserIds([...byUser.keys()])

    let notified = 0
    let skipped = 0

    for (const [userId, list] of byUser) {
        const lineUserId = lineIds.get(userId)

        // 還沒綁定 LINE 的人收不到，管理員在 /admin/profiles 看得到誰還沒綁
        if (!lineUserId) {
            skipped++
            continue
        }

        const result = await pushToUser(lineUserId, buildDigest(today, list, { greeting: '早安！' }))
        result.success ? notified++ : skipped++
    }

    return { date: today, events: events.length, notified, skipped }
})

// Vercel Cron 會自動帶 Authorization: Bearer <CRON_SECRET>。
// 沒有這道檢查的話，任何人都能打這支 API 觸發推播。
function requireCronAuth(event) {
    const secret = process.env.CRON_SECRET

    if (!secret) {
        throw createError({ statusCode: 500, message: '沒有設定 CRON_SECRET' })
    }

    if (getHeader(event, 'authorization') !== `Bearer ${secret}`) {
        throw createError({ statusCode: 401, message: 'unauthorized' })
    }
}

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
