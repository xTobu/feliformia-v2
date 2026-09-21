import { serverSupabaseUser } from '#supabase/server'
import { supabase } from '~/server/utils/supabase'

// 軟刪除：不真的 DELETE，只標記 deleted_at / deleted_by
export default defineEventHandler(async (event) => {
    const user = await serverSupabaseUser(event)
    if (!user) {
        throw createError({ statusCode: 401, message: '請先登入' })
    }

    const { recordId } = await readBody(event)

    if (!recordId) {
        throw createError({ statusCode: 400, message: '缺少 recordId' })
    }

    const { error } = await supabase
        .from('calendar_events')
        .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user.sub,
            updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .is('deleted_at', null)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return { success: true }
});
