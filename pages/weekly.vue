<template>
    <ClientOnly>
        <div id="weekly">
            <h1>貓咪每日紀錄</h1>

            <div class="weekly-pick">
                <el-select v-model="selectedCat" placeholder="請選擇卯咪" filterable>
                    <el-option
                        v-for="cat in cats"
                        :key="cat.id"
                        :label="cat.name"
                        :value="cat.id"
                    />
                </el-select>
                <CatHealthColumns />
            </div>

            <p v-if="!selectedCat" class="weekly-state">尚未選擇卯咪</p>
            <p v-else-if="!entries.length && loading" class="weekly-state">載入中...</p>
            <p v-else-if="!entries.length && loadError" class="weekly-state">
                載入失敗<button type="button" class="weekly-retry" @click="loadMore">再試一次</button>
            </p>
            <p v-else-if="!entries.length" class="weekly-state">這隻貓還沒有紀錄</p>
            <!-- 跟貓咪檔案的每日紀錄一樣：新的在前，限制高度、表頭固定，捲到表格底部就再往前載 7 天 -->
            <template v-else>
                <CatHealthTable
                    :entries="entries"
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
// 一隻貓的飲食排泄，新的在前，捲到表格底部再往前載（一次 7 天，同貓咪檔案的每日紀錄）。
//
// 2026-11-16：資料從舊的 regulars 改讀新的 shifts（走 /api/cats/timeline），
// 表格與貓咪檔案的「每日紀錄」分頁共用 components/CatHealthTable.vue。
// ⚠️ 新制上線前（2026-10-18 以前）的紀錄只存在舊的 regulars 表，這頁看不到了。
definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '貓咪每日紀錄',
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

// 回報彈窗裡要標起來的名字：選到的那隻貓與牠的暱稱
const catNames = computed(() => {
    const cat = cats.value.find((c) => c.id === selectedCat.value);
    return cat ? [cat.name, ...(cat.nicknames || [])].filter(Boolean) : [];
});

let generation = 0; // 換貓換很快時，舊的請求回來不要蓋掉新的

// 換貓：從今天重新開始
function loadEntries() {
    generation += 1;
    entries.value = [];
    cursor.value = null;
    hasMore.value = true;
    loading.value = false;
    loadError.value = false;
    if (selectedCat.value) loadMore();
}

// 再往前載一批（/api/cats/timeline 一次 7 天，新的在前）
async function loadMore() {
    if (!selectedCat.value || loading.value || !hasMore.value) return;
    const run = generation;
    loading.value = true;
    loadError.value = false;
    try {
        const res = await $fetch('/api/cats/timeline', {
            query: { catId: selectedCat.value, before: cursor.value || undefined },
        });
        if (run !== generation) return;
        entries.value = [...entries.value, ...res.entries];
        cursor.value = res.cursor;
        hasMore.value = res.hasMore;
    } catch (e) {
        console.error('load weekly error:', e);
        if (run === generation) loadError.value = true;
    } finally {
        if (run === generation) loading.value = false;
    }
}

watch(selectedCat, loadEntries);

onMounted(async () => {
    const { data, error } = await supabase
        .from('cat_profiles')
        .select('id, name, nicknames')
        .order('sort_order');

    if (error) {
        console.error('load cats error:', error);
        return;
    }

    cats.value = data || [];

    // /weekly?cat=<id> 可以直接開到某一隻（值班表、貓咪檔案連過來用）
    const fromQuery = Number(route.query.cat);
    if (fromQuery && cats.value.some((c) => c.id === fromQuery)) selectedCat.value = fromQuery;
});
</script>

<style lang="scss" scoped>
#weekly {
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;
}

.weekly-pick {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;

    // 選單吃掉剩下的寬，欄位鈕固定在右邊
    .el-select {
        flex: 1;
        min-width: 0;
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
