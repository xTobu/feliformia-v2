import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import dayjs from 'dayjs'

// 唯讀：給定這一班，回傳前一班的備註與放風的貓。前一班沒有記錄就回 null，不會建立
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

    const { data, error } = await supabase
        .from('shifts')
        .select('date, shift, note, member, cats')
        .eq('date', prev.date)
        .eq('shift', prev.shift)
        .maybeSingle()

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }
    if (!data) return { ...prev, exists: false, note: null, member: null, released: [] }

    return {
        ...prev,
        exists: true,
        note: data.note,
        member: data.member,
        released: data.cats.filter((c) => c.released).map((c) => c.cat_id),
    }
})
