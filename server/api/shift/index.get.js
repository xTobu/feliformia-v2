import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

// ⚠️ 這支是 GET，但沒有這一班的記錄時會順手 INSERT 一筆（跟 regular / medicine 一樣），
// 不是唯讀的。只想讀前一班請用 /api/shift/previous。
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { date, shift } = getQuery(event)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !['morning', 'night'].includes(shift)) {
        throw createError({ statusCode: 400, message: 'date 或 shift 格式錯誤' })
    }

    const existing = await findShift(date, shift)
    if (existing) return toResponse(existing)

    const { cats, tasks } = await buildSnapshot(date, shift)
    const { data, error } = await supabase
        .from('shifts')
        .insert({ date, shift, cats, tasks })
        .select()
        .single()

    // 兩個人同時打開同一班：unique (date, shift) 擋下後到的，改讀先建好的那筆
    if (error && error.code === '23505') {
        return toResponse(await findShift(date, shift))
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

function toResponse({ id, ...rest }) {
    return { ...rest, recordId: id }
}

// 貓咪管理的名稱可能是「名字：說明」，只取冒號前面
function shortName(name) {
    return (name || '').split(/[：:]/)[0]
}

// 這一班的快照：未領養的貓（照貓咪管理的順序）＋這一班、在期間內的飲食與醫療項目。
// 建好之後不再跟後台同步，改後台設定只影響之後才建立的班
async function buildSnapshot(date, shift) {
    const [{ data: catRows, error: catError }, { data: notices, error: noticeError }] =
        await Promise.all([
            supabase.from('cats').select('id, name, room, diet_note, adopted, order'),
            supabase
                .from('notices')
                .select()
                .or(`shift.eq.both,shift.eq.${shift}`)
                .order('order'),
        ])
    if (catError) throw createError({ statusCode: 500, message: catError.message })
    if (noticeError) throw createError({ statusCode: 500, message: noticeError.message })

    const active = notices.filter(
        (n) =>
            (!n.start_date || n.start_date <= date) &&
            (!n.end_date || n.end_date >= date)
    )
    const item = (n) => ({
        notice_id: n.id,
        treatment: n.treatment,
        reason: n.reason || null,
        end_date: n.end_date || null,
        done: false,
    })

    const cats = catRows
        .filter((c) => c.name && !c.adopted)
        .sort((a, b) => a.order - b.order)
        .map((c) => {
            const mine = active.filter((n) => n.cat_id === c.id)
            const of = (category) => mine.filter((n) => n.category === category).map(item)
            const meals = mine
                .filter((n) => n.category === 'meal')
                .map((n) => ({ notice_id: n.id, treatment: n.treatment, reason: n.reason || null }))

            return {
                cat_id: c.id,
                name: shortName(c.name),
                room: c.room || null,
                // 到班：上一班放的飯吃了多少、排泄（欄位與 /regular 相同）
                intake: {
                    feed: true,
                    feed_detail: 0,
                    can: false,
                    can_detail: 0,
                    urine: false,
                    feces: false,
                    feces_warning: null,
                },
                // 照護
                medical: [...of('medical'), ...of('other')],
                // 離班：還沒在飲食管理設定主食的貓，退回貓咪資料上的飲食備註
                meals: meals.length
                    ? meals
                    : c.diet_note?.trim()
                      ? [{ notice_id: null, treatment: c.diet_note.trim(), reason: null }]
                      : [],
                with_meal: of('with_meal'),
                released: false,
            }
        })

    // 對不到貓的項目（全員、小房間…）。主食只對單一貓咪有意義，這裡不收
    const tasks = active
        .filter((n) => !n.cat_id && n.category !== 'meal')
        .map((n) => ({ ...item(n), name: n.name, category: n.category || 'medical' }))

    return { cats, tasks }
}
