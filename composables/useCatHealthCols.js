// 健康紀錄表要顯示哪些欄位。
// 表格（components/CatHealthTable.vue）與選欄位的按鈕
//（components/CatHealthColumns.vue）分開，頁面才能自己決定按鈕擺哪
//（貓咪檔案擺在日期篩選那一列、/weekly 擺在貓咪選單旁邊）。
//
// from：對應 intakeCells() 回傳的 label（表頭用短的，格子裡的 label 是長的）。
// 放風不在 intake 裡，另外從 entry.released / prev_released 取。
// width：表頭不折行，四個字的「本班放風」要比單字欄寬得多。
// group：表頭顏色分組（food 飲食橘、excretion 排泄藍、release 放風綠，沒有就灰）。
export const CAT_HEALTH_COLS = [
    { key: 'feed', label: '乾', from: '乾乾', width: '52px', group: 'food' },
    { key: 'can', label: '罐', from: '罐罐', width: '52px', group: 'food' },
    { key: 'urine', label: '尿', from: '尿', width: '52px', group: 'excretion' },
    { key: 'feces', label: '便', from: '便', width: '52px', group: 'excretion' },
    // 前班在前、本班在後：照時間順序（到班時貓已在外面 → 這班走時放出來）
    { key: 'prev_released', label: '前班放風', from: null, width: '80px', group: 'release' },
    { key: 'released', label: '本班放風', from: null, width: '80px', group: 'release' },
    { key: 'mentioned', label: '被提及', from: null, width: '68px' },
    // 值班：那一班的值班志工（排班投票，/api/cats/timeline 的 volunteers）；人名會比較長，放最後、給寬一點、可以換行
    { key: 'volunteers', label: '值班', from: null, width: '120px' },
]

const STORAGE_KEY = 'cat_health_cols'
const ALL_KEYS = CAT_HEALTH_COLS.map((c) => c.key)

export const useCatHealthCols = () => {
    const storage = useLocalStorage()
    const shown = useState('catHealthCols', () => [...ALL_KEYS])
    const restored = useState('catHealthColsRestored', () => false)

    // localStorage 只有瀏覽器讀得到，而且一次就好
    const restore = () => {
        if (restored.value) return
        restored.value = true

        // 存的是 { shown, known }：known 是存檔當時有哪些欄位，之後新加的欄位（不在 known 裡）預設打開，
        // 不然調過欄位的人永遠看不到新欄位。更早存的是單純的陣列（那時還沒有「值班」欄）
        const saved = storage.get(STORAGE_KEY)
        const savedShown = Array.isArray(saved) ? saved : saved?.shown
        if (!Array.isArray(savedShown)) return
        const known = Array.isArray(saved) ? ALL_KEYS.filter((k) => k !== 'volunteers') : saved.known || []
        // 存的是舊版欄位或被手改壞了就當沒設定，不要讓表格變空的
        const valid = [...savedShown, ...ALL_KEYS.filter((k) => !known.includes(k))].filter((k) =>
            ALL_KEYS.includes(k)
        )
        if (valid.length) shown.value = ALL_KEYS.filter((k) => valid.includes(k))
    }

    const save = () => storage.set(STORAGE_KEY, { shown: shown.value, known: ALL_KEYS })

    const visibleCols = computed(() => CAT_HEALTH_COLS.filter((c) => shown.value.includes(c.key)))

    return { cols: CAT_HEALTH_COLS, shown, visibleCols, restore, save }
}
