import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isValidShiftQuery } from '~/server/utils/shift'
import { COMMENT_COLUMNS, COMMENT_TABS, toMessages } from '~/server/utils/comments'

const PAGE_SIZE = 40

// 唯讀：一個頻道（一隻貓、一個分頁）的留言，只到正在看的這一班為止（看過去的班時，之後的班不出現）。
// 一次一頁、從新到舊；before 帶上一頁最舊那則的 created_at 就往前翻。
// 同一頁回傳後由畫面照「班 → 時間」排，補寫到過去某班的留言也會排在那一班裡
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { catId, tab, date, shift, before } = getQuery(event)
    const cat = Number(catId)
    if (!Number.isInteger(cat) || cat <= 0 || !COMMENT_TABS.includes(tab) || !isValidShiftQuery(date, shift)) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    let query = supabase
        .from('shift_comments')
        .select(COMMENT_COLUMNS)
        .eq('cat_id', cat)
        .eq('tab', tab)
        .lte('shifts.date', date)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
    if (before) {
        if (Number.isNaN(Date.parse(before))) throw createError({ statusCode: 400, message: '資料格式錯誤' })
        query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) throw createError({ statusCode: 500, message: error.message })

    // 正在看早班時，同一天的晚班還沒到
    const visible = data.filter((r) => !(shift === 'morning' && r.shifts.date === date && r.shifts.shift === 'night'))
    return {
        messages: await toMessages(visible),
        hasMore: data.length === PAGE_SIZE,
        cursor: data.length ? data[data.length - 1].created_at : null,
    }
})
