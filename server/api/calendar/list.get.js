import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

// 依日期區間撈活動列表（不含軟刪除）
// query: start / end，皆為 YYYY-MM-DD
// 寫入要管理員（update / delete），讀取只要登入 —— 志工唯讀。
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { start, end } = getQuery(event)

    if (!start || !end) {
        throw createError({ statusCode: 400, message: '缺少 start 或 end' })
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .select()
        .gte('date', start)
        .lte('date', end)
        .is('deleted_at', null)
        .order('date', { ascending: true })
        .order('time_start', { ascending: true })
        .limit(500)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    // snake_case 轉成前端用的 camelCase
    return data.map((record) => ({
        recordId: record.id,
        date: record.date,
        timeStart: record.time_start,
        timeEnd: record.time_end,
        type: record.type,
        notifyRoles: record.notify_roles || [],
        owners: record.owners || [],
        content: record.content || '',
    }))
});
