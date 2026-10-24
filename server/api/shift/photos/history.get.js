import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { hasShiftBefore, isValidShiftQuery, shiftKey, shiftsBack, trimBeforeEarliest, withShiftIds } from '~/server/utils/shift'
import { LIBRARY_COLUMNS, PHOTO_TABS, withComment, withSignedUrls } from '~/server/utils/photos'
import { isPhotoKinds } from '~/composables/photoKinds'

const MAX_COUNT = 10

// 唯讀：🗂️ 照片庫往前翻。給定一班（不含），回傳「前面 count 班」：
//   shifts：這幾班（新的在前，帶 shifts 表的 id；沒照片的班也在，畫面才看得出滑到哪一天、也能補傳）
//   photos：這隻貓、這個分頁在這幾班的照片（直接上傳的與留言附的都有；帶 kinds 就只看有其中任一類的）
//   cursor：這一批最舊的那班，下次從它往前；hasMore：更早還有沒有班
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

    const window = shiftsBack(date, shift, count)
    const oldest = window[window.length - 1]
    const inWindow = new Set(window.map(shiftKey))

    let query = supabase
        .from('shift_photos')
        .select(`${LIBRARY_COLUMNS}, shifts!inner(date, shift)`)
        .eq('cat_id', cat)
        .eq('tab', tab)
        .gte('shifts.date', oldest.date)
        .lte('shifts.date', window[0].date)
        .order('created_at')
    if (kinds.length) query = query.overlaps('kinds', kinds)
    const { data, error } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })

    const [shifts, hasMore, signed] = await Promise.all([
        withShiftIds(window),
        hasShiftBefore(oldest),
        withSignedUrls(data.filter((r) => inWindow.has(shiftKey(r.shifts))).map(withComment)),
    ])
    return {
        shifts: await trimBeforeEarliest(shifts, hasMore),
        photos: signed.map(({ shifts: s, ...photo }) => ({ ...photo, date: s.date, shift: s.shift })),
        cursor: oldest,
        hasMore,
    }
})
