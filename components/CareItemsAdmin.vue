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
                    :class="{ bare: groupCount(group) === 0 && !emptyGroupText }"
                >
                    <div class="cat-group-header">
                        <span class="cat-name">{{ group.name }}</span>
                        <span class="cat-count">{{ groupCount(group) }} 項</span>
                        <el-button
                            class="add-btn"
                            @click="openDialog(null, group.target)"
                        >
                            ＋ 新增
                        </el-button>
                    </div>

                    <div
                        v-if="groupCount(group) === 0 && emptyGroupText"
                        class="cat-empty"
                    >
                        {{ emptyGroupText }}
                    </div>

                    <!-- 照班別分區（早班、晚班、早晚班），一區一個小標題（班別是有顏色的小色塊）；觀察管理多一層：
                         「剛到」「離開」大標只出現一次，下面再分班別。各區自己拖，不會跨區、跨卡片
                         （沒設 group，sortable 不會讓項目跨清單拖；要換班別、類別請在編輯視窗改） -->
                    <template v-for="(section, sectionIndex) in group.sections" :key="section.key">
                        <div
                            v-if="section.prefix && section.prefix !== group.sections[sectionIndex - 1]?.prefix"
                            class="item-block"
                        >
                            {{ section.prefix }}
                        </div>
                        <div class="item-section" :class="{ nested: section.prefix }">
                            <span class="shift-tag" :class="section.shift">{{ section.shiftLabel }}</span>
                        </div>
                        <draggable
                            v-model="section.items"
                            item-key="id"
                            handle=".item-handle"
                            ghost-class="ghost"
                            @end="onDragEnd"
                        >
                            <!-- 一項一列：標題、下面一行小字（類別、說明、期間），右邊編輯／刪除小圖示（班別看所在的分區）。
                                 （vuedraggable 的 #item 只能有一個根元素，註解放在外面） -->
                            <template #item="{ element: item }">
                                <div class="cat-item" :class="{ ended: periodStatus(item) === 'ended' }">
                                    <span class="drag-handle item-handle">⋮⋮</span>
                                    <div class="cat-item-body">
                                        <div class="item-main">{{ itemTitle(item) }}</div>
                                        <div
                                            v-if="itemMeta(item) || ['ended', 'upcoming'].includes(periodStatus(item))"
                                            class="item-meta"
                                        >
                                            <span v-if="periodStatus(item) === 'ended'" class="status ended">已結束</span>
                                            <span v-else-if="periodStatus(item) === 'upcoming'" class="status upcoming"
                                                >未開始</span
                                            >
                                            {{ itemMeta(item) }}
                                        </div>
                                    </div>
                                    <div class="item-actions">
                                        <button type="button" class="icon-btn" aria-label="編輯" @click="openDialog(item)">
                                            <Icon icon="mdi:pencil-outline" width="16" />
                                        </button>
                                        <button
                                            type="button"
                                            class="icon-btn danger"
                                            aria-label="刪除"
                                            @click="confirmDelete(item, group.name)"
                                        >
                                            <Icon icon="mdi:trash-can-outline" width="16" />
                                        </button>
                                    </div>
                                </div>
                            </template>
                        </draggable>
                    </template>
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
                        <!-- 有分組（觀察管理的剛到／離開）就分組列出 -->
                        <template v-if="categoryGroups.length">
                            <el-option-group v-for="g in categoryGroups" :key="g.label" :label="g.label">
                                <el-option v-for="c in g.categories" :key="c" :label="c" :value="c" />
                            </el-option-group>
                        </template>
                        <template v-else>
                            <el-option
                                v-for="c in categories"
                                :key="c"
                                :label="c"
                                :value="c"
                            />
                        </template>
                    </el-select>
                </el-form-item>
                <el-form-item :label="mainOptional ? `${mainField.label}（選填）` : mainField.label">
                    <el-input
                        v-model="form.main"
                        type="textarea"
                        :rows="2"
                        :placeholder="
                            (mainOptional && mainField.optionalPlaceholder) || mainField.placeholder
                        "
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
import { Icon } from '@iconify/vue';
import Swal from 'sweetalert2';

const props = defineProps({
    title: { type: String, required: true },
    table: { type: String, required: true },
    // 類別清單（資料庫 check 擋的那幾個），第一個是新增時的預設值；空陣列 = 這張表沒有類別
    categories: { type: Array, default: () => [] },
    // 類別分組（選填）：[{ label, categories }]，下拉選單與清單都分組顯示（觀察管理：剛到／離開）
    categoryGroups: { type: Array, default: () => [] },
    // 清單每一項的標題用類別（觀察管理：拍剩食），說明放到下面那行小字；預設標題是主要內容
    titleIsCategory: { type: Boolean, default: false },
    // 主要內容欄位：{ key, label, placeholder[, optionalFor, optionalPlaceholder] }
    //   optionalFor：這些類別可以不填內容（存空字串），例如飲食的「放風」
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
    return [...catGroups.entries()]
        .map(([key, g]) => ({ key, ...g }))
        .concat(others.map((g) => ({ key: g.target, ...g })))
        .map(({ items: groupItems, ...g }) => ({ ...g, sections: sectionsOf(groupItems) }));
}

// 一張卡片裡的項目分區：早班、晚班、早晚班各一區（有類別分組的再分，小標題是「剛到 [早班]」），
// 空的區不顯示；每一區自己拖，拖曳只會在同一區
const SHIFTS = [
    { value: 'morning', label: '早班' },
    { value: 'night', label: '晚班' },
    { value: 'both', label: '早晚班' },
];
function sectionsOf(list) {
    const categoryGroups = props.categoryGroups.length ? props.categoryGroups : [{ label: '', categories: null }];
    return categoryGroups
        .flatMap((g) =>
            SHIFTS.map((shift) => ({
                key: `${g.label}-${shift.value}`,
                prefix: g.label,
                shift: shift.value,
                shiftLabel: shift.label,
                items: list.filter(
                    (i) => i.shift === shift.value && (!g.categories || g.categories.includes(i.category))
                ),
            }))
        )
        .filter((section) => section.items.length);
}


const groupCount = (group) => group.sections.reduce((sum, section) => sum + section.items.length, 0);

// 每一項的標題與下面那行小字
function itemTitle(item) {
    if (props.titleIsCategory) return item.category;
    return item[props.mainField.key] || item.category || '';
}

function itemMeta(item) {
    const parts = [
        !props.titleIsCategory && props.categories.length > 1 ? item.category : '',
        props.titleIsCategory ? item[props.mainField.key] : '',
        props.reasonField ? item[props.reasonField.key] : '',
        item.start_date || item.end_date ? periodLabel(item) : '',
    ];
    return parts.filter(Boolean).join(' · ');
}

// 拖拉結束後，照畫面順序（貓 → 項目）重編 sort_order，只更新有變的
async function onDragEnd() {
    const flat = groups.value.flatMap((group) => group.sections.flatMap((section) => section.items));
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
// 這個類別的內容可以不填（mainField.optionalFor）
const mainOptional = computed(() =>
    (props.mainField.optionalFor || []).includes(form.value.category)
);

async function saveItem() {
    if (!form.value.target) {
        Swal.fire({ text: '請選擇對象' });
        return;
    }

    const main = form.value.main.trim();
    if (!main && !mainOptional.value) {
        Swal.fire({
            text: `請輸入${props.mainField.label}`,
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
            Swal.fire({ text: '更新失敗' });
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
            Swal.fire({ text: '新增失敗' });
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
            Swal.fire({ text: '刪除失敗' });
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

// 一項一列：⋮⋮、標題＋一行小字、右邊編輯／刪除
.cat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    background: #fff;
    text-align: left;

    & + .cat-item {
        border-top: 1px solid #eee;
    }

    &.ended {
        background: #fafafa;

        .item-main {
            color: #aaa;
        }
    }
}

// 觀察管理的「剛到」「離開」大標：比班別小標深一點、字大一點
.item-block {
    padding: 6px 12px;
    border-top: 1px solid #e3e0dd;
    background: #f2f0ee;
    color: #4a4542;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
}

// 分區小標題：淡灰底，班別是有顏色的小色塊（早班綠、晚班藍、早晚班橘）；在「剛到／離開」底下的往右縮一點
.item-section {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-top: 1px solid #eee;
    background: #fafafa;
    color: #8e8783;
    font-size: 12px;
    text-align: left;

    &.nested {
        padding-left: 24px;
    }

    .shift-tag {
        padding: 0 6px;
        border-radius: 4px;
        line-height: 18px;

        &.morning {
            background: #e3f1dc;
            color: #4f7243;
        }

        &.night {
            background: #e1ecf4;
            color: #3f7ea3;
        }

        &.both {
            background: #fdf1e6;
            color: #b5602a;
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
    gap: 2px;
    flex: 1;
    min-width: 0;

    .item-main {
        font-size: 15px;
        color: #222;
        line-height: 1.4;
        white-space: pre-line;
    }

    // 補充：類別、說明或原因、班別、期間（#767676 在白底剛好 4.5:1，手機上看得清）
    .item-meta {
        font-size: 12px;
        color: #767676;
        line-height: 1.4;

        .status {
            margin-right: 4px;

            &.ended {
                color: #aaa;
            }

            &.upcoming {
                color: #67c23a;
            }
        }
    }
}

// 右邊的編輯／刪除：小方塊圖示。全域 button 樣式要蓋回來
.item-actions {
    display: flex;
    flex-shrink: 0;
    gap: 6px;

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
