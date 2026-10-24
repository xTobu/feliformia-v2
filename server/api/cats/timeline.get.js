import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { todayInTaipei } from '~/server/utils/shift'
import { COMMENT_COLUMNS, toMessages } from '~/server/utils/comments'
import { LIBRARY_COLUMNS, withComment, withSignedUrls } from '~/server/utils/photos'

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

// 唯讀：貓咪檔案的時間軸。一班一段，新的在前，一次 7 天往前翻：
//   沒帶 before：從今天（或 to）開始；帶 before：從那天（不含）再往前
//   from / to：只看這段日期（含頭尾）
// 每一段：這一班這隻貓的飲食如廁（intake、prev_released；值班表那班沒有這隻貓就是 null），
// 四個分頁的留言（帶 tab）與照片（照片庫的，直接上傳的與留言附的都有）。
// 這隻貓沒出現、也沒留言照片的班不回傳。cursor：這一批最舊的那天，下次從它往前；hasMore：更早還有沒有班
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

    let end = to && to < todayInTaipei() ? to : todayInTaipei()
    if (before && addDays(before, -1) < end) end = addDays(before, -1)
    let start = addDays(end, -(DAYS - 1))
    if (from && start < from) start = from
    if (from && end < from) return { entries: [], cursor: null, hasMore: false }

    const key = `"${cat}"`
    const rows = check(
        await supabase
            .from('shifts')
            .select(`id, date, shift, snapshot:cats->${key}`)
            .gte('date', start)
            .lte('date', end)
            .order('date', { ascending: false })
            .order('shift', { ascending: false }) // 同一天晚班在前
    )
    const ids = rows.map((r) => r.id)

    let olderQuery = supabase.from('shifts').select('id').lt('date', start).limit(1)
    if (from) olderQuery = olderQuery.gte('date', from)
    const [comments, photos, older] = await Promise.all([
        ids.length
            ? supabase.from('shift_comments').select(COMMENT_COLUMNS).eq('cat_id', cat).in('shift_id', ids).order('created_at')
            : { data: [] },
        ids.length
            ? supabase.from('shift_photos').select(LIBRARY_COLUMNS).eq('cat_id', cat).in('shift_id', ids).order('created_at')
            : { data: [] },
        olderQuery,
    ])
    const [messages, signed] = await Promise.all([
        toMessages(check(comments)),
        withSignedUrls(check(photos).map(withComment)),
    ])
    const hasMore = check(older).length > 0

    const entries = rows
        .map((r) => ({
            shift_id: r.id,
            date: r.date,
            shift: r.shift,
            intake: r.snapshot?.intake ?? null,
            prev_released: !!r.snapshot?.prev_released,
            in_shift: !!r.snapshot,
            comments: messages.filter((m) => m.shift_id === r.id),
            photos: signed
                .filter((p) => p.shift_id === r.id)
                .map((p) => ({ ...p, date: r.date, shift: r.shift })),
        }))
        .filter((e) => e.in_shift || e.comments.length || e.photos.length)

    return { entries, cursor: hasMore ? start : null, hasMore }
})
