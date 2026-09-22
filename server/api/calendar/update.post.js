import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'

// 有 recordId 就更新、沒有就新增
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { recordId, date, timeStart, timeEnd, type, notifyRoles, owners, content } = body

    // 新增與編輯都只有管理員可以做
    const userId = await requireAdmin(event)

    if (!date) throw createError({ statusCode: 400, message: '缺少日期' })
    if (!timeStart || !timeEnd) throw createError({ statusCode: 400, message: '缺少活動時間' })
    if (!type) throw createError({ statusCode: 400, message: '缺少類型' })
    if (!notifyRoles?.length) throw createError({ statusCode: 400, message: '缺少活動人員' })
    if (!content?.trim()) throw createError({ statusCode: 400, message: '缺少內容' })

    const roles = Array.isArray(notifyRoles) ? notifyRoles : []

    const payload = {
        date,
        time_start: timeStart,
        time_end: timeEnd,
        type,
        notify_roles: roles,
        // 沒勾「負責人」就不存名單；濾掉空值避免塞進 null / ''
        owners: roles.includes('owner') && Array.isArray(owners)
            ? owners.filter(Boolean)
            : [],
        content,
        updated_at: new Date().toISOString(),
    }

    if (recordId) {
        const { error } = await supabase
            .from('calendar_events')
            .update(payload)
            .eq('id', recordId)

        if (error) {
            throw createError({ statusCode: 500, message: error.message })
        }

        return { success: true, recordId }
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .insert([{ ...payload, created_by: userId }])
        .select('id')
        .limit(1)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return { success: true, recordId: data[0].id }
});
