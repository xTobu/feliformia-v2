import { supabase } from '~/server/utils/supabase'

export default defineEventHandler(async () => {
    const { data, error } = await supabase.from('volunteers').select()

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return data
        .sort((a, b) => a.order - b.order)
        .map((record) => ({
            recordId: record.id,
            name: record.name,
        }))
})