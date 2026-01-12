<template>
    <ClientOnly>
        <div id="vote-options-admin">
            <h1>投票選項管理</h1>

            <!-- 新增按鈕 -->
            <div class="actions">
                <el-button type="primary" @click="openDialog()">
                    新增選項
                </el-button>
            </div>

            <!-- 選項列表 - 拖拉排序 -->
            <draggable
                v-model="options"
                item-key="id"
                handle=".drag-handle"
                ghost-class="ghost"
                @end="onDragEnd"
                class="options-list"
            >
                <template #item="{ element: option }">
                    <div class="option-item">
                        <div class="option-left">
                            <span class="drag-handle">☰</span>
                            <span class="option-name">{{ option.name }}</span>
                            <el-tag
                                v-if="option.shift === 'morning'"
                                size="small"
                            >
                                僅早班
                            </el-tag>
                            <el-tag
                                v-if="option.shift === 'night'"
                                size="small"
                            >
                                僅晚班
                            </el-tag>
                            <el-tag
                                v-if="option.has_time_range"
                                size="small"
                                type="info"
                            >
                                需填時間
                            </el-tag>
                            <el-tag
                                v-if="option.skip_empty_check"
                                size="small"
                                type="warning"
                            >
                                不檢查空班
                            </el-tag>
                            <el-tag
                                v-if="!option.is_active"
                                size="small"
                                type="danger"
                            >
                                已停用
                            </el-tag>
                        </div>
                        <div class="option-actions">
                            <el-button size="small" @click="openDialog(option)">
                                編輯
                            </el-button>
                            <el-button
                                size="small"
                                type="danger"
                                @click="confirmDelete(option)"
                            >
                                刪除
                            </el-button>
                        </div>
                    </div>
                </template>
            </draggable>

            <!-- 空狀態 -->
            <div v-if="options.length === 0" class="empty">
                尚無選項，請新增
            </div>

            <!-- 新增/編輯 Dialog -->
            <el-dialog
                v-model="dialogVisible"
                :title="editingOption ? '編輯選項' : '新增選項'"
                width="300px"
            >
                <el-form :model="form" label-width="70px" @submit.prevent>
                    <el-form-item label="選項名稱">
                        <el-input
                            v-model="form.name"
                            placeholder="例如：醫療"
                        />
                    </el-form-item>
                    <el-form-item label="適用班別">
                        <el-radio-group v-model="form.shift">
                            <el-radio value="morning">早班</el-radio>
                            <el-radio value="night">晚班</el-radio>
                            <el-radio value="both">早晚班</el-radio>

                        </el-radio-group>
                    </el-form-item>
                    <el-form-item label="需填時間">
                        <div class="switch-with-hint">
                            <el-switch v-model="form.has_time_range" />
                            <span class="hint">啟用後，投票時需填寫時段</span>
                        </div>
                    </el-form-item>
                    <el-form-item label="空班無視">
                        <div class="switch-with-hint">
                            <el-switch v-model="form.skip_empty_check" />
                            <span class="hint"
                                >啟用後，不列入空班提示與統計</span
                            >
                        </div>
                    </el-form-item>
                    <el-form-item label="啟用狀態">
                        <el-switch v-model="form.is_active" />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="saveOption"
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
    title: '投票選項管理',
});

const supabase = useSupabaseClient();

// 狀態
const options = ref([]);
const dialogVisible = ref(false);
const editingOption = ref(null);
const form = ref({
    name: '',
    shift: 'both',
    has_time_range: false,
    skip_empty_check: false,
    is_active: true,
});

// 載入選項
async function loadOptions() {
    const { data } = await supabase
        .from('vote_options')
        .select('*')
        .order('sort_order');

    if (data) {
        options.value = data;
    }
}

// 拖拉結束後更新排序
async function onDragEnd() {
    const updates = options.value.map((option, index) =>
        supabase
            .from('vote_options')
            .update({ sort_order: index })
            .eq('id', option.id)
    );

    await Promise.all(updates);
}

// 開啟 Dialog
function openDialog(option = null) {
    editingOption.value = option;
    if (option) {
        form.value = {
            name: option.name,
            shift: option.shift || 'both',
            has_time_range: option.has_time_range,
            skip_empty_check: option.skip_empty_check || false,
            is_active: option.is_active,
        };
    } else {
        form.value = {
            name: '',
            shift: 'both',
            has_time_range: false,
            skip_empty_check: false,
            is_active: true,
        };
    }
    dialogVisible.value = true;
}

// 儲存選項
async function saveOption() {
    if (!form.value.name.trim()) {
        Swal.fire({
            text: '請輸入選項名稱',
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    if (editingOption.value) {
        // 編輯
        const { error } = await supabase
            .from('vote_options')
            .update({
                name: form.value.name,
                shift: form.value.shift,
                has_time_range: form.value.has_time_range,
                skip_empty_check: form.value.skip_empty_check,
                is_active: form.value.is_active,
            })
            .eq('id', editingOption.value.id);

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
            options.value.length > 0
                ? Math.max(...options.value.map((o) => o.sort_order))
                : 0;

        const { error } = await supabase.from('vote_options').insert({
            name: form.value.name,
            shift: form.value.shift,
            has_time_range: form.value.has_time_range,
            skip_empty_check: form.value.skip_empty_check,
            is_active: form.value.is_active,
            is_exclusive: false,
            sort_order: maxOrder + 1,
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
    await loadOptions();
}

// 刪除確認
async function confirmDelete(option) {
    const { isConfirmed } = await Swal.fire({
        text: `確定要刪除「${option.name}」嗎？`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });

    if (isConfirmed) {
        const { error } = await supabase
            .from('vote_options')
            .delete()
            .eq('id', option.id);

        if (error) {
            Swal.fire({
                text: '刪除失敗',
                confirmButtonColor: '#b33a39',
            });
            return;
        }

        await loadOptions();
    }
}

// 初始化
onMounted(() => {
    loadOptions();
});
</script>

<style lang="scss" scoped>
#vote-options-admin {
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;

    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }
}

.actions {
    margin-bottom: 16px;
}

.options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.option-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: box-shadow 0.2s;

    &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
}

.option-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.drag-handle {
    cursor: grab;
    color: #999;
    font-size: 16px;
    padding: 4px;
    user-select: none;

    &:hover {
        color: #666;
    }

    &:active {
        cursor: grabbing;
    }
}

.option-name {
    font-weight: 500;
}

.option-actions {
    display: flex;
    gap: 4px;
}

.switch-with-hint {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.hint {
    font-size: 12px;
    color: #999;
    line-height: 1.4;
}

.empty {
    text-align: center;
    color: #999;
    padding: 40px 20px;
    background: #f9f9f9;
    border-radius: 8px;
}

/* 拖拉時的樣式 */
.ghost {
    opacity: 0.5;
    background: #e8f4f8;
    border: 1px dashed #6da2c2;
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

:deep(.el-dialog) {
    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        .el-button {
            width: auto !important;
        }
    }
}
</style>
