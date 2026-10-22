import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isValidShiftQuery } from '~/server/utils/shift'
import { PHOTO_COLUMNS, withSignedUrls } from '~/server/utils/photos'
import { COMMENT_TABS } from '~/server/utils/comments'

const LIMIT = 300

// 唯讀：一個頻道（一隻貓、一個分頁）留言裡的所有照片，只到正在看的這一班為止，從新到舊。
// 每張帶著它的留言（點照片可以看那則留言、跳過去）
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { catId, tab, date, shift } = getQuery(event)
    const cat = Number(catId)
    if (!Number.isInteger(cat) || cat <= 0 || !COMMENT_TABS.includes(tab) || !isValidShiftQuery(date, shift)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { data, error } = await supabase
        .from('shift_photos')
        .select(
            `${PHOTO_COLUMNS}, comment_id, shifts!inner(date, shift), shift_comments!inner(id, body, author_name, created_at, edited_at)`
        )
        .eq('cat_id', cat)
        .eq('tab', tab)
        .not('comment_id', 'is', null)
        .lte('shifts.date', date)
        .order('created_at', { ascending: false })
        .limit(LIMIT)
    if (error) throw createError({ statusCode: 500, message: error.message })

    const visible = data.filter((r) => !(shift === 'morning' && r.shifts.date === date && r.shifts.shift === 'night'))
    const signed = await withSignedUrls(visible)
    return signed.map(({ shifts, shift_comments, ...photo }) => ({
        ...photo,
        date: shifts.date,
        shift: shifts.shift,
        comment: shift_comments,
    }))
})
