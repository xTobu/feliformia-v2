import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { data, error } = await supabase
        .from('minds')
        .select()
        .eq('active', true)

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return data.map((record) => ({
        recordId: record.id,
        note: record.note,
    }));
});