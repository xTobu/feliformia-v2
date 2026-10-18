import { supabase } from '~/server/utils/supabase'

// 新版值班記錄表（shifts）的快照。cats / tasks 存成「以 id 為 key 的物件」而不是陣列，
// 前端只送改動的那一格（/api/shift/update → shift_apply），兩人同時改不同的貓或項目不會互蓋。
//
// cats:  { "<cat_id>": { cat_id, name, location, sort, intake, released, prev_released,
//                        medical: { "<id>": { id, category, treatment, reason, end_date, sort, done, done_by, done_at } },
//                        diet:    { "<id>": { id, category, content, end_date, sort } } } }
// tasks: { "medical:<id>" | "diet:<id>": { kind, id, location, ...同上 }  不屬於單一貓咪的項目（location 空 = 全員）
//          "required:<id>": { kind, id, cat_id, location, content, end_date, sort, done, done_by, done_at } }
//          收尾：對象可以是某隻貓、全員（都空）、貓屋或某個位置，不管哪一種都是整班勾一次
// done_by / done_at：誰（暱稱）、幾點勾的
// prev_released：上一班離開時放風了（貓沒關籠，這班吃多少、排泄看不出來，觀察不用登記）。
//                記在這一班自己身上，之後回頭看也知道為什麼沒有觀察紀錄

const MAX = Number.MAX_SAFE_INTEGER

// 伺服器在 UTC，台灣凌晨 0～8 點時 UTC 還是前一天，要用台灣的日期判斷「當天」
export function todayInTaipei() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
}

// 早班的前一班是前一天晚班；晚班的前一班是同一天早班
export function previousShiftOf(date, shift) {
    if (shift === 'night') return { date, shift: 'morning' }
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return { date: d.toISOString().slice(0, 10), shift: 'night' }
}

export function isValidShiftQuery(date, shift) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && ['morning', 'night'].includes(shift)
}

// 到班時還沒填的樣子（欄位與 /regular 相同）
export function defaultIntake() {
    return {
        feed: true,
        feed_detail: 0,
        can: false,
        can_detail: 0,
        urine: false,
        feces: false,
        feces_warning: null,
    }
}

function check(result) {
    if (result.error) throw createError({ statusCode: 500, message: result.error.message })
    return result.data
}

const byKey = (list, keyOf) => Object.fromEntries(list.map((item) => [keyOf(item), item]))

// 上一班離開時放風的貓
async function previousReleased(date, shift) {
    const prev = previousShiftOf(date, shift)
    const row = check(
        await supabase
            .from('shifts')
            .select('cats')
            .eq('date', prev.date)
            .eq('shift', prev.shift)
            .maybeSingle()
    )
    return new Set(
        Object.values(row?.cats || {})
            .filter((c) => c.released)
            .map((c) => c.cat_id)
    )
}

// 這一班的快照：未領養的貓（照貓咪管理的順序）＋這一班、在期間內的飲食、醫療、收尾
export async function buildSnapshot(date, shift) {
    const forShift = (table) =>
        supabase.from(table).select().or(`shift.eq.both,shift.eq.${shift}`).order('sort_order')

    const [[cats, diet, medical, required], prevReleased] = await Promise.all([
        Promise.all([
            supabase.from('cat_profiles').select('id, name, location, adopted, sort_order'),
            forShift('diet_items'),
            forShift('medical_items'),
            forShift('required_items'),
        ]).then((results) => results.map(check)),
        previousReleased(date, shift),
    ])

    const inPeriod = (i) =>
        (!i.start_date || i.start_date <= date) && (!i.end_date || i.end_date >= date)

    const toItem = {
        medical: (i) => ({
            id: i.id,
            category: i.category,
            treatment: i.treatment,
            reason: i.reason || null,
            end_date: i.end_date || null,
            sort: i.sort_order ?? MAX,
            done: false,
            done_by: null,
            done_at: null,
        }),
        required: (i) => ({
            id: i.id,
            content: i.content,
            end_date: i.end_date || null,
            sort: i.sort_order ?? MAX,
            done: false,
            done_by: null,
            done_at: null,
        }),
        diet: (i) => ({
            id: i.id,
            category: i.category,
            content: i.content,
            end_date: i.end_date || null,
            sort: i.sort_order ?? MAX,
        }),
    }
    const lists = {
        medical: medical.filter(inPeriod),
        required: required.filter(inPeriod),
        diet: diet.filter(inPeriod),
    }
    const ofCat = (kind, catId) =>
        byKey(
            lists[kind].filter((i) => i.cat_id === catId).map(toItem[kind]),
            (i) => String(i.id)
        )

    const snapshotCats = byKey(
        cats
            .filter((c) => !c.adopted)
            .map((c) => ({
                cat_id: c.id,
                name: c.name,
                location: c.location || null,
                sort: c.sort_order ?? MAX,
                intake: defaultIntake(),
                released: false,
                prev_released: prevReleased.has(c.id),
                medical: ofCat('medical', c.id),
                diet: ofCat('diet', c.id),
            })),
        (c) => String(c.cat_id)
    )

    const tasks = {}
    for (const kind of ['medical', 'diet']) {
        for (const i of lists[kind].filter((i) => !i.cat_id)) {
            tasks[`${kind}:${i.id}`] = { kind, location: i.location || null, ...toItem[kind](i) }
        }
    }
    // 收尾：指定的貓已領養或刪掉就不列
    const activeCatIds = new Set(cats.filter((c) => !c.adopted).map((c) => c.id))
    for (const i of lists.required.filter((i) => !i.cat_id || activeCatIds.has(i.cat_id))) {
        tasks[`required:${i.id}`] = {
            kind: 'required',
            cat_id: i.cat_id || null,
            location: i.location || null,
            ...toItem.required(i),
        }
    }

    return { cats: snapshotCats, tasks }
}

// 有 done 的項目：用最新設定，照 id 保留「完成」與誰幾點勾的；
// 後台已刪除或過期、但這班已經打勾的留著當紀錄，沒打勾的拿掉。
// 沒有 done 的（飲食，只看）一律用最新的
function mergeItems(fresh = {}, stored = {}) {
    const merged = {}
    for (const [key, item] of Object.entries(fresh)) {
        const old = stored[key]
        merged[key] =
            old && 'done' in item
                ? { ...item, done: !!old.done, done_by: old.done_by ?? null, done_at: old.done_at ?? null }
                : item
    }
    for (const [key, item] of Object.entries(stored)) {
        if (!(key in merged) && item.done) merged[key] = item
    }
    return merged
}

// 這隻貓在這班有沒有被填過任何東西。intake 逐欄比對，不用 JSON.stringify：jsonb 會重排 key
function hasRecord(cat) {
    const anyDone = (items = {}) => Object.values(items).some((i) => i.done)
    const defaults = defaultIntake()
    const intakeChanged =
        !!cat.intake &&
        Object.keys(defaults).some((key) => (cat.intake[key] ?? null) !== defaults[key])
    return !!cat.released || anyDone(cat.medical) || intakeChanged
}

// 當天的班載入時，用後台現在的設定重建一份，再把這班已經填的資料併回去：
// 觀察、放風照舊；上一班放風照上一班現在的記錄；醫療、收尾照 id 保留「完成」；飲食一律用最新的；
// 這班建立後才領養或刪除的貓，有填過資料就留著。
// 不寫回資料庫（上一班放風例外，見 persistPrevReleased）：之後打勾時，前端只送那一格，shift_apply 會補上缺的層
export async function syncWithSettings(record) {
    const fresh = await buildSnapshot(record.date, record.shift)
    const stored = record.cats || {}

    const cats = {}
    for (const [key, cat] of Object.entries(fresh.cats)) {
        const old = stored[key]
        cats[key] = old
            ? {
                  ...cat,
                  intake: old.intake ?? cat.intake,
                  released: old.released ?? false,
                  medical: mergeItems(cat.medical, old.medical),
              }
            : cat
    }
    for (const [key, old] of Object.entries(stored)) {
        if (!(key in cats) && old.name && hasRecord(old)) cats[key] = old
    }

    return { ...record, cats, tasks: mergeItems(fresh.tasks, record.tasks || {}) }
}

// 快照建立後在貓咪管理調整順序，已經建立的班不會跟著變。
// 每次讀取都把 sort 換成「現在」的順序；已刪除的貓排最後
export async function applyCurrentCatOrder(record) {
    const rows = check(await supabase.from('cat_profiles').select('id, sort_order'))
    const order = new Map(rows.map((c) => [c.id, c.sort_order ?? MAX]))
    const cats = {}
    for (const [key, cat] of Object.entries(record.cats || {})) {
        cats[key] = { ...cat, sort: order.get(cat.cat_id) ?? MAX }
    }
    return { ...record, cats }
}

// 上一班放風要記在這一班身上。當天的班每次載入都重算（上一班可能晚一點才按放風），
// 跟資料庫存的不一樣才寫回去
export async function persistPrevReleased(stored, synced) {
    const ops = []
    for (const [key, cat] of Object.entries(synced.cats || {})) {
        const before = !!stored.cats?.[key]?.prev_released
        if (before === !!cat.prev_released) continue
        ops.push(
            {
                column: 'cats',
                path: [key],
                value: { cat_id: cat.cat_id, name: cat.name, location: cat.location, sort: cat.sort },
                if_missing: true,
            },
            { column: 'cats', path: [key, 'prev_released'], value: !!cat.prev_released }
        )
    }
    if (!ops.length) return
    const { error } = await supabase.rpc('shift_apply', {
        p_shift_id: stored.id,
        p_ops: ops,
        p_user: null,
    })
    if (error) throw createError({ statusCode: 500, message: error.message })
}
