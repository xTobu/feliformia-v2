import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import dayjs from 'dayjs'

// 唯讀：這一班的所有留言，加上前一班勾了「給下一班」的留言（交接用）
// 早班的前一班是前一天晚班；晚班的前一班是同一天早班
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { date, shift } = getQuery(event)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !['morning', 'night'].includes(shift)) {
        throw createError({ statusCode: 400, message: 'date 或 shift 格式錯誤' })
    }

    const prev =
        shift === 'morning'
            ? { date: dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'), shift: 'night' }
            : { date, shift: 'morning' }

    const { data: shifts, error: shiftError } = await supabase
        .from('shifts')
        .select('id, date, shift')
        .or(
            `and(date.eq.${date},shift.eq.${shift}),and(date.eq.${prev.date},shift.eq.${prev.shift})`
        )
    if (shiftError) throw createError({ statusCode: 500, message: shiftError.message })

    const currentId = shifts.find((s) => s.date === date && s.shift === shift)?.id
    const prevId = shifts.find((s) => s.date === prev.date && s.shift === prev.shift)?.id

    const ids = [currentId, prevId].filter(Boolean)
    if (ids.length === 0) return { current: [], previous: [] }

    const { data, error } = await supabase
        .from('shift_comments')
        .select('id, shift_id, cat_id, tab, body, for_next, author_name, created_at')
        .in('shift_id', ids)
        .order('created_at')
    if (error) throw createError({ statusCode: 500, message: error.message })

    return {
        current: data.filter((c) => c.shift_id === currentId),
        previous: data.filter((c) => c.shift_id === prevId && c.for_next),
    }
})
