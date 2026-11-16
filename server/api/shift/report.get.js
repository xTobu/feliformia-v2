import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

// 一個班的值班回報。貓咪檔案「健康紀錄」的被提及欄點開來看用的。
//
// 刻意做成點了才查：/api/cats/timeline 只回「有沒有提到」的布林值，
// 不把整頁的回報內容一起送出去（一次七天十幾班，而且多半用不到）。
//
// 分頁名稱的真相來源是 pages/shift/[[tab]].vue 的 TAB_LABELS，這裡是副本。
const TAB_LABELS = { arrive: '飲食如廁', care: '醫療照護', meal: '備餐' }
const SHARED = '_shared'

export default defineEventHandler(async (event) => {
    await requireUser(event)

    const id = Number(getQuery(event).shiftId)
    if (!Number.isInteger(id) || id <= 0) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { data, error } = await supabase
        .from('shifts')
        .select('date, shift, reports')
        .eq('id', id)
        .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) throw createError({ statusCode: 404, message: '找不到這一班' })

    // 回報 2026-11-12 起每個分頁一段共編（_shared）；在那之前是一人一段，
    // key 是 user_id。兩種都要吃，舊的照時間排並標上名字
    const sections = []
    for (const [tab, label] of Object.entries(TAB_LABELS)) {
        const byKey = data.reports?.[tab] || {}
        const entries = (byKey[SHARED] ? [byKey[SHARED]] : Object.values(byKey))
            .map((r) => ({ name: r?.name || '', text: (r?.text || '').trim(), at: r?.at || '' }))
            .filter((r) => r.text)
            .sort((a, b) => a.at.localeCompare(b.at))

        for (const entry of entries) sections.push({ tab, label, name: entry.name, text: entry.text })
    }

    return { date: data.date, shift: data.shift, sections }
})
