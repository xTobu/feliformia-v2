import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import {
    hasShiftBefore,
    isValidShiftQuery,
    shiftKey,
    shiftsBack,
    shiftsBackUntil,
} from '~/server/utils/shift'
import { COMMENT_COLUMNS, COMMENT_TABS, toMessages } from '~/server/utils/comments'

const FIRST_SHIFTS = 5 // 打開時：這一班加前面 4 班
const MORE_SHIFTS = 5 // 之後每次往前 5 班

// 唯讀：一個頻道（一隻貓、一個分頁）的留言，照「班」一批批往前翻（只到正在看的這一班為止）。
//   沒帶 cursor：這一班加前面 4 班；帶 cursorDate/cursorShift：從那班（不含）再往前 5 班；
//   再帶 untilDate/untilShift：一路往前到那一班（跳到很早的留言時用，一次載完）
// 回傳 shifts（這一批的班，新的在前，沒留言的班也在，畫面才看得出滑到哪一天）、messages、cursor、hasMore
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { catId, tab, date, shift, cursorDate, cursorShift, untilDate, untilShift } = getQuery(event)
    const cat = Number(catId)
    if (!Number.isInteger(cat) || cat <= 0 || !COMMENT_TABS.includes(tab) || !isValidShiftQuery(date, shift)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    if (cursorDate && !isValidShiftQuery(cursorDate, cursorShift)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    if (untilDate && !isValidShiftQuery(untilDate, untilShift)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    let window
    if (!cursorDate) window = shiftsBack(date, shift, FIRST_SHIFTS, true)
    else if (untilDate) window = shiftsBackUntil(cursorDate, cursorShift, { date: untilDate, shift: untilShift })
    else window = shiftsBack(cursorDate, cursorShift, MORE_SHIFTS)
    const oldest = window[window.length - 1]
    const inWindow = new Set(window.map(shiftKey))

    const { data, error } = await supabase
        .from('shift_comments')
        .select(COMMENT_COLUMNS)
        .eq('cat_id', cat)
        .eq('tab', tab)
        .gte('shifts.date', oldest.date)
        .lte('shifts.date', window[0].date)
        .order('created_at')
    if (error) throw createError({ statusCode: 500, message: error.message })

    const [messages, hasMore] = await Promise.all([
        toMessages(data.filter((r) => inWindow.has(shiftKey(r.shifts)))),
        hasShiftBefore(oldest),
    ])
    return { shifts: window, messages, cursor: oldest, hasMore }
})
