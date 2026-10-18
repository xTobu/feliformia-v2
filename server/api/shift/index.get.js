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
    if (existing) {
        // 當天（含之後）的班：同步後台最新設定；過去的班保持當時的樣子
        const record = date >= todayInTaipei() ? await syncWithSettings(existing) : existing
        return toResponse(await sortByCatOrder(record))
    }

    const { cats, tasks } = await buildSnapshot(date, shift)
    const { data, error } = await supabase
        .from('shifts')
        .insert({ date, shift, cats, tasks })
        .select()
        .single()

    // 兩個人同時打開同一班：unique (date, shift) 擋下後到的，改讀先建好的那筆
    if (error && error.code === '23505') {
        return toResponse(await sortByCatOrder(await findShift(date, shift)))
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

// 伺服器在 UTC，台灣凌晨 0～8 點時 UTC 還是前一天，要用台灣的日期判斷「當天」
function todayInTaipei() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
}

// 當天的班載入時，用後台現在的設定重建一份，再把這班已經填的資料併回去：
// - 觀察（intake）、放風（released）照舊
// - 醫療、補充、飲食的其他、全員／小房間等項目：照 notice_id 保留「完成」
// - 後台已刪除或過期、但這班已經打勾的項目留著當紀錄；沒打勾的就拿掉
// - 乾乾、罐罐只是參考，一律用最新的
// - 這班建立後才領養或刪除的貓：有填過資料就留著，沒有就拿掉
// 不寫回資料庫：下一次存檔時，前端會把合併後的內容整筆存回去
async function syncWithSettings(record) {
    const fresh = await buildSnapshot(record.date, record.shift)
    const storedCats = new Map(record.cats.map((c) => [c.cat_id, c]))

    const cats = fresh.cats.map((cat) => {
        const old = storedCats.get(cat.cat_id)
        if (!old) return cat
        return {
            ...cat,
            intake: old.intake ?? cat.intake,
            released: old.released ?? false,
            medical: mergeItems(cat.medical, old.medical),
            with_meal: mergeItems(cat.with_meal, old.with_meal),
            todos: mergeItems(cat.todos, old.todos),
        }
    })

    const freshIds = new Set(fresh.cats.map((c) => c.cat_id))
    for (const old of record.cats) {
        if (!freshIds.has(old.cat_id) && hasRecord(old)) cats.push(old)
    }

    return { ...record, cats, tasks: mergeItems(fresh.tasks, record.tasks) }
}

function mergeItems(freshItems, storedItems = []) {
    const stored = new Map(storedItems.map((i) => [i.notice_id, i]))
    const merged = freshItems.map((item) => {
        const old = stored.get(item.notice_id)
        return old ? { ...item, done: !!old.done } : item
    })
    const freshIds = new Set(freshItems.map((i) => i.notice_id))
    const keptDone = storedItems.filter((i) => i.done && !freshIds.has(i.notice_id))
    return [...merged, ...keptDone]
}

// 這隻貓在這班有沒有被填過任何東西。
// intake 逐欄比對，不用 JSON.stringify：jsonb 會重排 key 的順序
function hasRecord(cat) {
    const anyDone = (list = []) => list.some((i) => i.done)
    const defaults = defaultIntake()
    const intakeChanged =
        !!cat.intake &&
        Object.keys(defaults).some((key) => (cat.intake[key] ?? null) !== defaults[key])
    return !!cat.released || anyDone(cat.medical) || anyDone(cat.todos) || intakeChanged
}

// 快照建立時已照貓咪管理排好，但之後在貓咪管理調整順序，已經建立的班不會跟著變。
// 每次讀取都照「現在」的順序重排；已刪除的貓排最後。存檔時會連同新順序寫回去
async function sortByCatOrder(record) {
    const { data, error } = await supabase.from('cats').select('id, order')
    if (error) throw createError({ statusCode: 500, message: error.message })

    const order = new Map(data.map((c) => [c.id, c.order]))
    const rank = (c) => order.get(c.cat_id) ?? Number.MAX_SAFE_INTEGER
    return { ...record, cats: [...record.cats].sort((a, b) => rank(a) - rank(b)) }
}

// 飲食與待辦的類別分兩群：放什麼飯（乾乾、罐罐）只看不打勾；
// 加進飯裡的（補充、其他）也只看不打勾。藥一律歸醫療管理，出現在吃藥分頁。
// 快照的 meals / with_meal 兩個 key 沿用舊名，每一項帶 category，畫面再依 category 顯示
const FOOD_CATEGORIES = ['dry', 'wet']
const ADDON_CATEGORIES = ['supplement', 'diet_other']

// 到班時還沒填的樣子（欄位與 /regular 相同）
function defaultIntake() {
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
        category: n.category,
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
            const of = (categories) =>
                mine.filter((n) => categories.includes(n.category)).map(item)
            const meals = mine
                .filter((n) => FOOD_CATEGORIES.includes(n.category))
                .map((n) => ({
                    notice_id: n.id,
                    category: n.category,
                    treatment: n.treatment,
                    reason: n.reason || null,
                }))

            return {
                cat_id: c.id,
                name: shortName(c.name),
                room: c.room || null,
                // 觀察：上一班放的飯吃了多少、排泄（欄位與 /regular 相同）
                intake: defaultIntake(),
                // 醫療分頁
                medical: of(['medication', 'medical', 'other']),
                // 備餐：還沒在飲食與待辦設定乾乾、罐罐的貓，退回貓咪資料上的飲食備註
                meals: meals.length
                    ? meals
                    : c.diet_note?.trim()
                      ? [{ notice_id: null, treatment: c.diet_note.trim(), reason: null }]
                      : [],
                with_meal: of(ADDON_CATEGORIES),
                // 備餐：值班要做的待辦，要打勾
                todos: of(['todo']),
                released: false,
            }
        })

    // 對不到貓的項目（全員、房間…）。飲食類的會在備餐分頁併進每隻符合的貓
    // （全員 → 每隻貓；房間名 → 那個房間的貓），所以乾乾、罐罐也要收
    const tasks = active
        .filter((n) => !n.cat_id)
        .map((n) => ({ ...item(n), name: n.name, category: n.category || 'medical' }))

    return { cats, tasks }
}
