import { supabase } from '~/server/utils/supabase'
import { isObserveDone } from '~/composables/observeItems'

// 新版值班記錄表（shifts）的快照。cats / tasks 存成「以 id 為 key 的物件」而不是陣列，
// 前端只送改動的那一格（/api/shift/update → shift_apply），兩人同時改不同的貓或項目不會互蓋。
//
// cats:  { "<cat_id>": { cat_id, name, location, sort, intake, released, prev_released,
//                        medical: { "<id>": { id, category, treatment, reason, end_date, sort, done, done_by, done_at } },
//                        diet:    { "<id>": { id, category, content, end_date, sort[, done, done_by, done_at] } } } }
//        飲食只看不勾，只有「隨餐藥」要打勾（多 done / done_by / done_at）
// tasks: { "medical:<id>" | "diet:<id>": { kind, id, location, ...同上 }  不屬於單一貓咪的項目（location 空 = 全員）
//          "required:<id>": { kind, id, cat_id, location, content, end_date, sort, done, done_by, done_at } }
//          收尾：對象可以是某隻貓、全員（都空）、貓屋或某個位置，不管哪一種都是整班勾一次
// done_by / done_at：誰（暱稱）、幾點勾的
// prev_released：上一班離開時放風了（貓沒關籠，這班吃多少、排泄看不出來，觀察不用登記）。
//                記在這一班自己身上，之後回頭看也知道為什麼沒有觀察紀錄
// released_set：有人在這班按過放風。沒按過的，放風照飲食的「放風」項目（長期固定放風）自動套用，
//               後台加了或刪了項目，當天已開的班也會跟著變；按過一次就照人選的，不再自動改

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

// 班的 key（date-shift），比大小用 shiftOrder
export const shiftKey = ({ date, shift }) => `${date}-${shift}`
// 可以排序的版本：同一天早班在前
export const shiftOrder = ({ date, shift }) => `${date}-${shift === 'night' ? 1 : 0}`

// 從某一班往前數 count 班，新的在前。include 為 true 時包含這一班本身
export function shiftsBack(date, shift, count, include = false) {
    const list = []
    let cursor = { date, shift }
    if (include) list.push(cursor)
    while (list.length < count) {
        cursor = previousShiftOf(cursor.date, cursor.shift)
        list.push(cursor)
    }
    return list
}

// 從某一班（不含）往前，一直數到 until 那班（含），最多 max 班。新的在前
export function shiftsBackUntil(date, shift, until, max = 400) {
    const list = []
    let cursor = { date, shift }
    const target = shiftOrder(until)
    while (list.length < max) {
        cursor = previousShiftOf(cursor.date, cursor.shift)
        list.push(cursor)
        if (shiftOrder(cursor) <= target) break
    }
    return list
}

// 一串班在 shifts 表裡的 id（還沒人打開過的班沒有紀錄，id 是 null）
export async function withShiftIds(list) {
    if (!list.length) return []
    const dates = list.map((s) => s.date).sort()
    const { data, error } = await supabase
        .from('shifts')
        .select('id, date, shift')
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])
    if (error) throw createError({ statusCode: 500, message: error.message })
    const idOf = new Map(data.map((r) => [shiftKey(r), r.id]))
    return list.map((s) => ({ ...s, id: idOf.get(shiftKey(s)) ?? null }))
}

// 最早有紀錄的那一班（新版值班記錄表開始用的那天）；往前翻時比它早的班不顯示
export async function earliestShift() {
    const { data, error } = await supabase
        .from('shifts')
        .select('date, shift')
        .order('date')
        .order('shift') // 'morning' 排在 'night' 前
        .limit(1)
        .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data
}

// 一批班裡比最早那班還早的拿掉（沒有更早的班時才需要）
export async function trimBeforeEarliest(list, hasMore) {
    if (hasMore) return list
    const earliest = await earliestShift()
    return earliest ? list.filter((s) => shiftOrder(s) >= shiftOrder(earliest)) : list
}

// 比這一班更早還有沒有班的紀錄（往上滑到最早的班就停）
export async function hasShiftBefore({ date, shift }) {
    const queries = [supabase.from('shifts').select('id').lt('date', date).limit(1)]
    if (shift === 'night') queries.push(supabase.from('shifts').select('id').eq('date', date).eq('shift', 'morning').limit(1))
    const results = await Promise.all(queries)
    const failed = results.find((r) => r.error)
    if (failed) throw createError({ statusCode: 500, message: failed.error.message })
    return results.some((r) => r.data.length > 0)
}

export function isValidShiftQuery(date, shift) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && ['morning', 'night'].includes(shift)
}

// 飲食裡要打勾的類別：拌進飯裡的藥，放碗就可以走
export const MEAL_MED = '隨餐藥'

// 飲食裡的長期固定放風：期間內新開的班，放風預設打開
export const RELEASE = '放風'

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

const inPeriodOn = (date) => (i) =>
    (!i.start_date || i.start_date <= date) && (!i.end_date || i.end_date >= date)

// 飲食的「放風」項目（這一班、在期間內的）→ 判斷某隻貓預設要不要放風：
// 指定這隻貓的、全員的、或牠所在位置的都算
function releaseRule(dietItems) {
    const items = dietItems.filter((i) => i.category === RELEASE)
    return (catId, location) =>
        items.some((i) => i.cat_id === catId || (!i.cat_id && (!i.location || i.location === location)))
}

async function fetchReleaseRule(date, shift) {
    const rows = check(
        await supabase
            .from('diet_items')
            .select('cat_id, location, category, start_date, end_date')
            .eq('category', RELEASE)
            .or(`shift.eq.both,shift.eq.${shift}`)
    )
    return releaseRule(rows.filter(inPeriodOn(date)))
}

// 一班裡放風的貓（cat_id 的 Set）。當天（含之後）的班，沒人按過放風的貓照「放風」項目算，
// 跟這一班載入時看到的一樣（就算那班載入後後台才加項目、還沒人重新打開過）；過去的班照存的
export async function releasedCatIds(record) {
    const cats = Object.values(record?.cats || {})
    const untouched = cats.some((c) => !c.released_set)
    const rule =
        untouched && record.date >= todayInTaipei()
            ? await fetchReleaseRule(record.date, record.shift)
            : null
    return new Set(
        cats
            .filter((c) => (rule && !c.released_set ? rule(c.cat_id, c.location) : !!c.released))
            .map((c) => c.cat_id)
    )
}

// 上一班離開時放風的貓
async function previousReleased(date, shift) {
    const prev = previousShiftOf(date, shift)
    const row = check(
        await supabase
            .from('shifts')
            .select('date, shift, cats')
            .eq('date', prev.date)
            .eq('shift', prev.shift)
            .maybeSingle()
    )
    return row ? releasedCatIds(row) : new Set()
}

// 這一班的快照：未領養的貓（照貓咪管理的順序）＋這一班、在期間內的飲食、醫療、收尾、觀察
export async function buildSnapshot(date, shift) {
    const forShift = (table) =>
        supabase.from(table).select().or(`shift.eq.both,shift.eq.${shift}`).order('sort_order')

    const [[cats, diet, medical, required, observe], prevReleased] = await Promise.all([
        Promise.all([
            supabase.from('cat_profiles').select('id, name, location, adopted, sort_order'),
            forShift('diet_items'),
            forShift('medical_items'),
            forShift('required_items'),
            forShift('observe_items'),
        ]).then((results) => results.map(check)),
        previousReleased(date, shift),
    ])

    const inPeriod = inPeriodOn(date)

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
            ...(i.category === MEAL_MED ? { done: false, done_by: null, done_at: null } : {}),
        }),
        // 觀察：沒有 done，有沒有拍是看這一班的照片（composables/observeItems.js）
        observe: (i) => ({
            id: i.id,
            category: i.category,
            content: i.content || '',
            end_date: i.end_date || null,
            sort: i.sort_order ?? MAX,
        }),
    }
    const lists = {
        medical: medical.filter(inPeriod),
        required: required.filter(inPeriod),
        diet: diet.filter(inPeriod),
        observe: observe.filter(inPeriod),
    }
    // 有「放風」飲食項目的貓（自己的、全員的、所在位置的），放風預設打開
    const releasedByDefault = releaseRule(lists.diet)

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
                released: releasedByDefault(c.id, c.location || null),
                prev_released: prevReleased.has(c.id),
                medical: ofCat('medical', c.id),
                diet: ofCat('diet', c.id),
                observe: ofCat('observe', c.id),
            })),
        (c) => String(c.cat_id)
    )

    const tasks = {}
    for (const kind of ['medical', 'diet', 'observe']) {
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
    return !!cat.released || anyDone(cat.medical) || anyDone(cat.diet) || intakeChanged
}

// 當天的班載入時，用後台現在的設定重建一份，再把這班已經填的資料併回去：
// 觀察照舊；放風有人按過就照舊，沒人按過就照「放風」飲食項目重算；上一班放風照上一班現在的記錄；醫療、收尾、隨餐藥照 id 保留「完成」；其他飲食一律用最新的；
// 這班建立後才領養或刪除的貓，有填過資料就留著。
// 不寫回資料庫（放風、上一班放風例外，見 persistReleased）：之後打勾時，前端只送那一格，shift_apply 會補上缺的層
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
                  released: old.released_set ? !!old.released : cat.released,
                  ...(old.released_set ? { released_set: true } : {}),
                  medical: mergeItems(cat.medical, old.medical),
                  diet: mergeItems(cat.diet, old.diet),
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

// 放風與上一班放風要存回這一班：下一班看「上一班放風」讀的是資料庫。當天的班每次載入都重算
// （上一班可能晚一點才按放風、後台可能剛加了「放風」項目），跟資料庫存的不一樣才寫回去。
// 放風只寫沒人按過的貓；載入的同時剛好有人按放風的話，以 released_set 那筆為準（下次載入不會再蓋）
export async function persistReleased(stored, synced) {
    const ops = []
    for (const [key, cat] of Object.entries(synced.cats || {})) {
        const old = stored.cats?.[key] || {}
        const fields = ['prev_released', ...(cat.released_set ? [] : ['released'])].filter(
            (field) => !!old[field] !== !!cat[field]
        )
        if (!fields.length) continue
        ops.push({
            column: 'cats',
            path: [key],
            value: { cat_id: cat.cat_id, name: cat.name, location: cat.location, sort: cat.sort },
            if_missing: true,
        })
        for (const field of fields) ops.push({ column: 'cats', path: [key, field], value: !!cat[field] })
    }
    if (!ops.length) return
    const { error } = await supabase.rpc('shift_apply', {
        p_shift_id: stored.id,
        p_ops: ops,
        p_user: null,
    })
    if (error) throw createError({ statusCode: 500, message: error.message })
}

// 一班裡還沒勾的項目，給下一班看（/api/shift/previous）。只看那一班的快照，跟後台現在的設定無關。
// { arrive: [...], care: [...], meal: [...], required: [...] }，每一項 { key, target, content, tag }：
//   target 是對象（貓名、全員、貓屋或位置），畫面上當小標籤；tag 是類別（醫療分頁才有）
// 順序：貓在前（照那一班的貓順序），全員 → 貓屋 → 位置在後
const PLACE_ORDER = ['貓屋', '客廳', '房間', '倉庫', '隔離區']
const placeRank = (location) => (!location ? 0 : 1 + PLACE_ORDER.indexOf(location))
const bySort = (a, b) => (a.sort ?? MAX) - (b.sort ?? MAX)

// photos：那一班的觀察照片牆照片（cat_id、kinds），用來判斷觀察項目拍了沒
export function unfinishedOf(record, photos = []) {
    const cats = Object.values(record?.cats || {}).sort(bySort)
    const tasks = Object.entries(record?.tasks || {}).map(([key, t]) => ({ key, ...t }))
    const catName = (id) => record?.cats?.[id]?.name || ''
    const undone = (i) => 'done' in i && !i.done

    const fromCats = (list, filter, toRow) =>
        cats.flatMap((cat) =>
            Object.values(cat[list] || {})
                .filter((i) => undone(i) && filter(i))
                .sort(bySort)
                .map((i) => ({ key: `${list}:${cat.cat_id}:${i.id}`, target: cat.name, ...toRow(i) }))
        )
    const fromTasks = (kind, filter, toRow) =>
        tasks
            .filter((t) => t.kind === kind && undone(t) && filter(t))
            .sort((a, b) => placeRank(a.location) - placeRank(b.location) || bySort(a, b))
            .map((t) => ({
                key: t.key,
                target: t.cat_id ? catName(t.cat_id) : t.location || '全員',
                ...toRow(t),
            }))

    const medicalRow = (i) => ({ content: i.treatment, tag: i.category })
    const isMealMed = (i) => i.category === MEAL_MED
    const dietRow = (i) => ({ content: i.content })
    const requiredCats = (t) => t.cat_id
    const requiredRow = (t) => ({ content: t.content })

    // 觀察：貓自己的，加上全員／位置的（併進適用的每一隻貓）；沒拍對應的照片就算沒完成
    const observeTasks = tasks.filter((t) => t.kind === 'observe')
    const arrive = cats.flatMap((cat) => {
        const catPhotos = photos.filter((p) => p.cat_id === cat.cat_id)
        return [
            ...Object.values(cat.observe || {}).sort(bySort),
            ...observeTasks.filter((t) => !t.location || t.location === cat.location).sort(bySort),
        ]
            .filter((i) => !isObserveDone(i.category, catPhotos))
            // 有說明就寫說明、類別當小標籤；沒說明就直接寫類別（「拍貓砂」）
            .map((i) => ({
                key: `observe:${cat.cat_id}:${i.id}`,
                target: cat.name,
                content: i.content || i.category,
                tag: i.content ? i.category : null,
            }))
    })

    return {
        arrive,
        care: [...fromCats('medical', () => true, medicalRow), ...fromTasks('medical', () => true, medicalRow)],
        // 全員／位置的隨餐藥：那個位置當時沒有貓就不算（備餐分頁也不會顯示）
        meal: [
            ...fromCats('diet', isMealMed, dietRow),
            ...fromTasks('diet', (t) => isMealMed(t) && cats.some((c) => !t.location || t.location === c.location), dietRow),
        ],
        // 收尾：指定貓的跟著貓的順序排在前面，其他照全員 → 貓屋 → 位置
        required: [
            ...cats.flatMap((cat) =>
                tasks
                    .filter((t) => t.kind === 'required' && undone(t) && t.cat_id === cat.cat_id)
                    .sort(bySort)
                    .map((t) => ({ key: t.key, target: cat.name, ...requiredRow(t) }))
            ),
            ...fromTasks('required', (t) => !requiredCats(t), requiredRow),
        ],
    }
}
