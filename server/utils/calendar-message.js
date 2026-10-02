import dayjs from 'dayjs'
import { CalendarTypeLabel } from '~/server/utils/constant'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 標題。🔔 不是 CalendarTypeLabel 的任何類型，不會跟底下的活動搞混。
const TITLE_PREFIX = '🔔 貓毛活動 '

// 組一個人某一天的活動摘要。
// 每日 cron（remind）與管理員手動提醒（notify）共用同一個格式，
// 兩邊訊息一致，志工不會因為來源不同而困惑。
export function buildDigest(date, events) {
    const d = dayjs(date)

    // LINE 的純文字長行會自己折返，而且折回來的那行不會縮排 ——
    // 全部塞一行的話，內容一長就會跟下一筆活動糊在一起。
    // 所以每筆拆成「時間」與「［類型］內容」兩行，中間再空一行隔開：
    // 時間那行永遠不會折，內容自己佔一行折了也不影響辨識。
    return [
        // 標題與日期併一行：LINE 的推播通知只預覽開頭，
        // 併起來志工在鎖定畫面就看得到「是什麼、哪一天」。
        `${TITLE_PREFIX}${d.format('MM/DD')}(${WEEKDAYS[d.day()]})`,
        ...events.flatMap((ev) => {
            const type = `[${CalendarTypeLabel(ev.type)}]`
            return [
                '',
                `${ev.time_start} ~ ${ev.time_end}`,
                ev.content ? `${type} ${ev.content}` : type,
            ]
        }),
    ].join('\n')
}
