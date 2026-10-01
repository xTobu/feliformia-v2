import dayjs from 'dayjs'
import { CalendarTypeLabel } from '~/server/utils/constant'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 組一個人某一天的活動摘要。
// 每日 cron（remind）與管理員手動提醒（notify）共用同一個格式，
// 兩邊訊息一致，志工不會因為來源不同而困惑。
export function buildDigest(date, events) {
    const d = dayjs(date)

    return [
        '【貓毛活動提醒】',
        '',
        `${d.format('M/D')}(${WEEKDAYS[d.day()]})`,
        ...events.map(
            (ev) =>
                `・${ev.time_start}-${ev.time_end}［${CalendarTypeLabel(ev.type)}］${ev.content}`
        ),
    ].join('\n')
}
