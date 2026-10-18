import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { isValidShiftQuery, previousShiftOf } from '~/server/utils/shift'

// 唯讀：給定這一班，回傳前一班的各分頁回報、放風的貓、沒勾完的收尾。前一班沒有記錄就回空的，不會建立
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { date, shift } = getQuery(event)
    if (!isValidShiftQuery(date, shift)) {
        throw createError({ statusCode: 400, message: 'date 或 shift 格式錯誤' })
    }

    const prev = previousShiftOf(date, shift)
    const { data, error } = await supabase
        .from('shifts')
        .select('reports, cats, tasks')
        .eq('date', prev.date)
        .eq('shift', prev.shift)
        .maybeSingle()

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }
    if (!data) {
        return { ...prev, exists: false, reports: {}, released: [], unfinished: [] }
    }

    return {
        ...prev,
        exists: true,
        // { 分頁: { user_id: { name, text, at } } }
        reports: data.reports || {},
        released: Object.values(data.cats || {})
            .filter((c) => c.released)
            .map((c) => c.cat_id),
        // 收尾清單裡沒勾的（只看建立當下的快照，跟後台現在的設定無關），前面標對象：「餅乾：剪指甲」
        unfinished: Object.values(data.tasks || {})
            .filter((t) => t.kind === 'required' && !t.done)
            .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
            .map((t) => {
                const target = t.cat_id ? data.cats?.[t.cat_id]?.name : t.location || '全員'
                return target ? `${target}：${t.content}` : t.content
            }),
    }
})
