import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isValidShiftQuery, previousShiftOf } from '~/server/utils/shift'
import { PHOTO_COLUMNS, PHOTO_TABS, withSignedUrls } from '~/server/utils/photos'
import { isPhotoKinds } from '~/composables/photoKinds'

const MAX_COUNT = 10

// 唯讀：🗂️ 照片牆往前翻。給定一班（不含），回傳這隻貓、這個分頁「前面 count 班」的照片（留言附的不算），
// 加上 cursor（這一批最舊的那班，下次從它往前）與 hasMore（更早還有沒有照片）。
// 帶 kinds（逗號分隔）就只看有其中任一類的照片（照片牆上方的篩選），hasMore 也只算這些。
// 這一班自己的照片照舊由 GET /api/shift/photos 拿
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { catId, tab, date, shift } = getQuery(event)
    const kinds = String(getQuery(event).kinds || '').split(',').filter(Boolean)
    const cat = Number(catId)
    const count = Number(getQuery(event).count ?? 5)
    if (
        !Number.isInteger(cat) ||
        cat <= 0 ||
        !PHOTO_TABS.includes(tab) ||
        !isValidShiftQuery(date, shift) ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > MAX_COUNT ||
        !isPhotoKinds(tab, kinds)
    ) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    // 往前數 count 班
    const window = []
    let cursor = { date, shift }
    for (let i = 0; i < count; i++) {
        cursor = previousShiftOf(cursor.date, cursor.shift)
        window.push(cursor)
    }
    const oldest = window[window.length - 1]
    const keyOf = (s) => `${s.date}-${s.shift}`
    const inWindow = new Set(window.map(keyOf))

    const base = () => {
        const query = supabase
            .from('shift_photos')
            .select(`${PHOTO_COLUMNS}, shifts!inner(date, shift)`)
            .eq('cat_id', cat)
            .eq('tab', tab)
            .is('comment_id', null)
        return kinds.length ? query.overlaps('kinds', kinds) : query
    }

    const { data, error } = await base()
        .gte('shifts.date', oldest.date)
        .lte('shifts.date', window[0].date)
        .order('created_at')
    if (error) throw createError({ statusCode: 500, message: error.message })
    const rows = data.filter((r) => inWindow.has(keyOf(r.shifts)))

    // 更早還有沒有：前一天以前的，或最舊那班是晚班時同一天的早班
    const earlier = [base().lt('shifts.date', oldest.date).limit(1)]
    if (oldest.shift === 'night') earlier.push(base().eq('shifts.date', oldest.date).eq('shifts.shift', 'morning').limit(1))
    const results = await Promise.all(earlier)
    const failed = results.find((r) => r.error)
    if (failed) throw createError({ statusCode: 500, message: failed.error.message })

    const signed = await withSignedUrls(rows)
    return {
        photos: signed.map(({ shifts, ...photo }) => ({ ...photo, date: shifts.date, shift: shifts.shift })),
        cursor: oldest,
        hasMore: results.some((r) => r.data.length > 0),
    }
})
