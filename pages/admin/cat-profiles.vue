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
                            <div class="cat-name">{{ cat.name }}</div>
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

            <!-- 新增/編輯 Dialog -->
            <el-dialog
                v-model="dialogVisible"
                :title="editingCat ? '編輯貓咪' : '新增貓咪'"
                width="300px"
                class="cat-dialog"
            >
                <el-form :model="form" label-position="top" @submit.prevent>
                    <el-form-item label="名稱">
                        <el-input
                            v-model="form.name"
                            placeholder="例如：大哥"
                        />
                    </el-form-item>
                    <el-form-item label="位置">
                        <!-- 不開搜尋：手機點了不會跳出鍵盤 -->
                        <el-select
                            v-model="form.location"
                            placeholder="選擇位置"
                            clearable
                        >
                            <el-option
                                v-for="location in LOCATIONS"
                                :key="location"
                                :label="location"
                                :value="location"
                            />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="已領養" v-if="editingCat">
                        <el-switch v-model="form.adopted" />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="saveCat">儲存</el-button>
                </template>
            </el-dialog>

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

// 狀態
const cats = ref([]);
const dialogVisible = ref(false);
const editingCat = ref(null);
const form = ref(emptyForm());

function emptyForm() {
    return { name: '', location: '', adopted: false };
}

// 載入貓咪
async function loadCats() {
    const { data } = await supabase
        .from('cat_profiles')
        .select('*')
        .order('sort_order');

    if (data) {
        cats.value = data;
    }
}

// 拖拉結束後更新排序，只更新有變的
async function onDragEnd() {
    const updates = cats.value
        .map((cat, index) => ({ cat, sort_order: index + 1 }))
        .filter(({ cat, sort_order }) => cat.sort_order !== sort_order)
        .map(({ cat, sort_order }) => {
            cat.sort_order = sort_order;
            return supabase
                .from('cat_profiles')
                .update({ sort_order })
                .eq('id', cat.id);
        });

    await Promise.all(updates);
}

// 開啟 Dialog
function openDialog(cat = null) {
    editingCat.value = cat;
    form.value = cat
        ? {
              name: cat.name,
              location: cat.location || '',
              adopted: cat.adopted,
          }
        : emptyForm();
    dialogVisible.value = true;
}

// 儲存貓咪
async function saveCat() {
    const name = form.value.name.trim();
    if (!name) {
        Swal.fire({
            text: '請輸入貓咪名稱',
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    const payload = {
        name,
        location: form.value.location || null,
        adopted: form.value.adopted,
    };

    if (editingCat.value) {
        // 編輯
        const { error } = await supabase
            .from('cat_profiles')
            .update(payload)
            .eq('id', editingCat.value.id);

        if (error) {
            Swal.fire({
                text: '更新失敗',
                confirmButtonColor: '#b33a39',
            });
            return;
        }
    } else {
        // 新增
        const maxOrder =
            cats.value.length > 0
                ? Math.max(...cats.value.map((c) => c.sort_order || 0))
                : 0;

        const { error } = await supabase
            .from('cat_profiles')
            .insert({ ...payload, sort_order: maxOrder + 1 });

        if (error) {
            Swal.fire({
                text: '新增失敗',
                confirmButtonColor: '#b33a39',
            });
            return;
        }
    }

    dialogVisible.value = false;
    await loadCats();
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

    if (isConfirmed) {
        const { error } = await supabase
            .from('cat_profiles')
            .delete()
            .eq('id', cat.id);

        if (error) {
            Swal.fire({
                text: '刪除失敗',
                confirmButtonColor: '#b33a39',
            });
            return;
        }

        await loadCats();
    }
}

// 初始化
onMounted(() => {
    loadCats();
});
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

    :deep(.el-select) {
        width: 100%;
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
    font-weight: 500;
    font-size: 14px;
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

:deep(.el-dialog) {
    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        .el-button {
            width: auto !important;
        }
    }
}

// 標籤放在欄位上方，欄位佔滿整個寬度（300px 的視窗放左邊標籤會把欄位擠窄）
:deep(.cat-dialog) {
    .el-form-item {
        flex-direction: column;
        align-items: stretch;
        margin-bottom: 14px;
    }

    .el-form-item__label {
        justify-content: flex-start;
        height: auto;
        padding: 0;
        margin-bottom: 4px;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: #767676;
    }

    // 欄位高度統一 40px（全域把 select 設成 45px，其他輸入框是 32px）
    .el-select__wrapper,
    .el-input__wrapper {
        height: 40px;
        min-height: 40px;
        box-sizing: border-box;
    }

    .el-input {
        height: 40px;
    }

    .el-dialog__footer .el-button {
        flex: 1;
    }
}
</style>
