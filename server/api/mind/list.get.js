import { supabase } from '~/server/utils/supabase'

export default defineEventHandler(async () => {
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