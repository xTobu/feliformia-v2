import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { todayInTaipei, unfinishedOf } from '~/server/utils/shift'
import { COMMENT_COLUMNS, toMessages } from '~/server/utils/comments'
import { LIBRARY_COLUMNS, withComment, withSignedUrls } from '~/server/utils/photos'

const DAYS = 7 // 一次往前 7 天（14 班）
const TABS = ['arrive', 'care', 'meal', 'required']

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

// 這一班、這隻貓自己的未完成（規則同值班表的「前班未完成」，unfinishedOf）：
// 醫療、隨餐藥、觀察管理（全員／位置的觀察項目也算在每隻貓身上）、對象是這隻貓的收尾。
// 全員／位置的醫療、隨餐藥、收尾不是這隻貓的事，不算
function catUnfinished(catId, snapshot, tasks, photos) {
    const ownRequired = new Set(
        Object.entries(tasks || {})
            .filter(([, t]) => t.kind === 'required' && t.cat_id === catId)
            .map(([key]) => key)
    )
    const own = (row) => row.key.includes(`:${catId}:`) || ownRequired.has(row.key)
    const all = unfinishedOf({ cats: { [catId]: snapshot }, tasks }, photos)
    return TABS.flatMap((tab) => (all[tab] || []).filter(own).map(({ key, content, tag }) => ({ key, tab, content, tag })))
}

// 唯讀：貓咪檔案的日常。一班一段，新的在前，一次 7 天往前翻：
//   沒帶 before：從今天（或 to）開始；帶 before：從那天（不含）再往前
//   from / to：只看這段日期（含頭尾）
// 每一段：
//   值班：這隻貓的飲食如廁（intake）、前班放風（prev_released）、這班放風（released）、未完成（unfinished）；
//         值班表那班沒有這隻貓就沒有這些（in_shift: false）。還在進行的班標 ongoing，未完成照樣列
//   comments：四個分頁的留言（帶 tab，附的照片在 photos 裡）
//   photos：照片庫的，直接上傳的與留言附的都有（留言附的帶 comment：那則留言）
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

    const today = todayInTaipei()
    let end = to && to < today ? to : today
    if (before && addDays(before, -1) < end) end = addDays(before, -1)
    let start = addDays(end, -(DAYS - 1))
    if (from && start < from) start = from
    if (from && end < from) return { entries: [], cursor: null, hasMore: false }

    const rows = check(
        await supabase
            .from('shifts')
            .select(`id, date, shift, tasks, snapshot:cats->"${cat}"`)
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
    const allPhotos = check(photos)
    const [messages, signed] = await Promise.all([
        toMessages(check(comments)),
        withSignedUrls(allPhotos.map(withComment)),
    ])
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
                // 觀察管理拍了沒要看這一班的照片（直接上傳的與留言附的都算）。進行中的班也列（還剩哪些事）
                unfinished: snapshot
                    ? catUnfinished(cat, snapshot, r.tasks, allPhotos.filter((p) => p.shift_id === r.id))
                    : [],
                comments: messages.filter((m) => m.shift_id === r.id),
                photos: signed.filter((p) => p.shift_id === r.id),
            }
        })
        .filter((e) => e.in_shift || e.comments.length || e.photos.length)

    return { entries, cursor: hasMore ? start : null, hasMore }
})
