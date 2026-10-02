import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { supabase } from '~/server/utils/supabase'
import { loadRosterSource, eventPeopleIds } from '~/server/utils/roster'

dayjs.extend(utc)
dayjs.extend(timezone)

// 「某個人某一天有份的活動」。
//
// /api/calendar/today（網站彈窗）與 LINE 的「我的活動提醒」共用這一份 ——
// 值班人員的規則之後再變，只要改 roster.js 的 eventPeopleIds() 一個地方，
// 兩個入口會一起對。
//
// 回傳的是 calendar_events 的原始 row，呼叫端自己決定怎麼呈現：
// 端點轉成 JSON 給前端，webhook 丟給 buildDigest() 組 LINE 訊息。

// 伺服器跑在 UTC，要換算成台灣時間才會是「今天」
export function todayInTaipei() {
    return dayjs().tz('Asia/Taipei').format('YYYY-MM-DD')
}

export async function loadUserEvents(userId, date) {
    const { data: events, error } = await supabase
        .from('calendar_events')
        .select()
        .eq('date', date)
        .is('deleted_at', null)
        .order('time_start', { ascending: true })

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    if (!events.length) return []

    const source = await loadRosterSource([date])

    return events.filter((ev) => eventPeopleIds(source, ev).includes(userId))
}
