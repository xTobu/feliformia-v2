import { supabase } from '~/server/utils/supabase'

// 從 votes 算出某幾天的值班名單。
// 這段邏輯原本只在 pages/calendar.vue 裡（rosterEntries），
// 提醒功能在 server 端也要用，所以搬一份出來共用。
//
// ⚠️ 不要用 week_start 精準比對。正式站的資料已經正規化過（781 筆裡只剩 1 筆
// 沒對齊星期一），但測試站還是大量偏移，而且正式站那 1 筆代表例外仍會發生。
// votes.data 本來就是以真實日期當 key，直接查 key 最穩。
// 詳見 docs/calendar-handoff.md 的 7.4。

// 算值班人員的選項名稱。只有這兩個算 —— 勾「醫療」的人那天是帶貓去就醫、
// 人不在貓屋，不該被當成值班人員收到活動提醒。
//
// ⚠️ pages/calendar.vue 也有一份一樣的常數（畫面上的早晚班人員 chip），兩邊要一起改。
// ⚠️ 比對的是 vote_options.name。在 /admin/vote-options 改名或新增選項時，
//    這裡沒跟著改就會靜默漏人 —— 不會報錯，只是名單少人。
const DUTY_OPTION_NAMES = ['值班', '快閃/協助']

// 該班別算值班的選項；shift 缺值視同 'both'，與 /vote 的處理一致
function shiftOptions(voteOptions, shift) {
    return voteOptions.filter(
        (opt) =>
            DUTY_OPTION_NAMES.includes(opt.name) &&
            (!opt.shift || opt.shift === 'both' || opt.shift === shift)
    )
}

// 撈出算名單需要的原始資料。dates 是一串 'YYYY-MM-DD'
export async function loadRosterSource(dates) {
    if (!dates.length) return { voteOptions: [], votes: [] }

    const sorted = [...dates].sort()
    // week_start 可能偏移，前後各多抓一週當緩衝
    const from = shiftDate(sorted[0], -14)
    const to = shiftDate(sorted[sorted.length - 1], 14)

    const [optionsRes, votesRes] = await Promise.all([
        supabase
            .from('vote_options')
            .select('*')
            .eq('is_active', true)
            .order('sort_order'),
        supabase
            .from('votes')
            .select('user_id, week_start, is_pass, data')
            .gte('week_start', from)
            .lte('week_start', to),
    ])

    if (optionsRes.error) {
        throw createError({ statusCode: 500, message: optionsRes.error.message })
    }
    if (votesRes.error) {
        throw createError({ statusCode: 500, message: votesRes.error.message })
    }

    return {
        voteOptions: optionsRes.data || [],
        votes: votesRes.data || [],
    }
}

function shiftDate(date, days) {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

// 某天某班別值班的人（user id 陣列）
export function rosterUserIds({ voteOptions, votes }, date, shift) {
    const ids = []

    for (const option of shiftOptions(voteOptions, shift)) {
        for (const vote of votes) {
            // 勾了「本週Pass」的人等於整週請假，data 裡的舊勾選不算數
            if (vote.is_pass) continue
            if (!vote.data?.[date]?.[shift]?.[option.id]?.checked) continue

            ids.push(vote.user_id)
        }
    }

    return [...new Set(ids)]
}

// 一筆活動要提示到的人（user id 陣列）。
// 與前端的 eventPeopleIds() 同一套規則。
export function eventPeopleIds(source, ev) {
    const roles = ev.notify_roles || []
    const ids = []

    if (roles.includes('owner')) ids.push(...(ev.owners || []))
    if (roles.includes('morning')) ids.push(...rosterUserIds(source, ev.date, 'morning'))
    if (roles.includes('night')) ids.push(...rosterUserIds(source, ev.date, 'night'))

    return [...new Set(ids)]
}
