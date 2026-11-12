import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isValidShiftQuery } from '~/server/utils/shift'
import { loadRosterSource, rosterUserIds } from '~/server/utils/roster'

// 唯讀：某天某班的值班志工暱稱（排班投票勾「值班」「快閃/協助」的人，規則同行事曆，見 server/utils/roster.js）。
// 值班表「LINE 發送至群組」的第二行用：「晚班・小美、阿明」
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { date, shift } = getQuery(event)
    if (!isValidShiftQuery(date, shift)) {
        throw createError({ statusCode: 400, message: 'date 或 shift 格式錯誤' })
    }

    const ids = rosterUserIds(await loadRosterSource([date]), date, shift)
    if (!ids.length) return { names: [] }

    const { data, error } = await supabase.from('profiles').select('id, nickname').in('id', ids)
    if (error) throw createError({ statusCode: 500, message: error.message })

    const nameOf = new Map(data.map((p) => [p.id, p.nickname]))
    return { names: ids.map((id) => nameOf.get(id)).filter(Boolean) }
})
