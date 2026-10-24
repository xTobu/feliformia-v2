<template>
    <ClientOnly>
        <div id="cat-profiles-admin">
            <div class="page-header">
                <h1>貓咪管理</h1>
                <el-button type="primary" @click="openDialog()">
                    ＋ 新增貓咪
                </el-button>
            </div>

            <!-- 貓咪列表 - 拖拉排序。順序也是飲食、醫療、待辦管理與值班記錄表的順序 -->
            <draggable
                v-model="cats"
                item-key="id"
                handle=".drag-handle"
                ghost-class="ghost"
                @end="onDragEnd"
                class="cats-list"
            >
                <template #item="{ element: cat }">
                    <div class="cat-item">
                        <span class="drag-handle">☰</span>
                        <div class="cat-info">
                            <div class="cat-name">
                                <span class="cat-avatar">
                                    <img v-if="cat.avatar_path" :src="avatarUrl(cat.avatar_path)" alt="" />
                                    <template v-else>{{ cat.name.charAt(0) }}</template>
                                </span>
                                {{ cat.name }}
                            </div>
                            <!-- 暱稱：一個名字一個小灰標籤 -->
                            <div v-if="cat.nicknames?.length" class="cat-nicknames">
                                <span v-for="nickname in cat.nicknames" :key="nickname" class="nick-chip">{{
                                    nickname
                                }}</span>
                            </div>
                            <div class="cat-meta">
                                <div class="cat-status">
                                    <span v-if="cat.location"
                                        >📍 {{ cat.location }}</span
                                    >
                                    <span v-if="cat.adopted">🏠 已領養</span>
                                </div>
                                <div class="cat-actions">
                                    <el-button @click="openDialog(cat)">
                                        編輯
                                    </el-button>
                                    <el-button
                                        type="danger"
                                        @click="confirmDelete(cat)"
                                    >
                                        刪除
                                    </el-button>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </draggable>

            <!-- 空狀態 -->
            <div v-if="cats.length === 0" class="empty">尚無貓咪資料</div>

            <!-- 新增／編輯（含刪除）：components/CatProfileDialog.vue，貓咪檔案頁也用這個 -->
            <CatProfileDialog
                v-model="dialogVisible"
                :cat="editingCat"
                :next-sort-order="nextSortOrder"
                @saved="loadCats"
                @deleted="loadCats"
            />

            <NuxtLink to="/admin" class="back-link">← 返回管理後台</NuxtLink>
        </div>
    </ClientOnly>
</template>

<script setup>
// 新版貓咪管理（cat_profiles）。跟舊的 /admin/cats（cats 表）並行，兩邊資料不互通
import draggable from 'vuedraggable';
import Swal from 'sweetalert2';

definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '貓咪管理',
});

const supabase = useSupabaseClient();
const { avatarUrl } = useAvatar();

const cats = ref([]);
const dialogVisible = ref(false);
const editingCat = ref(null);

// 新增的貓排在最後
const nextSortOrder = computed(() =>
    cats.value.length ? Math.max(...cats.value.map((c) => c.sort_order || 0)) + 1 : 1
);

async function loadCats() {
    const { data } = await supabase.from('cat_profiles').select('*').order('sort_order');
    if (data) cats.value = data;
}

// 拖拉結束後更新排序，只更新有變的
async function onDragEnd() {
    const updates = cats.value
        .map((cat, index) => ({ cat, sort_order: index + 1 }))
        .filter(({ cat, sort_order }) => cat.sort_order !== sort_order)
        .map(({ cat, sort_order }) => {
            cat.sort_order = sort_order;
            return supabase.from('cat_profiles').update({ sort_order }).eq('id', cat.id);
        });

    await Promise.all(updates);
}

function openDialog(cat = null) {
    editingCat.value = cat;
    dialogVisible.value = true;
}

// 刪除確認。資料庫設了 on delete cascade：這隻貓的飲食、醫療、待辦與留言會一起刪掉
async function confirmDelete(cat) {
    const { isConfirmed } = await Swal.fire({
        html: `確定要刪除「${cat.name}」嗎？<br>牠的飲食、醫療、待辦設定與留言會一起刪除。<br>只是送養了的話，請改用「已領養」。`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });
    if (!isConfirmed) return;

    const { error } = await supabase.from('cat_profiles').delete().eq('id', cat.id);
    if (error) {
        Swal.fire({ text: '刪除失敗' });
        return;
    }
    await loadCats();
}

onMounted(loadCats);
</script>

<style lang="scss" scoped>
#cat-profiles-admin {
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;

    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }

}

// 跟飲食、醫療、待辦管理一致：標題靠左、新增按鈕靠右
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 16px;

    h1 {
        // 全域 h1 有 margin-bottom: 10px !important（element-variables.css），
        // 不蓋掉的話標題會比按鈕高 5px
        margin: 0 !important;
        font-size: 22px;
        text-align: left;
        // 光學補償：Noto Sans TC 22px 中文墨水比行框中心低約 1.7px，
        // 按鈕文字幾乎沒偏，往上提讓兩邊的字對齊（換字體或字級要重算）
        transform: translateY(-1.7px);
    }

    .el-button {
        flex-shrink: 0;
    }
}

.cats-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cat-item {
    display: flex;
    justify-content: flex-start;
    gap: 6px;
    padding: 12px 8px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: box-shadow 0.2s;

    &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
}

.drag-handle {
    cursor: grab;
    color: #999;
    font-size: 16px;
    line-height: 8px;
    height: 20px;
    padding: 4px 6px;
    user-select: none;

    &:hover {
        color: #666;
    }

    &:active {
        cursor: grabbing;
    }
}

.cat-info {
    text-align: left;
    width: 100%;
}

.cat-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    font-size: 14px;
}

// 暱稱：一個名字一個小灰標籤，放在名字下面
.cat-nicknames {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    padding-left: 36px;
}

.nick-chip {
    display: inline-block;
    padding: 0 6px;
    border-radius: 3px;
    background: #f0eeec;
    color: #767676;
    font-size: 12px;
    line-height: 20px;
}

// 列表上的小頭像（沒有就顯示名字第一個字）
.cat-avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    background: #e8e2dc;
    color: #6b625d;
    font-size: 13px;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.cat-meta {
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #888;
    margin-top: 12px;
    .cat-status {
        line-height: 32px;
        display: flex;
        gap: 4px;
    }
}

.cat-actions {
    display: flex;
}

.empty {
    text-align: center;
    color: #999;
    padding: 40px 20px;
    background: #f9f9f9;
    border-radius: 8px;
}

.back-link {
    display: inline-block;
    margin-top: 20px;
    color: #657181;
    font-size: 14px;
    text-decoration: none;

    &:hover {
        color: #b33a39;
    }
}

/* 拖拉時的樣式 */
.ghost {
    opacity: 0.5;
    background: #e8f4f8;
    border: 1px dashed #6da2c2;
}
</style>
