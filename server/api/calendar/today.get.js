import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { loadRosterSource, eventPeopleIds } from '~/server/utils/roster'
import { CalendarTypeLabel } from '~/server/utils/constant'

dayjs.extend(utc)
dayjs.extend(timezone)

// 登入者今天的活動，給 FloatButton 的「今日活動提醒」彈窗用。
//
// 跟每日 LINE 提醒（remind.get.js）**共用同一套名單規則** ——
// 兩邊都走 eventPeopleIds()，所以彈窗看到的跟大哥私訊的一定一致。
// 差別只在這支只算「我」、即時查、不推播。
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    // 伺服器跑在 UTC，要換算成台灣時間才會是「今天」
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

    if (!events.length) return []

    const source = await loadRosterSource([today])

    return events
        .filter((ev) => eventPeopleIds(source, ev).includes(userId))
        .map((ev) => ({
            id: ev.id,
            time: `${ev.time_start} ~ ${ev.time_end}`,
            text: `[${CalendarTypeLabel(ev.type)}] ${ev.content}`,
        }))
})
