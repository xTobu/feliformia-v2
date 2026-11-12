import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { nextShiftOf } from '~/server/utils/shift'

// 局部更新：前端只送改動的那幾格，由資料庫的 shift_apply 一次套用（同一班會排隊，不會互蓋）。
// ops 格式見 supabase/migrations/*_care_system.sql
const COLUMNS = ['cats', 'tasks', 'reports']
// 收尾分頁 2026-11-12 拿掉了，不再收收尾的回報
// 備餐 2026-11-12 起沒有回報
const TABS = ['arrive', 'care']
const MAX_REPORT_LENGTH = 5000
// 回報 2026-11-12 起每個分頁一段，大家共編：存在 reports.<分頁>._shared（後存的蓋過先存的）。
// 以前一人一段的 reports.<分頁>.<user_id> 留著，畫面上合併顯示，不再寫入
const SHARED_REPORT = '_shared'

export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const { recordId, ops } = await readBody(event)
    if (!recordId || !Array.isArray(ops) || ops.length === 0 || ops.length > 100) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }
    for (const op of ops) {
        const pathOk =
            Array.isArray(op?.path) &&
            op.path.length > 0 &&
            op.path.length <= 4 &&
            op.path.every((p) => typeof p === 'string' && p.length > 0)
        if (!COLUMNS.includes(op?.column) || !pathOk) {
            throw createError({ statusCode: 400, message: '資料格式錯誤' })
        }
        // 回報只能寫共用的那一段：路徑一定是 [分頁, '_shared']
        if (op.column === 'reports') {
            const [tab, key, ...rest] = op.path
            if (!TABS.includes(tab) || key !== SHARED_REPORT || rest.length > 0) {
                throw createError({ statusCode: 400, message: '資料格式錯誤' })
            }
        }
    }

    // 回報的最後編輯者與時間由 server 填，前端只送內容
    const reportOps = ops.filter((op) => op.column === 'reports')
    if (reportOps.length) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', userId)
            .maybeSingle()
        const at = new Date().toISOString()
        for (const op of reportOps) {
            op.value = {
                name: profile?.nickname || null,
                text: String(op.value?.text ?? '').slice(0, MAX_REPORT_LENGTH),
                at,
            }
            delete op.if_missing
        }
    }

    // 有人按了放風：記下「放風是人決定的」，之後就不再照觀察管理的「放風」項目自動套用（見 syncWithSettings）
    const releasedOps = ops.filter((op) => op.column === 'cats' && op.path.length === 2 && op.path[1] === 'released')
    for (const op of releasedOps) {
        ops.push({ column: 'cats', path: [op.path[0], 'released_set'], value: true })
    }

    const { error } = await supabase.rpc('shift_apply', {
        p_shift_id: recordId,
        p_ops: ops,
        p_user: userId,
    })

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    // 這班已經存好了：下一班沒跟上只記 log，不讓這次存檔變成失敗（下一班當天載入時也會再重算）
    if (releasedOps.length) {
        try {
            await syncNextPrevReleased(recordId, releasedOps)
        } catch (e) {
            console.error('sync next prev_released error:', e)
        }
    }

    // 回傳實際寫進去的 ops（回報補上了名字與時間、放風多了 released_set），畫面拿去廣播給其他人
    return { success: true, ops }
})

// 放風改了：下一班已經開了的話，把那隻貓的「前班放風」（prev_released）一起改掉。
// 當天的班每次載入也會重算（persistReleased），但過了午夜補按、或下一班是過去的班就不會再算，要在這裡補
async function syncNextPrevReleased(recordId, releasedOps) {
    const { data: current, error } = await supabase.from('shifts').select('date, shift').eq('id', recordId).maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!current) return

    const next = nextShiftOf(current.date, current.shift)
    const { data: nextRow, error: nextError } = await supabase
        .from('shifts')
        .select('id, cats')
        .eq('date', next.date)
        .eq('shift', next.shift)
        .maybeSingle()
    if (nextError) throw createError({ statusCode: 500, message: nextError.message })
    if (!nextRow) return

    // 只改下一班快照裡有的貓（貓不在那一班就不用管）
    const nextOps = releasedOps
        .filter((op) => nextRow.cats?.[op.path[0]])
        .map((op) => ({ column: 'cats', path: [op.path[0], 'prev_released'], value: !!op.value }))
    if (!nextOps.length) return

    const { error: applyError } = await supabase.rpc('shift_apply', {
        p_shift_id: nextRow.id,
        p_ops: nextOps,
        p_user: null,
    })
    if (applyError) throw createError({ statusCode: 500, message: applyError.message })
}
