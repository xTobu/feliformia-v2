import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { todayInTaipei } from '~/server/utils/shift'

const DAYS = 7 // 一次往前 7 天（14 班）

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')
function addDays(date, days) {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

function check(result) {
    if (result.error) throw createError({ statusCode: 500, message: result.error.message })
    return result.data
}

// 唯讀：貓咪檔案的日常。一班一段，新的在前，一次 7 天往前翻：
//   沒帶 before：從今天（或 to）開始；帶 before：從那天（不含）再往前
//   from / to：只看這段日期（含頭尾）
// 每一段：
//   值班：這隻貓的飲食如廁（intake）、前班放風（prev_released）、這班放風（released）；
//         值班表那班沒有這隻貓就沒有這些（in_shift: false）。還在進行的班標 ongoing
// 2026-11-12 起不再回傳：值班表的留言、照片（資料都還在 shift_comments、shift_photos）、未完成（貓咪檔案不用看）。
// 這隻貓沒出現的班不回傳。cursor：這一批最舊的那天，下次從它往前；hasMore：更早還有沒有班
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { catId, before, from, to } = getQuery(event)
    const cat = Number(catId)
    if (
        !Number.isInteger(cat) ||
        cat <= 0 ||
        (before && !isDate(before)) ||
        (from && !isDate(from)) ||
        (to && !isDate(to)) ||
        (from && to && from > to)
    ) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const today = todayInTaipei()
    let end = to && to < today ? to : today
    if (before && addDays(before, -1) < end) end = addDays(before, -1)
    let start = addDays(end, -(DAYS - 1))
    if (from && start < from) start = from
    if (from && end < from) return { entries: [], cursor: null, hasMore: false }

    const rows = check(
        await supabase
            .from('shifts')
            .select(`id, date, shift, snapshot:cats->"${cat}"`)
            .gte('date', start)
            .lte('date', end)
            .order('date', { ascending: false })
            .order('shift', { ascending: false }) // 同一天晚班在前
    )

    let olderQuery = supabase.from('shifts').select('id').lt('date', start).limit(1)
    if (from) olderQuery = olderQuery.gte('date', from)
    const older = await olderQuery
    const hasMore = check(older).length > 0

    // 還在進行的班：今天的晚班；今天的早班在晚班還沒開之前
    const tonightOpened = rows.some((r) => r.date === today && r.shift === 'night')
    const isOngoing = (r) => r.date === today && (r.shift === 'night' || !tonightOpened)

    const entries = rows
        .map((r) => {
            const snapshot = r.snapshot
            return {
                shift_id: r.id,
                date: r.date,
                shift: r.shift,
                ongoing: isOngoing(r),
                in_shift: !!snapshot,
                intake: snapshot?.intake ?? null,
                prev_released: !!snapshot?.prev_released,
                released: !!snapshot?.released,
            }
        })
        .filter((e) => e.in_shift)

    return { entries, cursor: hasMore ? start : null, hasMore }
})
