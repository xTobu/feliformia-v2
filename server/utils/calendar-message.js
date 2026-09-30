import dayjs from 'dayjs'
import { CalendarTypeLabel } from '~/server/utils/constant'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 組一個人某一天的活動摘要。
// 每日 cron（remind）與管理員手動提醒（notify）共用，避免兩邊格式走鐘。
//
// greeting 只有 cron 會帶（「早安！」），手動提醒不帶。
export function buildDigest(date, events, { greeting } = {}) {
    const d = dayjs(date)
    const dateText = `${d.format('M/D')}(${WEEKDAYS[d.day()]})`

    return [
        '【行事曆提醒】',
        '',
        // greeting 只有 cron 會帶 —— 它固定早上發
        ...(greeting ? [greeting] : []),
        '你有這些活動',
        '',
        dateText,
        ...events.map(
            (ev) =>
                `・${ev.time_start}-${ev.time_end}［${CalendarTypeLabel(ev.type)}］${ev.content}`
        ),
    ].join('\n')
}
