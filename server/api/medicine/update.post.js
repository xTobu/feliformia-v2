import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import dayjs from 'dayjs'

export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const body = await readBody(event)
    const { recordId, date, shift, cats, note, member } = body

    const { data, error } = await supabase
        .from('medicines')
        .update({
            shift,
            date,
            cats: JSON.stringify(cats),
            note,
            member,
            updated_by: userId,
            modifiedTime: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
        })
        .eq('id', recordId)
        .select()

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return { success: true }
})