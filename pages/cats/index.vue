<template>
    <ClientOnly>
        <div id="cats-index">
            <h1>貓咪檔案</h1>

            <el-input v-model="keyword" placeholder="搜尋名字或暱稱" clearable class="search" />

            <div v-if="loading" class="state">載入中...</div>
            <template v-else>
                <!-- 照位置分區（客廳、房間、倉庫、隔離區，沒填位置的放最後），已領養的另外一區 -->
                <section v-for="group in groups" :key="group.label" class="group">
                    <div class="group-label">
                        {{ group.label }}<span class="group-count">{{ group.cats.length }}</span>
                    </div>
                    <div class="cat-grid">
                        <NuxtLink v-for="cat in group.cats" :key="cat.id" :to="`/cats/${cat.id}`" class="cat-card">
                            <span class="avatar">
                                <img v-if="cat.avatar_path" :src="avatarUrl(cat.avatar_path)" alt="" />
                                <template v-else>{{ cat.name.charAt(0) }}</template>
                            </span>
                            <span class="cat-name">{{ cat.name }}</span>
                        </NuxtLink>
                    </div>
                </section>
                <div v-if="!groups.length" class="state">{{ keyword ? '找不到這隻貓' : '尚無貓咪資料' }}</div>
            </template>
        </div>
    </ClientOnly>
</template>

<script setup>
// 新版貓咪檔案（cat_profiles）的清單：志工都能看，點進去是 /cats/[id]
definePageMeta({
    middleware: 'auth',
    ssr: false,
});

useHead({
    title: '貓咪檔案',
});

const supabase = useSupabaseClient();
const { avatarUrl } = useAvatar();

const cats = ref([]);
const loading = ref(true);
const keyword = ref('');

const matches = (cat) => {
    const word = keyword.value.trim();
    return !word || [cat.name, ...(cat.nicknames || [])].some((name) => name.includes(word));
};

const groups = computed(() => {
    const list = cats.value.filter(matches);
    const living = list.filter((c) => !c.adopted);
    return [
        ...LOCATIONS.map((location) => ({ label: location, cats: living.filter((c) => c.location === location) })),
        { label: '未填位置', cats: living.filter((c) => !LOCATIONS.includes(c.location)) },
        { label: '已領養', cats: list.filter((c) => c.adopted) },
    ].filter((g) => g.cats.length);
});

onMounted(async () => {
    const { data } = await supabase
        .from('cat_profiles')
        .select('id, name, nicknames, location, adopted, avatar_path')
        .order('sort_order');
    cats.value = data || [];
    loading.value = false;
});
</script>

<style lang="scss" scoped>
#cats-index {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    padding-bottom: 80px;
}

.search {
    margin-bottom: 8px;
}

.state {
    padding: 40px 0;
    color: #999;
    text-align: center;
}

.group-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 20px 0 10px;
    font-size: 15px;
    font-weight: 500;
    color: #4a4542;

    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #e4e0dd;
    }
}

.group-count {
    font-size: 12px;
    font-weight: 400;
    color: #a8a29e;
}

.cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 12px 8px;
}

.cat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 4px 0;
    color: inherit;
    text-decoration: none;
}

.avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    background: #f0eeec;
    color: #8a7f78;
    font-size: 22px;
    font-weight: 500;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.cat-name {
    max-width: 100%;
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
