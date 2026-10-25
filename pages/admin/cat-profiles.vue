<template>
    <ClientOnly>
        <div id="cat-profiles-admin">
            <div class="page-header">
                <h1>貓咪管理</h1>
                <div class="header-actions">
                    <el-button type="primary" @click="openDialog()">
                        ＋ 新增貓咪
                    </el-button>
                    <!-- 搜尋：名稱、暱稱，與已領養／未領養，在視窗裡選（components/CatSearch.vue） -->
                    <CatSearch v-model:filter="filter" :cats="cats" />
                </div>
            </div>

            <!-- 套用中的條件：一個一個可以拿掉；下面寫找到幾隻、清除 -->
            <CatFilterBar v-model:filter="filter" :count="shownCount" hint="（篩選時不能拖拉排序）" />

            <!-- 貓咪列表 - 拖拉排序。順序也是飲食、醫療、待辦管理與值班記錄表的順序。
                 篩選時只是把不符合的藏起來，而且不能拖（藏起來的會讓順序對不上） -->
            <draggable
                v-model="cats"
                item-key="id"
                handle=".drag-handle"
                ghost-class="ghost"
                :disabled="filtering"
                @end="onDragEnd"
                class="cats-list"
            >
                <template #item="{ element: cat }">
                    <div v-show="matches(cat)" class="cat-item">
                        <span class="drag-handle" :class="{ off: filtering }">☰</span>
                        <div class="cat-info">
                            <div class="cat-name">
                                <!-- 頭像，位置貼在下緣中間（同貓咪檔案頁首） -->
                                <div class="cat-avatar-wrap">
                                    <span class="cat-avatar">
                                        <img v-if="cat.avatar_path" :src="avatarUrl(cat.avatar_path)" alt="" />
                                        <template v-else>{{ cat.name.charAt(0) }}</template>
                                    </span>
                                    <span v-if="cat.location" class="cat-location">
                                        <Icon icon="mdi:map-marker" width="11" />{{ cat.location }}
                                    </span>
                                </div>
                                <!-- 兩欄：左邊性別符號，右邊名字與下一行的暱稱（暱稱跟名字同一個起點） -->
                                <div class="cat-title">
                                    <!-- 性別：名字左邊一個符號（公藍、母粉，同貓咪檔案頁首），不確定就不顯示 -->
                                    <Icon
                                        v-if="cat.sex"
                                        :icon="cat.sex === '公' ? 'mdi:gender-male' : 'mdi:gender-female'"
                                        width="18"
                                        class="cat-sex"
                                        :class="cat.sex === '公' ? 'male' : 'female'"
                                        :aria-label="cat.sex"
                                    />
                                    <span class="cat-title-name">
                                        {{ cat.name }}
                                        <!-- 到這隻貓的貓咪檔案 -->
                                        <NuxtLink :to="`/cats/${cat.id}`" class="cat-profile-link" :aria-label="`${cat.name}的貓咪檔案`">
                                            <Icon icon="mdi:open-in-new" width="16" />
                                        </NuxtLink>
                                    </span>
                                    <div v-if="cat.nicknames?.length" class="cat-nick">{{ cat.nicknames.join('、') }}</div>
                                    <div v-if="cat.adopted" class="cat-adopted">🏠 已領養</div>
                                </div>
                                <!-- 編輯／刪除：右邊小方塊圖示（同後台照護事項） -->
                                <div class="cat-actions">
                                    <button type="button" class="icon-btn" aria-label="編輯" @click="openDialog(cat)">
                                        <Icon icon="mdi:pencil-outline" width="16" />
                                    </button>
                                    <button type="button" class="icon-btn danger" aria-label="刪除" @click="confirmDelete(cat)">
                                        <Icon icon="mdi:trash-can-outline" width="16" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </draggable>

            <!-- 空狀態 -->
            <div v-if="cats.length === 0" class="empty">尚無貓咪資料</div>
            <div v-else-if="filtering && !shownCount" class="empty">沒有符合的貓咪</div>


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
import { Icon } from '@iconify/vue';
import Swal from 'sweetalert2';
import { emptyCatFilter, isCatFilterOn, matchesCatFilter } from '~/composables/catSearch';

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

// ---- 搜尋：名稱、暱稱與領養狀態（composables/catSearch.js） ----
const filter = ref(emptyCatFilter());
const matches = (cat) => matchesCatFilter(cat, filter.value);
const filtering = computed(() => isCatFilterOn(filter.value));
const shownCount = computed(() => cats.value.filter(matches).length);

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

.header-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;

    .el-button + * {
        margin-left: 0;
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
    // 下面多留一點：位置貼在頭像下緣、會凸出來
    padding: 12px 10px 18px 8px;
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

    // 篩選中不能拖：淡掉
    &.off {
        cursor: default;
        opacity: 0.3;
    }
}

.cat-info {
    text-align: left;
    width: 100%;
}

.cat-name {
    display: flex;
    align-items: center;
    gap: 10px;
}

// 性別那一欄固定寬（沒標性別也留著），每張卡片的名字才對得齊
.cat-title {
    display: grid;
    grid-template-columns: 20px 1fr;
    align-items: center;
}

.cat-title-name {
    display: flex;
    align-items: center;
    gap: 6px;
    grid-column: 2;
    grid-row: 1;
    font-size: 17px;
    font-weight: 600;
}

// 名字旁的小圖示：到貓咪檔案（蓋掉全域 a 的紅字、底線）
.cat-profile-link {
    display: inline-flex;
    margin: 0;
    color: #6da2c2;
    text-decoration: none;
}

// 性別符號：緊貼名字左邊（公藍、母粉）
.cat-sex {
    grid-column: 1;
    grid-row: 1;
    // 對齊名字的墨水中心（實測符號高約 1px）
    transform: translateY(1px);

    &.male {
        color: #3f7ea3;
    }

    &.female {
        color: #c0507a;
    }
}

// 暱稱：名字下面一行淡色字，跟名字同一個起點
.cat-nick {
    grid-column: 2;
    grid-row: 2;
    margin-top: 2px;
    color: #8a7f78;
    font-size: 14px;
}

// 列表上的頭像（沒有就顯示名字第一個字），位置貼在下緣中間
.cat-avatar-wrap {
    position: relative;
    flex-shrink: 0;
}

.cat-location {
    position: absolute;
    bottom: -8px;
    left: 50%;
    display: inline-flex;
    align-items: center;
    gap: 1px;
    padding: 0 7px 0 5px;
    border: 2px solid #fff;
    border-radius: 999px;
    background: #eef1f5;
    color: #4f5d70;
    font-size: 11px;
    line-height: 18px;
    white-space: nowrap;
    transform: translateX(-50%);
}

.cat-avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    background: #e8e2dc;
    color: #6b625d;
    font-size: 24px;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

// 右邊的編輯／刪除：小方塊圖示，跟名字同一列靠右。全域 button 樣式要蓋回來
.cat-actions {
    display: flex;
    flex-shrink: 0;
    align-self: center;
    gap: 6px;
    margin-left: auto;

    .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        margin: 0;
        padding: 0;
        border: 1px solid #e3e3e3;
        border-radius: 8px;
        background: #fff;
        color: #657181;
        cursor: pointer;

        &.danger {
            color: #d66;
        }
    }
}

.cat-adopted {
    grid-column: 2;
    margin-top: 2px;
    color: #888;
    font-size: 12px;
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
