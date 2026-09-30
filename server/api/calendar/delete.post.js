import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'

// 軟刪除：不真的 DELETE，只標記 deleted_at / deleted_by
// 只有管理員可以刪除
export default defineEventHandler(async (event) => {
    const userId = await requireAdmin(event)

    const { recordId } = await readBody(event)

    if (!recordId) {
        throw createError({ statusCode: 400, message: '缺少 recordId' })
    }

    const { error } = await supabase
        .from('calendar_events')
        .update({
            deleted_at: new Date().toISOString(),
            deleted_by: userId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .is('deleted_at', null)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return { success: true }
});
