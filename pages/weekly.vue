<template>
    <ClientOnly>
        <div id="weekly">
            <h1>卯咪健康週表</h1>

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
            <p v-else-if="loading" class="weekly-state">載入中...</p>
            <p v-else-if="!entries.length" class="weekly-state">這七天沒有這隻貓的紀錄</p>
            <!-- 由舊到新，看得出變化；貓咪檔案的健康紀錄是新的在前（配合往下翻） -->
            <CatHealthTable v-else :entries="entries" :highlight-names="catNames" />
        </div>
        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
// 一隻貓最近七天的飲食排泄。
//
// 2026-11-16：資料從舊的 regulars 改讀新的 shifts（走 /api/cats/timeline），
// 表格與貓咪檔案的「健康紀錄」分頁共用 components/CatHealthTable.vue。
// ⚠️ 新制上線前（2026-10-18 以前）的紀錄只存在舊的 regulars 表，這頁看不到了。
definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '卯咪健康週表',
});

const DAYS = 7;

const { $dayjs } = useNuxtApp();
const route = useRoute();
const supabase = useSupabaseClient();

const cats = ref([]);
const selectedCat = ref('');
const entries = ref([]);
const loading = ref(false);

// 回報彈窗裡要標起來的名字：選到的那隻貓與牠的暱稱
const catNames = computed(() => {
    const cat = cats.value.find((c) => c.id === selectedCat.value);
    return cat ? [cat.name, ...(cat.nicknames || [])].filter(Boolean) : [];
});

let generation = 0; // 換貓換很快時，舊的請求回來不要蓋掉新的

async function loadEntries() {
    entries.value = [];
    if (!selectedCat.value) return;

    const run = ++generation;
    loading.value = true;
    try {
        const res = await $fetch('/api/cats/timeline', {
            query: {
                catId: selectedCat.value,
                from: $dayjs().subtract(DAYS - 1, 'day').format('YYYY-MM-DD'),
            },
        });
        if (run !== generation) return;
        // API 是新的在前，這頁由舊到新排
        entries.value = [...res.entries].reverse();
    } catch (e) {
        console.error('load weekly error:', e);
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
</style>
