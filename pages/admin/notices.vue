<template>
    <ClientOnly>
        <div id="notices-admin">
            <!-- 已有事項的貓在卡片上新增；這顆是給還沒有事項的貓用的 -->
            <div class="page-header">
                <h1>餵藥及特殊飲食管理</h1>
                <el-button type="primary" @click="openDialog()">
                    ＋ 其他貓咪
                </el-button>
            </div>

            <!-- 事項列表：一隻貓一張卡片。☰ 拖整隻貓，⋮⋮ 在同一隻貓裡拖事項 -->
            <draggable
                v-model="groups"
                item-key="name"
                handle=".group-handle"
                ghost-class="ghost"
                @end="onDragEnd"
                class="notices-list"
            >
                <template #item="{ element: group }">
                    <div class="cat-group">
                        <div class="cat-group-header">
                            <span class="drag-handle group-handle">☰</span>
                            <span class="cat-name">{{ group.name }}</span>
                            <span class="cat-count"
                                >{{ group.items.length }} 項</span
                            >
                            <el-button
                                class="add-btn"
                                @click="openDialog(null, group.name)"
                            >
                                ＋ 新增
                            </el-button>
                        </div>

                        <!-- 沒設 group，sortable 不會讓事項跨貓拖；要換貓請在編輯視窗改 -->
                        <draggable
                            v-model="group.items"
                            item-key="id"
                            handle=".item-handle"
                            ghost-class="ghost"
                            @end="onDragEnd"
                        >
                            <template #item="{ element: notice }">
                                <div
                                    class="cat-notice"
                                    :class="{
                                        ended: periodStatus(notice) === 'ended',
                                    }"
                                >
                                    <span class="drag-handle item-handle"
                                        >⋮⋮</span
                                    >
                                    <div class="cat-notice-body">
                                        <div class="tags">
                                            <el-tag
                                                :type="shiftTagType(notice.shift)"
                                                size="small"
                                            >
                                                {{ shiftLabel(notice.shift) }}
                                            </el-tag>
                                            <el-tag
                                                v-if="
                                                    notice.start_date ||
                                                    notice.end_date
                                                "
                                                type="info"
                                                size="small"
                                            >
                                                {{ periodLabel(notice) }}
                                            </el-tag>
                                            <el-tag
                                                v-if="
                                                    periodStatus(notice) ===
                                                    'ended'
                                                "
                                                type="info"
                                                effect="dark"
                                                size="small"
                                            >
                                                已結束
                                            </el-tag>
                                            <el-tag
                                                v-else-if="
                                                    periodStatus(notice) ===
                                                    'upcoming'
                                                "
                                                type="success"
                                                effect="plain"
                                                size="small"
                                            >
                                                未開始
                                            </el-tag>
                                        </div>
                                        <!-- 不用圖示，靠字級與深淺分出事項與原因（事項不加粗，免得跟貓名搶） -->
                                        <div class="notice-treatment">
                                            {{ notice.treatment }}
                                        </div>
                                        <div
                                            class="notice-reason"
                                            v-if="notice.reason"
                                        >
                                            {{ notice.reason }}
                                        </div>
                                        <div class="notice-actions">
                                            <el-button
                                                @click="openDialog(notice)"
                                            >
                                                編輯
                                            </el-button>
                                            <el-button
                                                type="danger"
                                                plain
                                                @click="confirmDelete(notice)"
                                            >
                                                刪除
                                            </el-button>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </draggable>
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
                class="notice-dialog"
            >
                <el-form :model="form" label-position="top" @submit.prevent>
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
                    <el-form-item label="期間（留空代表不限）">
                        <!-- 不用 daterange：它的面板 646px 寬，手機會爆版 -->
                        <div class="period-row">
                            <el-date-picker
                                v-model="form.start_date"
                                type="date"
                                value-format="YYYY-MM-DD"
                                format="MM/DD"
                                placeholder="開始"
                                @change="onStartDateChange"
                            />
                            <span>~</span>
                            <el-date-picker
                                v-model="form.end_date"
                                type="date"
                                value-format="YYYY-MM-DD"
                                format="MM/DD"
                                placeholder="結束"
                                :disabled-date="(d) => isBefore(d, form.start_date)"
                            />
                        </div>
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
const { $dayjs } = useNuxtApp();

// 狀態
const notices = ref([]);
const groups = ref([]); // [{ name, items: [notice] }]，畫面與拖拉都用這份
const cats = ref([]);
const dialogVisible = ref(false);
const editingNotice = ref(null);
const form = ref({
    name: '',
    treatment: '',
    reason: '',
    shift: 'both',
    start_date: null,
    end_date: null,
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

// 療程期間：NULL 代表該端不限
function periodLabel({ start_date, end_date }) {
    const fmt = (d) => $dayjs(d).format('MM/DD');
    if (start_date && end_date) return `${fmt(start_date)}~${fmt(end_date)}`;
    if (start_date) return `${fmt(start_date)} 起`;
    return `至 ${fmt(end_date)}`;
}

// 開始日不設限，選到結束日之後就清掉結束日，讓使用者重選
function onStartDateChange(start) {
    if (start && form.value.end_date && start > form.value.end_date) {
        form.value.end_date = null;
    }
}

function isBefore(date, limit) {
    return !!limit && $dayjs(date).isBefore(limit, 'day');
}

function periodStatus({ start_date, end_date }) {
    const today = $dayjs().format('YYYY-MM-DD');
    if (end_date && end_date < today) return 'ended';
    if (start_date && start_date > today) return 'upcoming';
    return 'active';
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
        groups.value = groupByCat(data);
    }
}

// 依貓咪名字分組，組的順序看該貓第一筆事項的 order（data 已照 order 排好）
function groupByCat(list) {
    const map = new Map();
    for (const notice of list) {
        if (!map.has(notice.name)) map.set(notice.name, []);
        map.get(notice.name).push(notice);
    }
    return [...map].map(([name, items]) => ({ name, items }));
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

// 拖拉結束後，照畫面順序（貓 → 事項）重編 order，只更新有變的
async function onDragEnd() {
    const flat = groups.value.flatMap((group) => group.items);
    const updates = flat
        .map((notice, index) => ({ notice, order: index + 1 }))
        .filter(({ notice, order }) => notice.order !== order)
        .map(({ notice, order }) => {
            notice.order = order;
            return supabase
                .from('notices')
                .update({ order })
                .eq('id', notice.id);
        });

    await Promise.all(updates);
    notices.value = flat;
}

// 開啟 Dialog
function openDialog(notice = null, catName = '') {
    editingNotice.value = notice;
    if (notice) {
        form.value = {
            name: notice.name,
            treatment: notice.treatment || '',
            reason: notice.reason || '',
            shift: notice.shift || 'both',
            start_date: notice.start_date || null,
            end_date: notice.end_date || null,
        };
    } else {
        form.value = {
            name: catName,
            treatment: '',
            reason: '',
            shift: 'both',
            start_date: null,
            end_date: null,
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

    const start_date = form.value.start_date || null;
    const end_date = form.value.end_date || null;

    if (editingNotice.value) {
        // 編輯
        const { error } = await supabase
            .from('notices')
            .update({
                name: form.value.name,
                treatment: form.value.treatment,
                reason: form.value.reason || null,
                shift: form.value.shift,
                start_date,
                end_date,
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
            start_date,
            end_date,
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

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 16px;

    h1 {
        margin: 0;
        font-size: 22px;
        text-align: left;
    }

    .el-button {
        flex-shrink: 0;
    }
}

.notices-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cat-group {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    transition: box-shadow 0.2s;

    &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
}

.cat-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    background: #f4f5f5;
    border-bottom: 1px solid #e0e0e0;

    .cat-name {
        font-weight: 500;
    }

    .cat-count {
        font-size: 12px;
        color: #999;
    }

    .add-btn {
        margin-left: auto;
    }
}

.cat-notice {
    display: flex;
    gap: 6px;
    padding: 10px 8px;
    background: #fff;
    text-align: left;

    & + .cat-notice {
        border-top: 1px solid #eee;
    }

    &.ended {
        background: #fafafa;

        .notice-treatment,
        .notice-reason {
            color: #aaa;
        }
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

.item-handle {
    font-size: 14px;
    letter-spacing: -2px;
}

// 加大可點範圍讓手指好抓，負 margin 抵銷掉，版面位置不變
.group-handle,
.item-handle {
    height: auto;
    padding: 12px 10px;
    margin: -8px -4px;
}

.cat-notice-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .notice-treatment {
        font-size: 15px;
        color: #222;
        line-height: 1.4;
    }

    // #767676 在白底剛好 4.5:1（WCAG AA），#aaa 只有 2.3:1，手機上看不清
    .notice-reason {
        font-size: 14px;
        color: #767676;
        line-height: 1.4;
    }

    .notice-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;

        // 拿掉 Element 相鄰按鈕的 12px margin-left，間距只看 gap
        :deep(.el-button + .el-button) {
            margin-left: 0;
        }
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

// 標籤放在欄位上方，欄位佔滿整個寬度（300px 的視窗放左邊標籤會把欄位擠窄）
:deep(.notice-dialog) {
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

.period-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;

    :deep(.el-date-editor) {
        flex: 1;
        min-width: 0;
    }
}

</style>
