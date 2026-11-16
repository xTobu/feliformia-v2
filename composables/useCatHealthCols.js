// 健康紀錄表要顯示哪些欄位。
// 表格（components/CatHealthTable.vue）與選欄位的按鈕
//（components/CatHealthColumns.vue）分開，頁面才能自己決定按鈕擺哪
//（貓咪檔案擺在日期篩選那一列、/weekly 擺在貓咪選單旁邊）。
//
// from：對應 intakeCells() 回傳的 label（表頭用短的，格子裡的 label 是長的）。
// 放風不在 intake 裡，另外從 entry.released / prev_released 取。
// width：表頭不折行，四個字的「本班放風」要比單字欄寬得多。
export const CAT_HEALTH_COLS = [
    { key: 'feed', label: '乾', from: '乾乾', width: '52px' },
    { key: 'can', label: '罐', from: '罐罐', width: '52px' },
    { key: 'urine', label: '尿', from: '尿', width: '52px' },
    { key: 'feces', label: '便', from: '便', width: '52px' },
    { key: 'released', label: '本班放風', from: null, width: '80px' },
    { key: 'prev_released', label: '前班放風', from: null, width: '80px' },
    { key: 'mentioned', label: '被提及', from: null, width: '68px' },
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

        const saved = storage.get(STORAGE_KEY)
        if (!Array.isArray(saved)) return
        // 存的是舊版欄位或被手改壞了就當沒設定，不要讓表格變空的
        const valid = saved.filter((k) => ALL_KEYS.includes(k))
        if (valid.length) shown.value = valid
    }

    const save = () => storage.set(STORAGE_KEY, shown.value)

    const visibleCols = computed(() => CAT_HEALTH_COLS.filter((c) => shown.value.includes(c.key)))

    return { cols: CAT_HEALTH_COLS, shown, visibleCols, restore, save }
}
