<template>
    <ClientOnly>
        <div id="notices-admin">
            <h1>醫療事項管理</h1>

            <!-- 新增按鈕 -->
            <div class="actions">
                <el-button type="primary" @click="openDialog()">
                    新增事項
                </el-button>
            </div>

            <!-- 事項列表 - 拖拉排序 -->
            <draggable
                v-model="notices"
                item-key="id"
                handle=".drag-handle"
                ghost-class="ghost"
                @end="onDragEnd"
                class="notices-list"
            >
                <template #item="{ element: notice }">
                    <div class="notice-item">
                        <span class="drag-handle">☰</span>
                        <div class="notice-info">
                            <div class="notice-header">
                                <span class="notice-name">{{
                                    notice.name
                                }}</span>
                                <el-tag
                                    :type="shiftTagType(notice.shift)"
                                    size="small"
                                >
                                    {{ shiftLabel(notice.shift) }}
                                </el-tag>
                            </div>
                            <div class="notice-treatment" v-if="notice.treatment">
                                {{ notice.treatment }}
                            </div>
                            <div class="notice-reason" v-if="notice.reason">
                                💡 {{ notice.reason }}
                            </div>
                               
                            <div class="notice-actions">
                                <el-button @click="openDialog(notice)">
                                    編輯
                                </el-button>
                                <el-button
                                    type="danger"
                                    @click="confirmDelete(notice)"
                                >
                                    刪除
                                </el-button>
                            </div>
                            
                        </div>
                    </div>
                </template>
            </draggable>

            <!-- 空狀態 -->
            <div v-if="notices.length === 0" class="empty">尚無特殊事項</div>

            <!-- 新增/編輯 Dialog -->
            <el-dialog
                v-model="dialogVisible"
                :title="editingNotice ? '編輯事項' : '新增事項'"
                width="300px"
            >
                <el-form :model="form" label-width="40px" @submit.prevent>
                    <el-form-item label="貓咪">
                        <el-select
                            v-model="form.name"
                            placeholder="選擇貓咪"
                            filterable
                            allow-create
                            default-first-option
                        >
                            <el-option
                                v-for="cat in cats"
                                :key="cat.id"
                                :label="cat.name.split(/[：:]/)[0]"
                                :value="cat.name.split(/[：:]/)[0]"
                            />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="事項">
                        <el-input
                            v-model="form.treatment"
                            type="textarea"
                            :rows="2"
                            placeholder="例如：消化酵素迷你膠囊4顆放飼料上"
                        />
                    </el-form-item>
                    <el-form-item label="原因">
                        <el-input
                            v-model="form.reason"
                            placeholder="例如：胰臟炎"
                        />
                    </el-form-item>
                    <el-form-item label="班別">
                        <el-radio-group v-model="form.shift">
                            <el-radio value="morning">早班</el-radio>
                            <el-radio value="night">晚班</el-radio>
                            <el-radio value="both">早晚班</el-radio>
                        </el-radio-group>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="saveNotice"
                        >儲存</el-button
                    >
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
    title: '特殊事項管理',
});

const supabase = useSupabaseClient();

// 狀態
const notices = ref([]);
const cats = ref([]);
const dialogVisible = ref(false);
const editingNotice = ref(null);
const form = ref({
    name: '',
    treatment: '',
    reason: '',
    shift: 'both',
});

// 班別標籤
function shiftLabel(shift) {
    const labels = {
        both: '早晚班',
        morning: '早班',
        night: '晚班',
    };
    return labels[shift] || shift;
}

function shiftTagType(shift) {
    const types = {
        both: 'warning',
        morning: 'success',
        night: 'primary',
    };
    return types[shift] || '';
}

// 載入資料
async function loadNotices() {
    const { data } = await supabase.from('notices').select('*').order('order');

    if (data) {
        notices.value = data;
    }
}

async function loadCats() {
    const { data } = await supabase
        .from('cats')
        .select('id, name')
        .eq('adopted', false)
        .order('order');
    if (data) {
        cats.value = data;
    }
}

// 拖拉結束後更新排序
async function onDragEnd() {
    const updates = notices.value.map((notice, index) =>
        supabase
            .from('notices')
            .update({ order: index + 1 })
            .eq('id', notice.id)
    );

    await Promise.all(updates);
}

// 開啟 Dialog
function openDialog(notice = null) {
    editingNotice.value = notice;
    if (notice) {
        form.value = {
            name: notice.name,
            treatment: notice.treatment || '',
            reason: notice.reason || '',
            shift: notice.shift || 'both',
        };
    } else {
        form.value = {
            name: '',
            treatment: '',
            reason: '',
            shift: 'both',
        };
    }
    dialogVisible.value = true;
}

// 儲存事項
async function saveNotice() {
    if (!form.value.name.trim()) {
        Swal.fire({
            text: '請選擇貓咪',
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    if (!form.value.treatment.trim()) {
        Swal.fire({
            text: '請輸入事項',
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    if (editingNotice.value) {
        // 編輯
        const { error } = await supabase
            .from('notices')
            .update({
                name: form.value.name,
                treatment: form.value.treatment,
                reason: form.value.reason || null,
                shift: form.value.shift,
            })
            .eq('id', editingNotice.value.id);

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
            notices.value.length > 0
                ? Math.max(...notices.value.map((n) => n.order || 0))
                : 0;

        const { error } = await supabase.from('notices').insert({
            name: form.value.name,
            treatment: form.value.treatment,
            reason: form.value.reason || null,
            shift: form.value.shift,
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
    await loadNotices();
}

// 刪除確認
async function confirmDelete(notice) {
    const { isConfirmed } = await Swal.fire({
        text: `確定要刪除「${notice.name}」的事項嗎？`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });

    if (isConfirmed) {
        const { error } = await supabase
            .from('notices')
            .delete()
            .eq('id', notice.id);

        if (error) {
            Swal.fire({
                text: '刪除失敗',
                confirmButtonColor: '#b33a39',
            });
            return;
        }

        await loadNotices();
    }
}

// 初始化
onMounted(() => {
    loadNotices();
    loadCats();
});
</script>

<style lang="scss" scoped>
#notices-admin {
    max-width: 650px;
    margin: 0 auto;
    padding-bottom: 80px;

    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }

    :deep(.el-select) {
        width: 100%;
    }

    :deep(.el-radio-group) {
        display: flex;
        gap: 16px;
        justify-content: start;
        .el-radio {
            margin-right: 0;
        }
    }
}

.actions {
    margin-bottom: 16px;
}

.notices-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.notice-item {
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

.notice-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    text-align: left;
    .notice-header {
        display: flex;
        align-items: center;
        gap: 8px;
        .notice-name {
            font-weight: 500;
        }
    }
   
    .notice-treatment {
        font-size: 14px;
        color: #333;
        line-height: 1.4;
    }

    .notice-reason {
        font-size: 14px;
        color: #888;
    }

    .notice-actions {
        width: 100%;
        display: flex;
        justify-content: flex-end;
        gap: 4px;
    }
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
