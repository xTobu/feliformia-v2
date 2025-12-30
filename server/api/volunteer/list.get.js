import { supabase } from '~/server/utils/supabase'

export default defineEventHandler(async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, email')

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return data
        .map((record) => ({
            recordId: record.id,
            name: record.nickname || record.email,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
});