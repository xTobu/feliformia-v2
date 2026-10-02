import { requireUser } from '~/server/utils/auth'
import { loadUserEvents, todayInTaipei } from '~/server/utils/calendar-today'
import { CalendarTypeLabel } from '~/server/utils/constant'

// 登入者今天的活動，給 FloatButton 的「今日活動提醒」彈窗用。
//
// 名單規則與每日 LINE 提醒、以及大哥的「我的活動提醒」完全共用
//（server/utils/calendar-today.js），三個入口看到的一定一致。
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const events = await loadUserEvents(userId, todayInTaipei())

    // type 與 content 分開回傳，前端才能把類型做成帶顏色的 badge
    //（顏色沿用 /calendar 的色票，志工看到的是同一套視覺語言）
    return events.map((ev) => ({
        id: ev.id,
        time: `${ev.time_start} ~ ${ev.time_end}`,
        type: ev.type,
        label: CalendarTypeLabel(ev.type),
        content: ev.content,
    }))
})
