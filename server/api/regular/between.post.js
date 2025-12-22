import { supabase } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { dateStart, dateEnd } = body

    const { data, error } = await supabase
        .from('regulars')
        .select()
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .limit(100)
        .order('date', { ascending: true })
        .order('shift', { ascending: true })

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    if (data.length === 0) {
        return []
    }

    return data.map(({ id, ...rest }) => ({
        ...rest,
        recordId: id,
        cats: JSON.parse(rest.cats),
    }))
});
