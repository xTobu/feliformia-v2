<template>
    <ClientOnly>
        <div id="weekly-medicine">
            <h1>貓咪醫療追蹤</h1>

            <div class="weekly-pick">
                <el-select v-model="selectedCat" placeholder="請選擇卯咪" filterable>
                    <el-option v-for="cat in cats" :key="cat.id" :label="cat.name" :value="cat.id" />
                </el-select>
            </div>

            <!-- 日期（同貓咪檔案每日紀錄的日期鈕）＋右邊的欄位選擇：列出這段期間出現過的事項（照類別分組）與值班，
                 取消勾的欄位不顯示；每隻貓各自記在這台裝置 -->
            <DateRangeFilter v-if="selectedCat" v-model:from="range.from" v-model:to="range.to">
                <el-popover placement="bottom-end" trigger="click" :width="220" popper-class="med-cols-pop">
                    <template #reference>
                        <button type="button" class="med-cols-btn" aria-label="選擇要顯示的欄位">
                            <Icon icon="mdi:view-column-outline" width="18" />
                        </button>
                    </template>
                    <p v-if="!allCols.length" class="med-cols-empty">還沒有欄位</p>
                    <template v-for="g in pickerGroups" :key="g.label">
                        <div class="med-cols-group">{{ g.label }}</div>
                        <el-checkbox
                            v-for="col in g.cols"
                            :key="col.key"
                            :model-value="!hiddenCols.includes(col.key)"
                            :disabled="!hiddenCols.includes(col.key) && shownCols.length === 1"
                            @change="(v) => toggleCol(col.key, v)"
                        >
                            {{ col.pickLabel }}
                        </el-checkbox>
                    </template>
                </el-popover>
            </DateRangeFilter>

            <p v-if="!selectedCat" class="weekly-state">尚未選擇卯咪</p>
            <p v-else-if="!entries.length && loading" class="weekly-state">載入中...</p>
            <p v-else-if="!entries.length && loadError" class="weekly-state">
                載入失敗<button type="button" class="weekly-retry" @click="loadMore">再試一次</button>
            </p>
            <p v-else-if="!entries.length" class="weekly-state">這隻貓還沒有紀錄</p>
            <template v-else>
                <!-- 載入的這段期間都沒有醫療項目：表格只會有值班欄，直接說沒有 -->
                <p v-if="!medicalCols.length" class="weekly-note">
                    這段期間沒有醫療項目<template v-if="hasMore">，往下捲會再往前找</template>
                </p>
                <!-- 跟貓咪每日紀錄同一張表（日期合併、表頭固定、捲到表格底部再往前載 7 天），
                     欄位換成這段期間出現過的醫療項目：表頭兩層（上層類別、下層事項，事項太長點一下展開），
                     有勾 ✓、沒勾 ✕、那一班沒有這項留白 -->
                <CatHealthTable
                    :entries="entries"
                    :columns="shownCols"
                    :highlight-names="catNames"
                    max-height="max(360px, calc(100dvh - 220px))"
                    @near-end="loadMore"
                />
                <p class="weekly-state small">
                    <template v-if="loadError">
                        載入失敗<button type="button" class="weekly-retry" @click="loadMore">再試一次</button>
                    </template>
                    <template v-else-if="loading">載入中...</template>
                    <template v-else-if="!hasMore">沒有更早的紀錄了</template>
                </p>
            </template>
        </div>
        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
// 一隻貓每一班的醫療項目有沒有勾（醫療、餵藥、外用、隨餐藥、其他；貓自己的加上全員／所在位置的）。
//
// 2026-11-17：資料從舊版「用藥與特殊照護」（medicines）改讀新版值班紀錄（shifts，走 /api/cats/timeline 的 medical），
// 表格跟貓咪每日紀錄共用 components/CatHealthTable.vue（傳自訂欄位）。
// ⚠️ 舊版 /medicine 的紀錄這頁看不到了（測試站舊版最後一筆在 2026-11-02）。
import { Icon } from '@iconify/vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '貓咪醫療追蹤',
});

const route = useRoute();
const supabase = useSupabaseClient();

const cats = ref([]);
const selectedCat = ref('');
const entries = ref([]);
const loading = ref(false);
const loadError = ref(false);
const cursor = ref(null); // 已載入最舊的那天，下次從它往前
const hasMore = ref(true);
// 日期：null＝不限（從今天一路往前）；改了就從頭重載
const range = reactive({ from: null, to: null });

// 回報彈窗裡要標起來的名字：選到的那隻貓與牠的暱稱
const catNames = computed(() => {
    const cat = cats.value.find((c) => c.id === selectedCat.value);
    return cat ? [cat.name, ...(cat.nicknames || [])].filter(Boolean) : [];
});

// ---- 欄位：已載入的班裡出現過的醫療項目，照類別排（醫療 → 餵藥 → 外用 → 隨餐藥 → 其他），同類別照後台的排序 ----
const CATEGORY_ORDER = ['醫療', '餵藥', '外用', '隨餐藥', '其他'];
const CATEGORY_GROUP = { 醫療: 'medical', 餵藥: 'feeding', 外用: 'topical', 隨餐藥: 'mealmed' };
const MAX = Number.MAX_SAFE_INTEGER;

const medicalCols = computed(() => {
    const byKey = new Map();
    // 新的班在前：同一個項目以最新那班的名稱為準
    for (const entry of entries.value) {
        for (const item of entry.medical || []) {
            if (!byKey.has(item.key)) byKey.set(item.key, item);
        }
    }
    const rank = (c) => {
        const i = CATEGORY_ORDER.indexOf(c);
        return i === -1 ? CATEGORY_ORDER.length : i;
    };
    return [...byKey.values()]
        .sort((a, b) => rank(a.category) - rank(b.category) || (a.sort ?? MAX) - (b.sort ?? MAX))
        .map((item) => ({
            key: `med-${item.key}`,
            medical: item.key,
            // 全員／位置的項目前面標來源，跟貓自己的分得出來
            label: item.source ? `${item.source}・${item.treatment}` : item.treatment,
            title: `${item.category}：${item.treatment}${item.source ? `（${item.source}）` : ''}`,
            // 每個事項固定 120px（一行約 9 個字，再長就換行）；事項多的貓表格會變寬，左右捲時班別固定在左邊
            width: '120px',
            // 兩層表頭的上層：醫療管理的類別；名稱超過 10 個字收成「…」，點表頭展開
            groupLabel: item.category || '其他',
            truncate: 10,
            group: CATEGORY_GROUP[item.category] || null,
        }));
});

// 值班欄窄一點（人名多就換行），事項多的貓留寬度給事項
const allCols = computed(() => [...medicalCols.value, { key: 'volunteers', label: '值班', width: '76px' }]);

// ---- 欄位選擇：每隻貓各自記哪些欄不顯示（存在這台裝置）。至少留一欄 ----
const storage = useLocalStorage();
const HIDDEN_KEY = 'cat_medical_hidden_cols';
const hiddenCols = ref([]);
const shownCols = computed(() => allCols.value.filter((c) => !hiddenCols.value.includes(c.key)));

// 選單照類別分組（跟表頭上層一樣），值班自己一組
const pickerGroups = computed(() => {
    const groups = [];
    for (const col of allCols.value) {
        const label = col.groupLabel || '其他欄位';
        let g = groups.find((x) => x.label === label);
        if (!g) groups.push((g = { label, cols: [] }));
        g.cols.push({ ...col, pickLabel: col.label });
    }
    return groups;
});

function toggleCol(key, show) {
    hiddenCols.value = show ? hiddenCols.value.filter((k) => k !== key) : [...hiddenCols.value, key];
    const all = storage.get(HIDDEN_KEY, {}) || {};
    if (hiddenCols.value.length) all[selectedCat.value] = hiddenCols.value;
    else delete all[selectedCat.value];
    storage.set(HIDDEN_KEY, all);
}

function restoreHidden() {
    const all = storage.get(HIDDEN_KEY, {}) || {};
    const saved = all[selectedCat.value];
    hiddenCols.value = Array.isArray(saved) ? saved.filter((k) => typeof k === 'string') : [];
}

// ---- 載入：跟貓咪每日紀錄一樣，一次 7 天、新的在前，捲到表格底部再往前 ----
let generation = 0; // 換貓換很快時，舊的請求回來不要蓋掉新的

function loadEntries() {
    generation += 1;
    entries.value = [];
    cursor.value = null;
    hasMore.value = true;
    loading.value = false;
    loadError.value = false;
    if (selectedCat.value) loadMore();
}

async function loadMore() {
    if (!selectedCat.value || loading.value || !hasMore.value) return;
    const run = generation;
    loading.value = true;
    loadError.value = false;
    try {
        const res = await $fetch('/api/cats/timeline', {
            query: {
                catId: selectedCat.value,
                before: cursor.value || undefined,
                from: range.from || undefined,
                to: range.to || undefined,
            },
        });
        if (run !== generation) return;
        entries.value = [...entries.value, ...res.entries];
        cursor.value = res.cursor;
        hasMore.value = res.hasMore;
    } catch (e) {
        console.error('load weekly medicine error:', e);
        if (run === generation) loadError.value = true;
    } finally {
        if (run === generation) loading.value = false;
    }
}

watch(selectedCat, () => {
    restoreHidden();
    loadEntries();
});
watch(() => [range.from, range.to], loadEntries);

onMounted(async () => {
    const { data, error } = await supabase.from('cat_profiles').select('id, name, nicknames').order('sort_order');

    if (error) {
        console.error('load cats error:', error);
        return;
    }

    cats.value = data || [];

    // /weekly-medicine?cat=<id> 可以直接開到某一隻
    const fromQuery = Number(route.query.cat);
    if (fromQuery && cats.value.some((c) => c.id === fromQuery)) selectedCat.value = fromQuery;
});
</script>

<style lang="scss" scoped>
#weekly-medicine {
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;
}

.weekly-pick {
    margin-bottom: 16px;

    .el-select {
        width: 100%;
    }
}

.weekly-state {
    margin: 0;
    padding: 40px 20px;
    border-radius: 8px;
    background: #f9f9f9;
    color: #909399;
    font-size: 14px;
    text-align: center;
}

// 表格下面的一行狀態（載入中、沒有更早的紀錄了）：不要底色、小一點
.weekly-state.small {
    padding: 10px 0 0;
    background: none;
    font-size: 13px;
}

// 欄位選擇鈕：跟貓咪每日紀錄的欄位鈕同一個樣子。全域 button 樣式要蓋回來
.med-cols-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    margin: 0;
    padding: 0;
    border: 1px solid #dcdad8;
    border-radius: 8px;
    background: #fff;
    color: #657181;
    cursor: pointer;
}

// 表格上面的提示（這段期間沒有醫療項目）
.weekly-note {
    margin: 0 0 10px;
    color: #909399;
    font-size: 13px;
    text-align: left;
}

// 「再試一次」：全域 button 樣式蓋回文字按鈕
.weekly-retry {
    width: auto;
    height: auto;
    margin: 0 0 0 8px;
    padding: 0;
    border: none;
    background: none;
    color: #6da2c2;
    font-size: inherit;
    text-decoration: underline;
    cursor: pointer;
}
</style>

<style lang="scss">
/* el-popover 會 teleport 到 body，scoped 選不到 */
.med-cols-pop {
    max-height: 60vh;
    overflow-y: auto;

    .med-cols-group {
        margin: 8px 0 2px;
        color: #8e8783;
        font-size: 12px;

        &:first-child {
            margin-top: 0;
        }
    }

    .el-checkbox {
        display: flex;
        height: auto;
        min-height: 28px;
        margin: 0;
        white-space: normal;
    }

    .med-cols-empty {
        margin: 0;
        color: #909399;
        font-size: 13px;
    }
}
</style>
