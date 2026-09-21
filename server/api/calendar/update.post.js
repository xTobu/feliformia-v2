import { serverSupabaseUser } from '#supabase/server'
import { supabase } from '~/server/utils/supabase'

// 有 recordId 就更新、沒有就新增
export default defineEventHandler(async (event) => {
    const user = await serverSupabaseUser(event)
    if (!user) {
        throw createError({ statusCode: 401, message: '請先登入' })
    }

    const body = await readBody(event)
    const { recordId, date, timeStart, timeEnd, type, notifyRoles, owner, content } = body

    if (!date) throw createError({ statusCode: 400, message: '缺少日期' })
    if (!timeStart || !timeEnd) throw createError({ statusCode: 400, message: '缺少活動時間' })
    if (!type) throw createError({ statusCode: 400, message: '缺少類型' })
    if (!notifyRoles?.length) throw createError({ statusCode: 400, message: '缺少提示對象' })
    if (!content?.trim()) throw createError({ statusCode: 400, message: '缺少內容' })

    const roles = Array.isArray(notifyRoles) ? notifyRoles : []

    const payload = {
        date,
        time_start: timeStart,
        time_end: timeEnd,
        type,
        notify_roles: roles,
        // owner 是 uuid 欄位，空字串會讓 Postgres 噴錯，一律轉 null
        owner: roles.includes('owner') && owner ? owner : null,
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
        .insert([{ ...payload, created_by: user.sub }])
        .select('id')
        .limit(1)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return { success: true, recordId: data[0].id }
});
