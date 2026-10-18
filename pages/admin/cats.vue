<template>
    <ClientOnly>
        <div id="cats-admin">
            <div class="page-header">
                <h1>貓咪管理</h1>
                <el-button type="primary" @click="openDialog()">
                    ＋ 新增貓咪
                </el-button>
            </div>

            <!-- 貓咪列表 - 拖拉排序 -->
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
                            <!-- 飲食改在「飲食與待辦」設定，這裡不再顯示 diet_note -->
                            <div class="cat-name">{{ cat.name }}</div>
                            <div
                                v-if="cat.nicknames?.length"
                                class="cat-nicknames"
                            >
                                <span
                                    v-for="nickname in cat.nicknames"
                                    :key="nickname"
                                    class="nick-chip"
                                    >{{ nickname }}</span
                                >
                            </div>
                            <div class="cat-meta">
                                <div class="cat-status">
                                    <span v-if="cat.room"
                                        >📍 {{ cat.room }}</span
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
            >
                <el-form :model="form" label-width="70px" @submit.prevent>
                    <el-form-item label="名稱">
                        <el-input
                            v-model="form.name"
                            placeholder="例如：噗噗"
                        />
                    </el-form-item>
                    <el-form-item label="暱稱">
                        <!-- 輸入後按 Enter 變成一個標籤，可以填多個 -->
                        <el-input-tag
                            v-model="form.nicknames"
                            placeholder="輸入後按 Enter"
                        />
                    </el-form-item>
                    <el-form-item label="房間">
                        <el-select
                            v-model="form.room"
                            placeholder="選擇房間"
                            clearable
                            filterable
                            allow-create
                            default-first-option
                        >
                            <el-option
                                v-for="room in ROOMS"
                                :key="room"
                                :label="room"
                                :value="room"
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
const form = ref({
    name: '',
    nicknames: [],
    room: '',
    adopted: false,
});

// 載入貓咪
async function loadCats() {
    const { data } = await supabase.from('cats').select('*').order('order');

    if (data) {
        cats.value = data;
    }
}

// 拖拉結束後更新排序
async function onDragEnd() {
    const updates = cats.value.map((cat, index) =>
        supabase
            .from('cats')
            .update({ order: index + 1 })
            .eq('id', cat.id)
    );

    await Promise.all(updates);
}

// 開啟 Dialog
function openDialog(cat = null) {
    editingCat.value = cat;
    if (cat) {
        form.value = {
            name: cat.name,
            nicknames: [...(cat.nicknames || [])],
            room: cat.room || '',
            adopted: cat.adopted || false,
        };
    } else {
        form.value = {
            name: '',
            nicknames: [],
            room: '',
            adopted: false,
        };
    }
    dialogVisible.value = true;
}

// 去掉空白、重複，以及跟名稱本身一樣的暱稱
function cleanNicknames() {
    const name = form.value.name.trim();
    return [
        ...new Set(
            (form.value.nicknames || [])
                .map((n) => n.trim())
                .filter((n) => n && n !== name)
        ),
    ];
}

// 儲存貓咪
async function saveCat() {
    if (!form.value.name.trim()) {
        Swal.fire({
            text: '請輸入貓咪名稱',
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    if (editingCat.value) {
        // 編輯
        const { error } = await supabase
            .from('cats')
            // 不送 diet_note：舊值留在資料庫，/regular、/shift 在貓沒有主食時當備援
            .update({
                name: form.value.name,
                nicknames: cleanNicknames(),
                room: form.value.room || null,
                adopted: form.value.adopted,
            })
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
                ? Math.max(...cats.value.map((c) => c.order || 0))
                : 0;

        const { error } = await supabase.from('cats').insert({
            name: form.value.name,
            nicknames: cleanNicknames(),
            room: form.value.room || null,
            adopted: form.value.adopted,
            order: maxOrder + 1,
        });

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

// 刪除確認
async function confirmDelete(cat) {
    const { isConfirmed } = await Swal.fire({
        text: `確定要刪除「${cat.name.split('：')[0]}」嗎？`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });

    if (isConfirmed) {
        const { error } = await supabase.from('cats').delete().eq('id', cat.id);

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
#cats-admin {
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

// 跟飲食與待辦、醫療管理一致：標題靠左、新增按鈕靠右
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

// 暱稱：一個名字一個小灰標籤，不用前綴文字或圖示
.cat-nicknames {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
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

.cat-adopted {
    color: #e6a23c;
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

:deep(.el-form-item) {
    align-items: center;
}
</style>
