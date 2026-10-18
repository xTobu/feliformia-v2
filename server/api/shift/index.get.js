import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import {
    applyCurrentCatOrder,
    buildSnapshot,
    isValidShiftQuery,
    syncWithSettings,
    todayInTaipei,
} from '~/server/utils/shift'

// ⚠️ 這支是 GET，但沒有這一班的記錄時會順手 INSERT 一筆（跟 regular / medicine 一樣），
// 不是唯讀的。只想讀前一班請用 /api/shift/previous。
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { date, shift } = getQuery(event)
    if (!isValidShiftQuery(date, shift)) {
        throw createError({ statusCode: 400, message: 'date 或 shift 格式錯誤' })
    }

    const existing = await findShift(date, shift)
    if (existing) {
        // 當天（含之後）的班：同步後台最新設定；過去的班保持當時的樣子
        const record = date >= todayInTaipei() ? await syncWithSettings(existing) : existing
        return toResponse(await applyCurrentCatOrder(record))
    }

    const { cats, tasks } = await buildSnapshot(date, shift)
    const { data, error } = await supabase
        .from('shifts')
        .insert({ date, shift, cats, tasks })
        .select()
        .single()

    // 兩個人同時打開同一班：unique (date, shift) 擋下後到的，改讀先建好的那筆
    if (error && error.code === '23505') {
        return toResponse(await applyCurrentCatOrder(await findShift(date, shift)))
    }
    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    return toResponse(data)
})

async function findShift(date, shift) {
    const { data, error } = await supabase
        .from('shifts')
        .select()
        .eq('date', date)
        .eq('shift', shift)
        .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data
}

function toResponse({ id, date, shift, cats, tasks, reports, member }) {
    return { recordId: id, date, shift, cats, tasks, reports: reports || {}, member }
}
