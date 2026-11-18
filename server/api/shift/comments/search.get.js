import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isValidShiftQuery } from '~/server/utils/shift'
import { COMMENT_TABS } from '~/server/utils/comments'

const LIMIT = 50

// 唯讀：在一個頻道（一隻貓、一個分頁）裡搜尋留言文字，所有的班都找，只到正在看的這一班為止。
// 新的在前，最多 50 筆；畫面點了再用 channel API 載入、跳過去
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { catId, tab, date, shift } = getQuery(event)
    const q = String(getQuery(event).q || '').trim().slice(0, 50)
    const cat = Number(catId)
    if (!Number.isInteger(cat) || cat <= 0 || !COMMENT_TABS.includes(tab) || !isValidShiftQuery(date, shift) || !q) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    // % 與 _ 在 ilike 裡是萬用字元，使用者打的要當成一般字
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const { data, error } = await supabase
        .from('shift_comments')
        .select('id, body, for_next, author_name, created_at, edited_at, shifts!inner(date, shift)')
        .eq('cat_id', cat)
        .eq('tab', tab)
        .lte('shifts.date', date)
        .ilike('body', pattern)
        .order('created_at', { ascending: false })
        .limit(LIMIT)
    if (error) throw createError({ statusCode: 500, message: error.message })

    return data
        .filter((r) => !(shift === 'morning' && r.shifts.date === date && r.shifts.shift === 'night'))
        .map(({ shifts, ...row }) => ({ ...row, date: shifts.date, shift: shifts.shift }))
})
