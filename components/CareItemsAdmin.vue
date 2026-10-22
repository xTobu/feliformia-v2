<template>
    <div class="care-admin">
        <!-- 新增任何對象（貓咪、全員、位置）的項目；每隻貓的卡片上也有自己的「＋ 新增」 -->
        <div class="page-header">
            <h1>{{ title }}</h1>
            <el-button type="primary" @click="openDialog()">
                ＋ 新增項目
            </el-button>
        </div>

        <!-- 一隻貓一張卡片，順序跟貓咪管理走（要調整請到貓咪管理）。⋮⋮ 在同一張卡片裡拖項目 -->
        <div class="items-list">
            <template v-for="(group, index) in groups" :key="group.key">
                <!-- 兩區都有時各加一個小標題：貓咪／全員與位置（只有一區就不用分） -->
                <div
                    v-if="
                        hasBothSections &&
                        (index === 0 || group.isCat !== groups[index - 1].isCat)
                    "
                    class="section-title"
                    :class="{ later: index > 0 }"
                >
                    {{ group.isCat ? '貓咪' : '全員與位置' }}
                </div>
                <div
                    class="cat-group"
                    :class="{ bare: group.items.length === 0 && !emptyGroupText }"
                >
                    <div class="cat-group-header">
                        <span class="cat-name">{{ group.name }}</span>
                        <span class="cat-count">{{ group.items.length }} 項</span>
                        <el-button
                            class="add-btn"
                            @click="openDialog(null, group.target)"
                        >
                            ＋ 新增
                        </el-button>
                    </div>

                    <div
                        v-if="group.items.length === 0 && emptyGroupText"
                        class="cat-empty"
                    >
                        {{ emptyGroupText }}
                    </div>

                    <!-- 沒設 group，sortable 不會讓項目跨卡片拖；要換對象請在編輯視窗改 -->
                    <draggable
                        v-model="group.items"
                        item-key="id"
                        handle=".item-handle"
                        ghost-class="ghost"
                        @end="onDragEnd"
                    >
                        <template #item="{ element: item }">
                            <div
                                class="cat-item"
                                :class="{
                                    ended: periodStatus(item) === 'ended',
                                }"
                            >
                                <span class="drag-handle item-handle">⋮⋮</span>
                                <div class="cat-item-body">
                                    <div class="tags">
                                        <el-tag
                                            v-if="categories.length > 1"
                                            type="info"
                                            effect="plain"
                                            size="small"
                                        >
                                            {{ item.category }}
                                        </el-tag>
                                        <el-tag
                                            :type="shiftTagType(item.shift)"
                                            size="small"
                                        >
                                            {{ shiftLabel(item.shift) }}
                                        </el-tag>
                                        <el-tag
                                            v-if="item.start_date || item.end_date"
                                            type="info"
                                            size="small"
                                        >
                                            {{ periodLabel(item) }}
                                        </el-tag>
                                        <el-tag
                                            v-if="periodStatus(item) === 'ended'"
                                            type="info"
                                            effect="dark"
                                            size="small"
                                        >
                                            已結束
                                        </el-tag>
                                        <el-tag
                                            v-else-if="
                                                periodStatus(item) === 'upcoming'
                                            "
                                            type="success"
                                            effect="plain"
                                            size="small"
                                        >
                                            未開始
                                        </el-tag>
                                    </div>
                                    <!-- 不用圖示，靠字級與深淺分出內容與原因（內容不加粗，免得跟貓名搶） -->
                                    <div class="item-main">
                                        {{ item[mainField.key] }}
                                    </div>
                                    <div
                                        v-if="reasonField && item[reasonField.key]"
                                        class="item-reason"
                                    >
                                        {{ item[reasonField.key] }}
                                    </div>
                                    <div class="item-actions">
                                        <el-button @click="openDialog(item)">
                                            編輯
                                        </el-button>
                                        <el-button
                                            type="danger"
                                            plain
                                            @click="confirmDelete(item, group.name)"
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
        </div>

        <!-- 空狀態 -->
        <div v-if="groups.length === 0" class="empty">尚無貓咪</div>

        <!-- 新增/編輯 Dialog -->
        <el-dialog
            v-model="dialogVisible"
            :title="editingItem ? '編輯項目' : '新增項目'"
            width="300px"
            class="item-dialog"
        >
            <el-form :model="form" label-position="top" @submit.prevent>
                <el-form-item label="對象">
                    <!-- 貓咪、全員／位置分兩組。不開搜尋：手機點了不會跳出鍵盤 -->
                    <el-select v-model="form.target" placeholder="選擇貓咪或位置">
                        <el-option-group label="貓咪">
                            <el-option
                                v-for="cat in activeCats"
                                :key="cat.id"
                                :label="cat.name"
                                :value="`cat:${cat.id}`"
                            />
                        </el-option-group>
                        <!-- 全員：每隻貓都適用；位置：那個位置的貓都適用；貓屋：整間屋子（只有收尾） -->
                        <el-option-group label="全員／位置">
                            <el-option label="全員" value="all" />
                            <el-option
                                v-if="withHouse"
                                :label="HOUSE"
                                :value="`loc:${HOUSE}`"
                            />
                            <el-option
                                v-for="location in LOCATIONS"
                                :key="location"
                                :label="location"
                                :value="`loc:${location}`"
                            />
                        </el-option-group>
                    </el-select>
                </el-form-item>
                <el-form-item v-if="categories.length" label="類別">
                    <el-select v-model="form.category">
                        <el-option
                            v-for="c in categories"
                            :key="c"
                            :label="c"
                            :value="c"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item :label="mainField.label">
                    <el-input
                        v-model="form.main"
                        type="textarea"
                        :rows="2"
                        :placeholder="mainField.placeholder"
                    />
                </el-form-item>
                <el-form-item v-if="reasonField" :label="reasonField.label">
                    <el-input
                        v-model="form.reason"
                        :placeholder="reasonField.placeholder"
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
                <el-button type="primary" @click="saveItem">儲存</el-button>
            </template>
        </el-dialog>

        <NuxtLink to="/admin" class="back-link">← 返回管理後台</NuxtLink>
    </div>
</template>

<script setup>
// 飲食（diet_items）、醫療（medical_items）、值班收尾（required_items）三頁共用。
// 共同欄位：cat_id / location（兩個都空 = 全員）、shift、start_date / end_date、sort_order。
// 收尾的 location 多一個「貓屋」（withHouse）
import draggable from 'vuedraggable';
import Swal from 'sweetalert2';

const props = defineProps({
    title: { type: String, required: true },
    table: { type: String, required: true },
    // 類別清單（資料庫 check 擋的那幾個），第一個是新增時的預設值；空陣列 = 這張表沒有類別
    categories: { type: Array, default: () => [] },
    // 主要內容欄位：{ key, label, placeholder }
    mainField: { type: Object, required: true },
    // 補充欄位（醫療的原因）：{ key, label, placeholder }，沒有就不顯示
    reasonField: { type: Object, default: null },
    // 沒有項目的貓顯示的文字；空字串就只顯示標題列
    emptyGroupText: { type: String, default: '' },
    // 對象多一個「貓屋」（整間屋子，跟貓無關）。只有收尾用
    withHouse: { type: Boolean, default: false },
});

const supabase = useSupabaseClient();
const { $dayjs } = useNuxtApp();

// 狀態
const items = ref([]);
const groups = ref([]); // [{ key, name, isCat, target, items }]，畫面與拖拉都用這份
const allCats = ref([]); // 含已領養，用來顯示已領養貓的舊項目
const dialogVisible = ref(false);
const editingItem = ref(null);
const form = ref(emptyForm());

const activeCats = computed(() => allCats.value.filter((c) => !c.adopted));

const catGroupCount = computed(() => groups.value.filter((g) => g.isCat).length);
const hasBothSections = computed(
    () => catGroupCount.value > 0 && catGroupCount.value < groups.value.length
);

function emptyForm(target = '') {
    return {
        target,
        category: props.categories[0] || null,
        main: '',
        reason: '',
        shift: 'both',
        start_date: null,
        end_date: null,
    };
}

// 對象在表單裡是一個字串：cat:12、all、loc:客廳
function targetOf(item) {
    if (item.cat_id) return `cat:${item.cat_id}`;
    if (item.location) return `loc:${item.location}`;
    return 'all';
}

function parseTarget(target) {
    if (target.startsWith('cat:')) return { cat_id: Number(target.slice(4)), location: null };
    if (target.startsWith('loc:')) return { cat_id: null, location: target.slice(4) };
    return { cat_id: null, location: null };
}

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

// 期間：NULL 代表該端不限
function periodLabel({ start_date, end_date }) {
    const fmt = (d) => $dayjs(d).format('MM/DD');
    if (start_date && end_date) return `${fmt(start_date)} ~ ${fmt(end_date)}`;
    if (start_date) return `${fmt(start_date)} 起`;
    return `至 ${fmt(end_date)}`;
}

function periodStatus({ start_date, end_date }) {
    const today = $dayjs().format('YYYY-MM-DD');
    if (end_date && end_date < today) return 'ended';
    if (start_date && start_date > today) return 'upcoming';
    return 'active';
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

// 載入資料
async function loadAll() {
    const [{ data: itemData }, { data: catData }] = await Promise.all([
        supabase.from(props.table).select('*').order('sort_order'),
        supabase
            .from('cat_profiles')
            .select('id, name, adopted')
            .order('sort_order'),
    ]);

    if (catData) allCats.value = catData;
    if (itemData) {
        items.value = itemData;
        groups.value = buildGroups(itemData);
    }
}

// 分組：未領養的貓照貓咪管理的順序列出，沒有項目的也列；
// 已領養貓的舊項目接在貓後面；全員、位置放最後（全員 → 貓屋 → 位置，placeRank，跟值班表一致）
function buildGroups(list) {
    const catById = new Map(allCats.value.map((c) => [c.id, c]));
    const catGroups = new Map(
        activeCats.value.map((cat) => [
            `cat:${cat.id}`,
            { name: cat.name, isCat: true, target: `cat:${cat.id}`, items: [] },
        ])
    );
    const otherGroups = new Map();

    for (const item of list) {
        const key = targetOf(item);
        if (item.cat_id) {
            if (!catGroups.has(key)) {
                const cat = catById.get(item.cat_id);
                catGroups.set(key, {
                    name: `${cat?.name || '已刪除'}（已領養）`,
                    isCat: true,
                    target: key,
                    items: [],
                });
            }
            catGroups.get(key).items.push(item);
        } else {
            if (!otherGroups.has(key)) {
                otherGroups.set(key, {
                    name: placeName(item.location),
                    isCat: false,
                    target: key,
                    location: item.location,
                    items: [],
                });
            }
            otherGroups.get(key).items.push(item);
        }
    }

    const others = [...otherGroups.values()].sort(
        (a, b) => placeRank(a.location) - placeRank(b.location)
    );
    return [...catGroups.entries()].map(([key, g]) => ({ key, ...g })).concat(
        others.map((g) => ({ key: g.target, ...g }))
    );
}

// 拖拉結束後，照畫面順序（貓 → 項目）重編 sort_order，只更新有變的
async function onDragEnd() {
    const flat = groups.value.flatMap((group) => group.items);
    const updates = flat
        .map((item, index) => ({ item, sort_order: index + 1 }))
        .filter(({ item, sort_order }) => item.sort_order !== sort_order)
        .map(({ item, sort_order }) => {
            item.sort_order = sort_order;
            return supabase
                .from(props.table)
                .update({ sort_order })
                .eq('id', item.id);
        });

    await Promise.all(updates);
    items.value = flat;
}

// 開啟 Dialog
function openDialog(item = null, target = '') {
    editingItem.value = item;
    form.value = item
        ? {
              target: targetOf(item),
              category: item.category || props.categories[0] || null,
              main: item[props.mainField.key] || '',
              reason: props.reasonField ? item[props.reasonField.key] || '' : '',
              shift: item.shift || 'both',
              start_date: item.start_date || null,
              end_date: item.end_date || null,
          }
        : emptyForm(target);
    dialogVisible.value = true;
}

// 儲存
async function saveItem() {
    if (!form.value.target) {
        Swal.fire({ text: '請選擇對象', confirmButtonColor: '#b33a39' });
        return;
    }

    const main = form.value.main.trim();
    if (!main) {
        Swal.fire({
            text: `請輸入${props.mainField.label}`,
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    const payload = {
        ...parseTarget(form.value.target),
        [props.mainField.key]: main,
        shift: form.value.shift,
        start_date: form.value.start_date || null,
        end_date: form.value.end_date || null,
    };
    if (props.categories.length) payload.category = form.value.category;
    if (props.reasonField) {
        payload[props.reasonField.key] = form.value.reason.trim() || null;
    }

    if (editingItem.value) {
        const { error } = await supabase
            .from(props.table)
            .update(payload)
            .eq('id', editingItem.value.id);

        if (error) {
            Swal.fire({ text: '更新失敗', confirmButtonColor: '#b33a39' });
            return;
        }
    } else {
        const maxOrder =
            items.value.length > 0
                ? Math.max(...items.value.map((i) => i.sort_order || 0))
                : 0;

        const { error } = await supabase
            .from(props.table)
            .insert({ ...payload, sort_order: maxOrder + 1 });

        if (error) {
            Swal.fire({ text: '新增失敗', confirmButtonColor: '#b33a39' });
            return;
        }
    }

    dialogVisible.value = false;
    await loadAll();
}

// 刪除確認
async function confirmDelete(item, groupName) {
    const { isConfirmed } = await Swal.fire({
        text: `確定要刪除「${groupName}」的這個項目嗎？`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });

    if (isConfirmed) {
        const { error } = await supabase
            .from(props.table)
            .delete()
            .eq('id', item.id);

        if (error) {
            Swal.fire({ text: '刪除失敗', confirmButtonColor: '#b33a39' });
            return;
        }

        await loadAll();
    }
}

onMounted(loadAll);
</script>

<style lang="scss" scoped>
.care-admin {
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

.items-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

// 分區小標題：貓咪／全員與位置。第二個標題上方多留空，讓兩區明顯分開
.section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0;
    font-size: 15px;
    font-weight: 500;
    color: #4a4542;
    text-align: left;

    // 標題後面拉一條細線到右邊，讀起來像段落分隔
    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #d8d4d1;
    }

    &.later {
        margin-top: 18px;
    }
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

// 沒有項目又沒有提示文字時，只剩標題列：拿掉它的底線，免得跟卡片外框疊成兩條。
// （class 不叫 empty：會撞到下面空狀態的 .empty）
.cat-group.bare .cat-group-header {
    border-bottom: none;
}

.cat-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    // 左邊 14px：貓名跟下面項目的 ⋮⋮ 對齊（.cat-item 8px ＋ 把手的 -4px margin ＋ 10px padding）
    padding: 10px 8px 10px 14px;
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

.cat-item {
    display: flex;
    gap: 6px;
    padding: 10px 8px;
    background: #fff;
    text-align: left;

    & + .cat-item {
        border-top: 1px solid #eee;
    }

    &.ended {
        background: #fafafa;

        .item-main,
        .item-reason {
            color: #aaa;
        }
    }
}

.drag-handle {
    cursor: grab;
    color: #999;
    user-select: none;

    &:hover {
        color: #666;
    }

    &:active {
        cursor: grabbing;
    }
}

// 加大可點範圍讓手指好抓，負 margin 抵銷掉，版面位置不變
.item-handle {
    font-size: 14px;
    letter-spacing: -2px;
    line-height: 8px;
    padding: 12px 10px;
    margin: -8px -4px;
}

.cat-item-body {
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

    .item-main {
        font-size: 15px;
        color: #222;
        line-height: 1.4;
        white-space: pre-line;
    }

    // #767676 在白底剛好 4.5:1（WCAG AA），#aaa 只有 2.3:1，手機上看不清
    .item-reason {
        font-size: 14px;
        color: #767676;
        line-height: 1.4;
    }

    .item-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;

        // 拿掉 Element 相鄰按鈕的 12px margin-left，間距只看 gap
        :deep(.el-button + .el-button) {
            margin-left: 0;
        }
    }
}

.cat-empty {
    padding: 12px 8px 12px 38px;
    font-size: 14px;
    color: #767676;
    text-align: left;
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
:deep(.item-dialog) {
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
