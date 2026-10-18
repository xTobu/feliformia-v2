<template>
    <div class="care-admin">
        <!-- 已有項目的貓在卡片上新增；這顆是給卡片上沒有的貓（或「全員」等非貓咪項目）用的 -->
        <div class="page-header">
            <h1>{{ title }}</h1>
            <el-button type="primary" @click="openDialog()">
                {{ addLabel }}
            </el-button>
        </div>

        <!-- 一隻貓一張卡片，順序跟貓咪管理走（要調整請到貓咪管理）。⋮⋮ 在同一隻貓裡拖項目 -->
        <div class="notices-list">
            <template v-for="(group, index) in groups" :key="group.key">
                <!-- 兩區都有時各加一個小標題：貓咪／全員與區域（只有一區就不用分） -->
                <div
                    v-if="
                        hasBothSections &&
                        (index === 0 || group.isCat !== groups[index - 1].isCat)
                    "
                    class="section-title"
                    :class="{ later: index > 0 }"
                >
                    {{ group.isCat ? '貓咪' : '全員與區域' }}
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
                            @click="openDialog(null, group.name)"
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

                    <!-- 沒設 group，sortable 不會讓項目跨貓拖；要換貓請在編輯視窗改 -->
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
                                <span class="drag-handle item-handle">⋮⋮</span>
                                <div class="cat-notice-body">
                                    <div class="tags">
                                        <el-tag
                                            v-if="categories.length > 1"
                                            type="info"
                                            effect="plain"
                                            size="small"
                                        >
                                            {{ categoryLabel(notice.category) }}
                                        </el-tag>
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
                                                periodStatus(notice) === 'ended'
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
                                    <!-- 不用圖示，靠字級與深淺分出內容與原因（內容不加粗，免得跟貓名搶） -->
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
                                        <el-button @click="openDialog(notice)">
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
        </div>

        <!-- 空狀態 -->
        <div v-if="groups.length === 0" class="empty">{{ emptyText }}</div>

        <!-- 新增/編輯 Dialog -->
        <el-dialog
            v-model="dialogVisible"
            :title="editingNotice ? '編輯項目' : '新增項目'"
            width="300px"
            class="notice-dialog"
        >
            <el-form :model="form" label-position="top" @submit.prevent>
                <el-form-item label="貓咪">
                    <!-- 貓咪、全員／區域分兩組；也可以手動輸入不在清單上的名稱 -->
                    <el-select
                        v-model="form.name"
                        placeholder="選擇貓咪或手動輸入"
                        filterable
                        allow-create
                        default-first-option
                    >
                        <el-option-group label="貓咪">
                            <el-option
                                v-for="cat in cats"
                                :key="cat.id"
                                :label="shortName(cat.name)"
                                :value="shortName(cat.name)"
                            />
                        </el-option-group>
                        <!-- 全員：每隻貓都適用；房間：那個房間的貓都適用（值班表備餐分頁會併進每隻貓） -->
                        <el-option-group label="全員／區域">
                            <el-option label="全員" value="全員" />
                            <el-option
                                v-for="room in ROOMS"
                                :key="room"
                                :label="room"
                                :value="room"
                            />
                        </el-option-group>
                    </el-select>
                </el-form-item>
                <el-form-item label="類別">
                    <!-- 只列這一頁的類別；要搬到另一頁，用下面的「移到…」。
                         下拉選單不開搜尋：手機點了不會跳出鍵盤 -->
                    <el-select v-model="form.category">
                        <el-option
                            v-for="c in pageCategories"
                            :key="c.value"
                            :label="c.label"
                            :value="c.value"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item :label="labels.treatment">
                    <el-input
                        v-model="form.treatment"
                        type="textarea"
                        :rows="2"
                        :placeholder="placeholders.treatment"
                    />
                </el-form-item>
                <el-form-item :label="labels.reason">
                    <el-input
                        v-model="form.reason"
                        :placeholder="placeholders.reason"
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

                <!-- 只有編輯時才能搬：例如舊資料歸成醫療的隨餐藥，要搬到飲食與待辦 -->
                <div v-if="editingNotice" class="move-row">
                    <el-button link type="primary" @click="moveToOtherPage">
                        移到{{ otherPage.page }}
                    </el-button>
                </div>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveNotice">儲存</el-button>
            </template>
        </el-dialog>

        <NuxtLink to="/admin" class="back-link">← 返回管理後台</NuxtLink>
    </div>
</template>

<script setup>
// 飲食與待辦與醫療管理共用。兩頁的資料都在 notices 表，靠 category 分開：
// dry 乾乾、wet 罐罐、supplement 補充、diet_other 其他、todo 待辦 → 飲食與待辦；
// medical 醫療、medication 吃藥、other 其他 → 醫療管理
// （藥一律歸醫療管理，就算是拌在飯裡的）
import draggable from 'vuedraggable';
import Swal from 'sweetalert2';
import { ElMessage } from 'element-plus';

const props = defineProps({
    title: { type: String, required: true },
    // 這一頁管的類別，第一個是新增時的預設值
    categories: { type: Array, required: true },
    addLabel: { type: String, default: '＋ 全員或其他' },
    emptyText: { type: String, default: '尚無項目' },
    // 沒有項目的貓顯示的文字；空字串就只顯示標題列
    emptyGroupText: { type: String, default: '' },
    labels: {
        type: Object,
        default: () => ({ treatment: '事項', reason: '原因' }),
    },
    placeholders: {
        type: Object,
        default: () => ({ treatment: '', reason: '' }),
    },
});

const ALL_CATEGORIES = [
    { value: 'dry', label: '乾乾', page: '飲食與待辦' },
    { value: 'wet', label: '罐罐', page: '飲食與待辦' },
    { value: 'supplement', label: '補充', page: '飲食與待辦' },
    // value 跟醫療管理的 other 分開，兩頁的「其他」才不會混在一起
    { value: 'diet_other', label: '其他', page: '飲食與待辦' },
    // 值班要做、要打勾的事（例如小房間柵欄雙層扣），在值班表備餐分頁打勾
    { value: 'todo', label: '待辦', page: '飲食與待辦' },
    { value: 'medical', label: '醫療', page: '醫療管理' },
    { value: 'medication', label: '吃藥', page: '醫療管理' },
    { value: 'other', label: '其他', page: '醫療管理' },
];

const catGroupCount = computed(() => groups.value.filter((g) => g.isCat).length);
const hasBothSections = computed(
    () => catGroupCount.value > 0 && catGroupCount.value < groups.value.length
);

const pageCategories = computed(() =>
    ALL_CATEGORIES.filter((c) => props.categories.includes(c.value))
);

// 另一頁與搬過去時的類別：搬到飲食與待辦預設補充，搬到醫療管理預設吃藥
const otherPage = computed(() => {
    const others = ALL_CATEGORIES.filter((c) => !props.categories.includes(c.value));
    const target = others.find((c) => ['supplement', 'medication'].includes(c.value)) || others[0];
    return { page: target.page, category: target.value };
});

const supabase = useSupabaseClient();
const { $dayjs } = useNuxtApp();

// 狀態
const notices = ref([]);
const groups = ref([]); // [{ key, name, items: [notice] }]，畫面與拖拉都用這份
const cats = ref([]);
const dialogVisible = ref(false);
const editingNotice = ref(null);
const form = ref(emptyForm());

function emptyForm(name = '') {
    return {
        name,
        category: props.categories[0],
        treatment: '',
        reason: '',
        shift: 'both',
        start_date: null,
        end_date: null,
    };
}

// 貓咪管理的名稱可能是「名字：說明」，只取冒號前面
function shortName(name) {
    return (name || '').split(/[：:]/)[0];
}

function categoryLabel(value) {
    return ALL_CATEGORIES.find((c) => c.value === value)?.label || value;
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

// 期間：NULL 代表該端不限
function periodLabel({ start_date, end_date }) {
    const fmt = (d) => $dayjs(d).format('MM/DD');
    if (start_date && end_date) return `${fmt(start_date)} ~ ${fmt(end_date)}`;
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
async function loadAll() {
    const [{ data: noticeData }, { data: catData }] = await Promise.all([
        supabase
            .from('notices')
            .select('*')
            .in('category', props.categories)
            .order('order'),
        supabase
            .from('cats')
            .select('id, name')
            .eq('adopted', false)
            .order('order'),
    ]);

    if (catData) cats.value = catData;
    if (noticeData) {
        notices.value = noticeData;
        groups.value = buildGroups(noticeData);
    }
}

// 分組：有 cat_id 的照貓分，沒有的（全員、小房間…）照 name 分。
// 列出所有未領養的貓（照貓咪管理的順序），沒有項目的也列；
// 非貓咪的組放在貓後面，順序是全員 → 房間 → 手動輸入的（placeRank，跟值班表一致）。
// 對不到現有貓的 cat_id（例如已領養）排在貓的後面
function buildGroups(list) {
    const catById = new Map(cats.value.map((c) => [c.id, c]));
    const keyOf = (n) => (n.cat_id ? `cat:${n.cat_id}` : `name:${n.name}`);
    const nameOf = (n) =>
        n.cat_id && catById.has(n.cat_id)
            ? shortName(catById.get(n.cat_id).name)
            : n.name;

    const catGroups = new Map(
        cats.value.map((cat) => [`cat:${cat.id}`, { name: shortName(cat.name), items: [] }])
    );
    const otherGroups = new Map();
    for (const n of list) {
        const target = n.cat_id ? catGroups : otherGroups;
        if (!target.has(keyOf(n))) target.set(keyOf(n), { name: nameOf(n), items: [] });
        target.get(keyOf(n)).items.push(n);
    }

    const toList = (map, isCat) =>
        [...map].map(([key, g]) => ({ key, isCat, ...g }));
    const others = toList(otherGroups, false).sort(
        (a, b) => placeRank(a.name) - placeRank(b.name)
    );
    return [...toList(catGroups, true), ...others];
}

// 拖拉結束後，照畫面順序（貓 → 項目）重編這一頁的 order，只更新有變的。
// 兩頁各自從 1 編，數字會跟另一頁重疊；同一隻貓裡的相對順序才有意義
async function onDragEnd() {
    const flat = groups.value.flatMap((group) => group.items);
    const updates = flat
        .map((notice, index) => ({ notice, order: index + 1 }))
        .filter(({ notice, order }) => notice.order !== order)
        .map(({ notice, order }) => {
            notice.order = order;
            return supabase.from('notices').update({ order }).eq('id', notice.id);
        });

    await Promise.all(updates);
    notices.value = flat;
}

// 開啟 Dialog
function openDialog(notice = null, catName = '') {
    editingNotice.value = notice;
    // 有 cat_id 的一律帶貓咪管理上的名字：項目上存的可能是舊名或暱稱（例如「老俗」），
    // 直接帶進來存檔時會對不到貓，cat_id 就被清掉了
    const cat = notice?.cat_id && cats.value.find((c) => c.id === notice.cat_id);
    form.value = notice
        ? {
              name: cat ? shortName(cat.name) : notice.name,
              category: notice.category || props.categories[0],
              treatment: notice.treatment || '',
              reason: notice.reason || '',
              shift: notice.shift || 'both',
              start_date: notice.start_date || null,
              end_date: notice.end_date || null,
          }
        : emptyForm(catName);
    dialogVisible.value = true;
}

// 移到另一頁：換類別後直接存檔（視窗裡其他欄位的修改也一起存）
async function moveToOtherPage() {
    form.value.category = otherPage.value.category;
    await saveNotice();
}

// 儲存
async function saveNotice() {
    const name = form.value.name.trim();
    if (!name) {
        Swal.fire({ text: '請選擇貓咪', confirmButtonColor: '#b33a39' });
        return;
    }

    if (!form.value.treatment.trim()) {
        Swal.fire({
            text: `請輸入${props.labels.treatment}`,
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    // 名字對得到貓就記 cat_id；對不到（全員、小房間…）就只存 name
    const cat = cats.value.find((c) => shortName(c.name) === name);
    const payload = {
        name,
        cat_id: cat ? cat.id : null,
        category: form.value.category,
        treatment: form.value.treatment,
        reason: form.value.reason || null,
        shift: form.value.shift,
        start_date: form.value.start_date || null,
        end_date: form.value.end_date || null,
    };

    if (editingNotice.value) {
        const { error } = await supabase
            .from('notices')
            .update(payload)
            .eq('id', editingNotice.value.id);

        if (error) {
            Swal.fire({ text: '更新失敗', confirmButtonColor: '#b33a39' });
            return;
        }
    } else {
        const maxOrder =
            notices.value.length > 0
                ? Math.max(...notices.value.map((n) => n.order || 0))
                : 0;

        const { error } = await supabase
            .from('notices')
            .insert({ ...payload, order: maxOrder + 1 });

        if (error) {
            Swal.fire({ text: '新增失敗', confirmButtonColor: '#b33a39' });
            return;
        }
    }

    // 選了另一頁的類別：存好了，但會從這一頁消失，提醒一下去哪找
    if (!props.categories.includes(payload.category)) {
        const target = ALL_CATEGORIES.find((c) => c.value === payload.category);
        ElMessage.success(`已移到「${target.page}」`);
    }

    dialogVisible.value = false;
    await loadAll();
}

// 刪除確認
async function confirmDelete(notice) {
    const { isConfirmed } = await Swal.fire({
        text: `確定要刪除「${notice.name}」的這個項目嗎？`,
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

.notices-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

// 分區小標題：貓咪／全員與區域。第二個標題上方多留空，讓兩區明顯分開
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

.cat-empty {
    padding: 12px 8px 12px 38px;
    font-size: 14px;
    color: #767676;
    text-align: left;
}

.move-row {
    text-align: left;
    margin-top: -4px;
}
</style>
