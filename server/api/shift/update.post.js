import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

// 局部更新：前端只送改動的那幾格，由資料庫的 shift_apply 一次套用（同一班會排隊，不會互蓋）。
// ops 格式見 supabase/migrations/*_care_system.sql
const COLUMNS = ['cats', 'tasks', 'reports']
const TABS = ['arrive', 'care', 'meal', 'required']
const MAX_REPORT_LENGTH = 5000

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
        // 回報只能寫自己那一段：路徑一定是 [分頁, 自己的 user id]
        if (op.column === 'reports') {
            const [tab, owner, ...rest] = op.path
            if (!TABS.includes(tab) || rest.length > 0) {
                throw createError({ statusCode: 400, message: '資料格式錯誤' })
            }
            if (owner !== userId) {
                throw createError({ statusCode: 403, message: '只能修改自己的回報' })
            }
        }
    }

    // 回報的名字與時間由 server 填，前端只送內容
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

    // 有人按了放風：記下「放風是人決定的」，之後就不再照飲食的「放風」項目自動套用（見 syncWithSettings）
    for (const op of [...ops]) {
        if (op.column === 'cats' && op.path.length === 2 && op.path[1] === 'released') {
            ops.push({ column: 'cats', path: [op.path[0], 'released_set'], value: true })
        }
    }

    const { error } = await supabase.rpc('shift_apply', {
        p_shift_id: recordId,
        p_ops: ops,
        p_user: userId,
    })

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    // 回傳實際寫進去的 ops（回報補上了名字與時間、放風多了 released_set），畫面拿去廣播給其他人
    return { success: true, ops }
})
