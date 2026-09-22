<template>
    <ClientOnly>
        <div v-loading="loading" id="calendar">
            <!-- 篩選（左）＋ 檢視切換（右） -->
            <div class="cal-top">
                <div class="cal-filter">
                    <button type="button" class="filter-btn" @click="openFilter">
                        <el-icon><Filter /></el-icon>
                    </button>
                    <span class="filter-status" v-if="hasActiveFilter">篩選中</span>
                </div>

                <el-switch
                    v-model="isListView"
                    active-text="列表"
                    inactive-text="月曆"
                />
            </div>

            <el-dialog v-model="filterVisible" title="篩選條件" width="300px">
                <el-form
                    :model="filterDraft"
                    label-position="top"
                    @submit.prevent
                >
                    <el-form-item>
                        <template #label>
                            <span class="label-row">
                                活動人員
                                <button
                                    type="button"
                                    class="only-mine"
                                    v-if="myId"
                                    @click="pickOnlyMine"
                                >
                                    只看我的
                                </button>
                            </span>
                        </template>
                        <el-select
                            v-model="filterDraft.people"
                            multiple
                            filterable
                            clearable
                            placeholder="不限"
                        >
                            <el-option
                                v-for="item in volunteerList"
                                :key="item.value"
                                :label="item.label"
                                :value="item.value"
                            />
                        </el-select>
                    </el-form-item>

                    <el-form-item label="類型">
                        <el-select
                            v-model="filterDraft.types"
                            multiple
                            clearable
                            placeholder="不限"
                        >
                            <el-option
                                v-for="item in typeList"
                                :key="item.value"
                                :label="item.label"
                                :value="item.value"
                            >
                                <span :style="{ color: item.color }">{{ item.label }}</span>
                            </el-option>
                        </el-select>
                    </el-form-item>

                    <el-form-item label="內容">
                        <el-input
                            v-model="filterDraft.keyword"
                            placeholder="搜尋備註內容"
                            clearable
                        />
                    </el-form-item>
                </el-form>

                <template #footer>
                    <el-button @click="clearFilterDraft">清除</el-button>
                    <el-button type="primary" @click="applyFilter">套用</el-button>
                </template>
            </el-dialog>

            <!-- 月曆 -->
            <el-calendar
                ref="calendarRef"
                v-model="cursor"
                v-if="!isListView"
            >
                <template #header>
                    <div class="cal-header">
                        <button type="button" class="nav" @click="goto('prev-year')">&laquo;</button>
                        <button type="button" class="nav" @click="goto('prev-month')">&lsaquo;</button>
                        <span class="cal-title">
                            {{ $dayjs(cursor).format('YYYY 年 M 月') }}
                        </span>
                        <button type="button" class="nav" @click="goto('next-month')">&rsaquo;</button>
                        <button type="button" class="nav" @click="goto('next-year')">&raquo;</button>
                        <button type="button" class="today-btn" @click="goToday">
                            今天
                        </button>
                    </div>
                </template>

                <template #date-cell="{ data }">
                    <div
                        class="cell"
                        :class="{
                            other: data.type !== 'current-month',
                            today: data.day === today,
                            picked: data.day === selectedDate,
                        }"
                        @click="pickDate(data.day)"
                    >
                        <span class="num">{{ Number(data.day.slice(-2)) }}</span>
                        <span
                            v-for="ev in eventsByDate[data.day] || []"
                            :key="ev.recordId"
                            class="tag"
                            :class="[`type-${ev.type}`, { unstaffed: isUnstaffed(ev) }]"
                        >
                            {{ eventLabel(ev) }}
                        </span>
                    </div>
                </template>
            </el-calendar>

            <!-- 列表檢視：當月全部活動，依日期分組 -->
            <div class="month-list" v-if="isListView">
                <!-- 列表有自己的月份選擇器。月曆是 v-if，切過來時 calendarRef
                     已經不存在，所以這裡不能用 goto()，直接算 cursor -->
                <div class="cal-header list-nav">
                    <button type="button" class="nav" @click="shiftMonth(-12)">&laquo;</button>
                    <button type="button" class="nav" @click="shiftMonth(-1)">&lsaquo;</button>
                    <span class="cal-title">
                        {{ $dayjs(cursor).format('YYYY 年 M 月') }}
                    </span>
                    <button type="button" class="nav" @click="shiftMonth(1)">&rsaquo;</button>
                    <button type="button" class="nav" @click="shiftMonth(12)">&raquo;</button>
                    <button type="button" class="today-btn" @click="goToday">
                        今天
                    </button>
                </div>

                <div class="list-body" ref="listBodyRef">
                    <div
                        v-for="group in monthGroups"
                        :key="group.date"
                        class="list-group"
                        :data-date="group.date"
                    >
                        <!-- 點日期等同在月曆上點那格 -->
                        <button
                            type="button"
                            class="list-date"
                            :class="{
                                picked: group.date === selectedDate,
                                today: group.isToday,
                            }"
                            @click="pickDate(group.date)"
                        >
                            <span class="d-day">{{ group.day }}</span>
                            <span class="d-week">{{ group.weekday }}</span>
                            <span class="d-count">
                                {{ group.events.length }} 個活動
                            </span>
                        </button>

                        <button
                            type="button"
                            v-for="ev in group.events"
                            :key="ev.recordId"
                            class="list-item"
                            :class="[
                                `type-${ev.type}`,
                                { unstaffed: isUnstaffed(ev) },
                            ]"
                            @click="openEvent(ev)"
                        >
                            <div class="li-head">
                                <span class="li-badge">{{ typeLabel(ev.type) }}</span>
                                <span class="li-time">
                                    {{ ev.timeStart }} ~ {{ ev.timeEnd }}
                                </span>
                            </div>

                            <!-- 內容不截斷，列表就是拿來好好讀的 -->
                            <div class="li-content">{{ ev.content }}</div>

                            <div class="li-people">
                                <el-icon>
                                    <WarningFilled v-if="isUnstaffed(ev)" />
                                    <UserFilled v-else />
                                </el-icon>
                                <span class="li-names">
                                    <template v-if="!eventPeople(ev).length"><span class="li-none">無</span></template>
                                    <template v-else>{{ shownPeople(ev).join('、') }}<span
                                            v-if="hiddenPeopleCount(ev)"
                                            class="more"
                                            @click.stop="togglePeople(ev.recordId)"
                                        >+{{ hiddenPeopleCount(ev) }}</span><span
                                            v-else-if="expandedPeople[ev.recordId]"
                                            class="more"
                                            @click.stop="togglePeople(ev.recordId)"
                                        >收起</span></template>
                                </span>
                            </div>
                        </button>
                    </div>

                    <div class="list-empty" v-if="!monthGroups.length">
                        本月沒有活動
                    </div>
                    </div>
            </div>

            <!-- 類型配色 -->
            <div class="cal-legend">
                <span
                    v-for="item in typeList"
                    :key="item.value"
                    class="legend-item"
                    :class="`type-${item.value}`"
                >
                    {{ item.label }}
                </span>
            </div>

            <!-- 新增入口。固定位置、兩種檢視都一樣，
                 不用再靠「取消選取某一筆」來達成新增 -->
            <div class="add-bar" v-if="canEdit">
                <button type="button" class="btn add-btn" @click="openCreate">
                    ＋
                    {{ selectedDate ? `在 ${$dayjs(selectedDate).format('M/D')} 新增活動` : '新增活動' }}
                </button>
            </div>

            <!-- 當天活動：月曆模式點了日期才出現，純檢視。
                 點卡片是「打開來看／改」，不會靜靜把資料塞進某張常駐表單 -->
            <div class="day-panel" v-if="!isListView && selectedDate">
                <div class="day-panel-head">
                    <span class="dp-date">{{ dayPanelLabel }}</span>
                    <span class="dp-count">{{ dayEvents.length }} 個活動</span>
                </div>

                <div class="day-events" v-if="dayEvents.length">
                    <button
                        type="button"
                        v-for="ev in dayEvents"
                        :key="ev.recordId"
                        class="day-event"
                        :class="[
                            `type-${ev.type}`,
                            { unstaffed: isUnstaffed(ev) },
                        ]"
                        @click="openEvent(ev)"
                    >
                        <span class="ev-time">{{ ev.timeStart }} ~ {{ ev.timeEnd }}</span>
                        <span class="ev-content">{{ ev.content }}</span>
                        <span
                            class="ev-people"
                            :class="{ expanded: expandedPeople[ev.recordId] }"
                        >
                            <template v-if="!eventPeople(ev).length">無</template>
                            <template v-else>{{ shownPeople(ev).join('、') }}<span
                                    v-if="hiddenPeopleCount(ev)"
                                    class="more"
                                    @click.stop="togglePeople(ev.recordId)"
                                >+{{ hiddenPeopleCount(ev) }}</span><span
                                    v-else-if="expandedPeople[ev.recordId]"
                                    class="more"
                                    @click.stop="togglePeople(ev.recordId)"
                                >收起</span></template>
                        </span>
                    </button>
                </div>

                <p class="day-empty" v-else>這天沒有活動</p>
            </div>

            <!-- 活動表單。做成 dialog 是為了把「檢視 / 新增 / 編輯」分開：
                 表單只在明確要新增、或要看某一筆時才出現，關掉就等於取消。
                 標題直接寫明現在是哪一種模式 -->
            <el-dialog
                v-model="formVisible"
                :title="formTitle"
                @closed="resetForm"
                width="390px"
            >
                <div class="dialog-form">
                    <!-- 日期 -->
                    <div class="field" :class="{ invalid: errors.date }">
                        <label>日期 <i>*</i></label>
                        <el-date-picker
                            v-model="formData.date"
                            type="date"
                            value-format="YYYY-MM-DD"
                            placeholder="請選擇日期"
                            :clearable="false"
                            :disabled="!canEdit"
                            @change="onDateChange"
                        />
                    </div>

                <!-- 活動時間 -->
                <div class="field" :class="{ invalid: errors.time }">
                    <label>活動時間 <i>*</i></label>
                    <div class="time-row">
                        <el-time-select
                            v-model="formData.timeStart"
                            start="06:00"
                            end="23:45"
                            step="00:15"
                            placeholder="開始時間"
                            :disabled="!canEdit"
                            @change="onTimeStartChange"
                        />
                        <span class="time-sep">→</span>
                        <el-time-select
                            v-model="formData.timeEnd"
                            start="06:00"
                            end="23:45"
                            step="00:15"
                            :min-time="formData.timeStart"
                            placeholder="結束時間"
                            :disabled="!canEdit"
                        />
                    </div>
                </div>

                <!-- 類型 -->
                <div class="field" :class="{ invalid: errors.type }">
                    <label>類型 <i>*</i></label>
                    <el-select
                        v-model="formData.type"
                        placeholder="請選擇活動類型"
                        :disabled="!canEdit"
                        :class="formData.type ? `type-text-${formData.type}` : ''"
                    >
                        <el-option
                            v-for="item in typeList"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        >
                            <span :style="{ color: item.color }">{{ item.label }}</span>
                        </el-option>
                    </el-select>
                </div>

                <!-- 提示該活動之人員 -->
                <div class="field" :class="{ invalid: errors.notifyRoles }">
                    <label>活動人員 <i>*</i></label>
                    <el-select
                        v-model="formData.notifyRoles"
                        multiple
                        placeholder="請選擇相關人員"
                        :disabled="!canEdit"
                    >
                        <el-option
                            v-for="item in roleList"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </div>

                <!-- 早班人員 -->
                <div class="field" v-if="formData.notifyRoles.includes('morning')">
                    <label>早班人員</label>
                    <div class="hint" v-if="!formData.date">請先選擇日期</div>
                    <div class="roster" v-else-if="rosterMorning.length">
                        <span class="chip" v-for="name in rosterMorning" :key="name">
                            {{ name }}
                        </span>
                    </div>
                    <div class="warn" v-else>
                        <el-icon><WarningFilled /></el-icon> 無人值班
                    </div>
                </div>

                <!-- 晚班人員 -->
                <div class="field" v-if="formData.notifyRoles.includes('night')">
                    <label>晚班人員</label>
                    <div class="hint" v-if="!formData.date">請先選擇日期</div>
                    <div class="roster" v-else-if="rosterNight.length">
                        <span class="chip" v-for="name in rosterNight" :key="name">
                            {{ name }}
                        </span>
                    </div>
                    <div class="warn" v-else>
                        <el-icon><WarningFilled /></el-icon> 無人值班
                    </div>
                </div>

                <!-- 負責人 -->
                <div class="field" v-if="formData.notifyRoles.includes('owner')">
                    <label>負責人</label>
                    <el-select
                        v-model="formData.owners"
                        multiple
                        filterable
                        clearable
                        placeholder="請選擇負責人"
                        :disabled="!canEdit"
                    >
                        <el-option
                            v-for="item in volunteerList"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </div>

                <!-- 內容 -->
                <div class="field" :class="{ invalid: errors.content }">
                    <label>內容 <i>*</i></label>
                    <el-input
                        type="textarea"
                        v-model="formData.content"
                        placeholder="請描述活動內容"
                        :disabled="!canEdit"
                    />
                </div>
                </div>

                <template #footer>
                    <div class="dialog-actions" v-if="canEdit">
                        <!-- 左右各包一個自己的容器。直接對 el-button 下 :deep()
                             在這個 slot 裡沒吃到，用自家元素排版最保險 -->
                        <span class="da-left">
                            <el-button
                                type="danger"
                                plain
                                v-if="formData.recordId"
                                @click="DeleteEvent"
                            >
                                刪除
                            </el-button>
                        </span>

                        <span class="da-right">
                            <el-button @click="formVisible = false">取消</el-button>
                            <el-button
                                type="primary"
                                :loading="saving"
                                @click="Submit"
                            >
                                {{ formData.recordId ? '確認更新' : '確認送出' }}
                            </el-button>
                        </span>
                    </div>

                    <template v-else>
                        <p class="perm-hint">
                            唯讀：只有管理員可以新增、編輯或刪除活動
                        </p>
                        <el-button @click="formVisible = false">關閉</el-button>
                    </template>
                </template>
            </el-dialog>

        </div>

        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
import Swal from 'sweetalert2';
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash-es';
import { WarningFilled, Filter, UserFilled } from '@element-plus/icons-vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '行事曆',
});

const supabase = useSupabaseClient();
const { $dayjs } = useNuxtApp();
const { getUserId, isAdmin, profileLoaded } = useProfile();
const { get: getStorage, set: setStorage } = useLocalStorage();

const typeList = [
    { value: 'volunteer', label: '體驗', color: '#409eff' },
    { value: 'supplies', label: '物資', color: '#67c23a' },
    { value: 'dispatch', label: '出車', color: '#e6a23c' },
    { value: 'post', label: '社群', color: '#7c5cf0' },
    { value: 'other', label: '其他', color: '#303133' },
];

const roleList = [
    { value: 'morning', label: '早班' },
    { value: 'night', label: '晚班' },
    { value: 'owner', label: '負責人' },
];

// State
const loading = ref(true);
const saving = ref(false);
const calendarRef = ref(null);
const listBodyRef = ref(null);
const cursor = ref(new Date());
const today = $dayjs().format('YYYY-MM-DD');

const events = ref([]);
const volunteerList = ref([]);
const voteOptions = ref([]);
const allUsers = ref([]); // 解 votes.user_id → 暱稱用
const votes = ref([]); // 目前顯示範圍所涵蓋的週投票資料
const realtimeChannel = ref(null);
const errors = ref({}); // 哪些必填欄位沒填，key 見 FIELD_ORDER
const expandedPeople = ref({}); // 活動列表右側的名字有沒有被展開，key 是 recordId
// filter 是「已套用」的條件，filterDraft 是 modal 裡編輯中的草稿。
// 分開是因為有「套用」按鈕：改到一半關掉 modal 不該影響畫面。
const EMPTY_FILTER = { people: [], types: [], keyword: '' };
const filter = ref({ ...EMPTY_FILTER });
const filterDraft = ref({ ...EMPTY_FILTER });
const filterVisible = ref(false);
const isListView = ref(false); // false = 月曆、true = 列表
// 檢視中選的那一天。跟 formData.date 刻意分開 ——
// 前者是「我在看哪天」，後者是「我正在編輯的那筆活動是哪天」。
// 以前共用一個值，導致點日期就等於進入編輯狀態
const selectedDate = ref('');
const formVisible = ref(false); // 活動表單 dialog

const formData = ref({
    recordId: '',
    date: '',
    timeStart: '',
    timeEnd: '',
    type: '',
    notifyRoles: [],
    owners: [],
    content: '',
});

// Computed

// 新增／編輯／刪除都只有管理員可以做，一般志工唯讀。
// 這裡只決定欄位能不能動、按鈕要不要出現 ——
// 真正擋得住的是 server/utils/auth.js 的 requireAdmin()
const canEdit = computed(() => isAdmin.value);
// 還沒載完 profile 前不要先跳「唯讀」，避免管理員看到一閃而過的提示
const readOnly = computed(() => profileLoaded.value && !canEdit.value);
// dialog 標題直接講清楚現在是哪一種模式，不用從送出按鈕的字去猜
const formTitle = computed(() => {
    if (readOnly.value) return '活動詳情';
    return formData.value.recordId ? '編輯活動' : '新增活動';
});

const myId = computed(() => getUserId());

// 這筆活動要提示到的人（user id）。用 id 不用暱稱，暱稱會撞名。
function eventPeopleIds(ev) {
    const roles = ev.notifyRoles || [];
    const ids = [];

    if (roles.includes('owner')) ids.push(...(ev.owners || []));
    if (roles.includes('morning')) ids.push(...rosterEntries(ev.date, 'morning').map((e) => e.userId));
    if (roles.includes('night')) ids.push(...rosterEntries(ev.date, 'night').map((e) => e.userId));

    return [...new Set(ids)];
}

// 三個條件之間是 AND，單一條件內的多選是 OR。
// 例如「活動人員=小萬、小貝」+「類型=社群」= 小萬或小貝參與的社群活動。
function matchesFilter(ev) {
    const { people, types, keyword } = filter.value;

    if (types.length && !types.includes(ev.type)) return false;

    const kw = keyword.trim().toLowerCase();
    if (kw && !(ev.content || '').toLowerCase().includes(kw)) return false;

    if (people.length) {
        const ids = eventPeopleIds(ev);
        if (!people.some((id) => ids.includes(id))) return false;
    }

    return true;
}

// 月曆格子與日期下方的列表都吃這份，兩邊數量才會一致
const visibleEvents = computed(() => events.value.filter(matchesFilter));

// 有沒有條件生效，給 icon 旁邊的「篩選中」用。
// 沒有這個提示的話，篩選開著但看不出來，使用者會以為活動憑空消失
const hasActiveFilter = computed(() => {
    const { people, types, keyword } = filter.value;
    return people.length > 0 || types.length > 0 || keyword.trim() !== '';
});

const eventsByDate = computed(() => {
    const map = {};
    for (const ev of visibleEvents.value) {
        (map[ev.date] ||= []).push(ev);
    }
    for (const date in map) {
        map[date].sort((a, b) => a.timeStart.localeCompare(b.timeStart));
    }
    return map;
});

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const dayEvents = computed(() => eventsByDate.value[selectedDate.value] || []);

const dayPanelLabel = computed(() => {
    if (!selectedDate.value) return '';
    const d = $dayjs(selectedDate.value);
    return `${d.format('M/D')}（週${WEEKDAY_LABELS[d.day()]}）`;
});

// 列表檢視：cursor 那個月的活動，依日期分組。
// 吃的是 eventsByDate（來自 visibleEvents），所以篩選條件一樣生效，
// 兩種檢視看到的筆數才會一致。
const monthGroups = computed(() => {
    const month = $dayjs(cursor.value).format('YYYY-MM');

    return Object.keys(eventsByDate.value)
        .filter((date) => date.startsWith(month))
        .sort()
        .map((date) => {
            const d = $dayjs(date);
            return {
                date,
                day: d.format('D'),
                weekday: `週${WEEKDAY_LABELS[d.day()]}`,
                isToday: date === today,
                events: eventsByDate.value[date],
            };
        });
});

const rosterMorning = computed(() => roster(formData.value.date, 'morning'));
const rosterNight = computed(() => roster(formData.value.date, 'night'));

/* ============================================================
 * 值班名單：從 votes 即時算出來，不存進 calendar_events
 * 存一份會跟 /vote 的投票結果不同步
 * ========================================================== */

// votes 只存 user_id，暱稱要另外對（與 /vote 的 getNickname 相同）
const userMap = computed(() => {
    const map = new Map();
    for (const user of allUsers.value) {
        map.set(user.id, user.nickname || user.email || '未命名');
    }
    return map;
});

function getNickname(userId) {
    return userMap.value.get(userId) || '未命名';
}

// 該班別可用的選項；shift 缺值視同 'both'，與 /vote 的處理一致
function shiftOptions(shift) {
    return voteOptions.value.filter(
        (opt) => !opt.shift || opt.shift === 'both' || opt.shift === shift
    );
}

// 某天某班別的值班名單，回傳 [{ option: '值班', name: '小貝' }, ...]
// 拆成兩層是因為兩種用途要的格式不同：
//   早班人員的 chip 要「值班 - 小貝」，活動列表右側只要「小貝」
function rosterEntries(date, shift) {
    if (!date) return [];

    const result = [];

    // 依 sort_order 逐個選項掃，名單順序才會跟 /vote 一致
    for (const option of shiftOptions(shift)) {
        for (const vote of votes.value) {
            // 勾了「本週Pass」的人等於整週請假，data 裡的舊勾選不算數
            if (vote.is_pass) continue;
            // 直接用 data 的日期 key，不比對 week_start（原因見 loadVotes）
            if (!vote.data?.[date]?.[shift]?.[option.id]?.checked) continue;

            result.push({
                option: option.name,
                name: getNickname(vote.user_id),
                userId: vote.user_id,
            });
        }
    }

    return result;
}

// 格式為「選項名稱 - 暱稱」，給早班／晚班人員的 chip 用
function roster(date, shift) {
    return rosterEntries(date, shift).map((e) => `${e.option} - ${e.name}`);
}

/* ============================================================
 * 資料載入
 * ========================================================== */

// 月曆實際顯示的範圍：格子會補滿前後月份，所以要含頭尾那幾天
function displayRange() {
    const base = $dayjs(cursor.value);
    return {
        start: base.startOf('month').startOf('week').format('YYYY-MM-DD'),
        end: base.endOf('month').endOf('week').format('YYYY-MM-DD'),
    };
}

async function loadEvents() {
    const { start, end } = displayRange();

    try {
        events.value = await $fetch('/api/calendar/list', {
            query: { start, end },
        });
    } catch (error) {
        console.error('載入行事曆失敗:', error);
        ElMessage.error('載入行事曆失敗');
    }
}

// votes 以 week_start 分列，但真正的日期在 data 的 key 上。
//
// ⚠️ 不要用 .in('week_start', [一串週一]) 來查。
// 資料庫裡現存的 week_start 有不少是「星期二」（例如 2025-12-02 那筆，
// 它的 data key 其實是 2025-12-01 星期一），精準比對會整批漏掉。
// 所以這裡用區間查、前後各多抓一週當緩衝，
// 再由 roster() 直接用 data 的日期 key 對，不管 week_start 準不準。
async function loadVotes() {
    const { start, end } = displayRange();

    const { data, error } = await supabase
        .from('votes')
        .select('user_id, week_start, is_pass, data')
        .gte('week_start', $dayjs(start).subtract(7, 'day').format('YYYY-MM-DD'))
        .lte('week_start', $dayjs(end).add(7, 'day').format('YYYY-MM-DD'));

    if (error) {
        console.error('載入投票失敗:', error);
        return;
    }

    votes.value = data || [];
}

// 所有使用者（含已停用的），只用來把 votes.user_id 轉成暱稱。
// 跟 volunteerList 不同：那個是負責人下拉選單，只收有效志工。
async function loadUsers() {
    try {
        allUsers.value = await $fetch('/api/users/list');
    } catch (error) {
        console.error('載入使用者失敗:', error);
    }
}

async function loadVoteOptions() {
    const { data, error } = await supabase
        .from('vote_options')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    if (error) {
        console.error('載入投票選項失敗:', error);
        return;
    }

    voteOptions.value = data || [];
}

// 負責人用的志工名單，value 是 user id
async function loadVolunteers() {
    try {
        const list = await $fetch('/api/volunteer/list');
        volunteerList.value = list.map((item) => ({
            label: item.name,
            value: item.recordId,
        }));
    } catch (error) {
        console.error('載入志工名單失敗:', error);
    }
}

// 換月份時重新查，events 與 votes 都要跟著範圍走
async function loadRange() {
    await Promise.all([loadEvents(), loadVotes()]);
}

/* ============================================================
 * Realtime：多位志工同時開著頁面時彼此看得到變更
 * ========================================================== */

// 短時間內多筆變更只重載一次
const reloadEvents = debounce(() => loadEvents(), 300);

function subscribeToRealtime() {
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }

    realtimeChannel.value = supabase
        .channel('calendar-events')
        .on(
            'postgres_changes',
            {
                // 軟刪除在 Realtime 眼中是 UPDATE 不是 DELETE，所以聽 '*'
                event: '*',
                schema: 'public',
                table: 'calendar_events',
            },
            () => {
                reloadEvents();
            }
        )
        .subscribe();
}

// Methods
function typeLabel(type) {
    return typeList.find((item) => item.value === type)?.label || type;
}

function eventLabel(ev) {
    return ev.content || typeLabel(ev.type);
}

// 有指定對象卻沒人：負責人沒填、或該日該班別沒人值班
function isUnstaffed(ev) {
    const roles = ev.notifyRoles || [];
    if (roles.includes('owner') && !ev.owners?.length) return true;
    if (roles.includes('morning') && !roster(ev.date, 'morning').length) return true;
    if (roles.includes('night') && !roster(ev.date, 'night').length) return true;
    return false;
}

// 活動列表右側最多先顯示幾個名字，其餘收在 +N 後面
const PEOPLE_PREVIEW = 2;

// 這筆活動要提示的人：負責人 + 當天早晚班值班的人，去重
// 負責人用 userMap 而不是 volunteerList —— 後者濾掉了停用的志工，
// 舊資料的負責人如果已停用會變成空白
function eventPeople(ev) {
    // 先去重 id 再轉暱稱。反過來做的話，兩個同名的人會被併成一個
    return eventPeopleIds(ev).map(getNickname);
}

function shownPeople(ev) {
    const people = eventPeople(ev);
    return expandedPeople.value[ev.recordId] ? people : people.slice(0, PEOPLE_PREVIEW);
}

function hiddenPeopleCount(ev) {
    if (expandedPeople.value[ev.recordId]) return 0;
    return Math.max(0, eventPeople(ev).length - PEOPLE_PREVIEW);
}

function togglePeople(recordId) {
    expandedPeople.value = {
        ...expandedPeople.value,
        [recordId]: !expandedPeople.value[recordId],
    };
}

function openFilter() {
    // 深拷貝，不然在 modal 裡改多選會直接動到已套用的條件
    filterDraft.value = {
        people: [...filter.value.people],
        types: [...filter.value.types],
        keyword: filter.value.keyword,
    };
    filterVisible.value = true;
}

// 只清草稿，不直接套用 —— 使用者還是要按「套用」，行為才跟其他欄位一致
function clearFilterDraft() {
    filterDraft.value = { people: [], types: [], keyword: '' };
}

function pickOnlyMine() {
    if (myId.value) filterDraft.value.people = [myId.value];
}

function applyFilter() {
    filter.value = {
        people: [...filterDraft.value.people],
        types: [...filterDraft.value.types],
        keyword: filterDraft.value.keyword,
    };
    setStorage('calendar-filter', filter.value);
    filterVisible.value = false;
}

// 列表檢視用。月曆的箭頭走 goto() → calendarRef.selectDate()，
// 但月曆是 v-if，切到列表時那個 ref 是 null，所以這裡自己算
// 列表要捲到哪一天：今天有活動就是今天，沒有就找最接近的那天。
// 只有在看當月時才有意義 —— 翻到別的月份「今天」根本不在裡面，回傳 null 捲到最上面。
function nearestGroupDate() {
    const groups = monthGroups.value;
    if (!groups.length) return null;
    if ($dayjs(cursor.value).format('YYYY-MM') !== today.slice(0, 7)) return null;

    if (groups.some((g) => g.date === today)) return today;

    // groups 已經由小到大排好，用 <= 讓距離相同時取比較晚的那天
    //（接下來要發生的事，比已經過去的重要）
    let best = null;
    let bestDiff = Infinity;

    for (const group of groups) {
        const diff = Math.abs($dayjs(group.date).diff(today, 'day'));
        if (diff <= bestDiff) {
            bestDiff = diff;
            best = group.date;
        }
    }

    return best;
}

// 不在 realtime 重載時呼叫 —— 讀到一半被捲走很煩。
// 只在切到列表、換月份、第一次載入時捲。
async function scrollListToToday() {
    if (!isListView.value) return;

    await nextTick();

    // 等 Noto Sans TC 載完再量。字體一換卡片高度就變，
    // 只等 nextTick 的話會算到舊高度，捲到錯的位置（實測會直接捲到底）
    try {
        await document.fonts?.ready;
    } catch {
        // 不支援就算了，頂多位置差一點
    }

    const body = listBodyRef.value;
    if (!body) return;

    const target = nearestGroupDate();
    if (!target) {
        body.scrollTop = 0;
        return;
    }

    const el = body.querySelector(`[data-date="${target}"]`);
    if (!el) return;

    // 用 rect 差值而不是 offsetTop —— offsetTop 要看有沒有 positioned 祖先，容易踩雷
    body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top;
}

function shiftMonth(months) {
    cursor.value = $dayjs(cursor.value).add(months, 'month').toDate();
}

function goto(type) {
    calendarRef.value?.selectDate(type);
}

// 只把月曆切回本月，不動檢視中選的日期
function goToday() {
    cursor.value = new Date();
}

// 點日期就只是「我要看這天」，不會順帶打開任何一筆活動的表單。
// 再點一次同一天取消選取。
function pickDate(day) {
    selectedDate.value = selectedDate.value === day ? '' : day;
}

// 新增：開一張空白表單，日期預填目前在看的那天
function openCreate() {
    if (!canEdit.value) return;

    errors.value = {};
    formData.value = {
        recordId: '',
        date: selectedDate.value || today,
        timeStart: '',
        timeEnd: '',
        type: '',
        notifyRoles: [],
        owners: [],
        content: '',
    };
    formVisible.value = true;
}

// 打開某一筆活動。管理員是編輯，一般志工是看詳情（欄位都 disabled）
function openEvent(ev) {
    errors.value = {};
    formData.value = {
        recordId: ev.recordId,
        date: ev.date,
        timeStart: ev.timeStart,
        timeEnd: ev.timeEnd,
        type: ev.type,
        notifyRoles: [...ev.notifyRoles],
        owners: [...(ev.owners || [])],
        content: ev.content || '',
    };
    formVisible.value = true;
}

// dialog 裡改日期：早晚班名單是依日期從 votes 算的，
// 挑到別的月份就要把 cursor 帶過去，範圍才會重查（見 watch cursor）
function onDateChange(day) {
    if (day) cursor.value = $dayjs(day).toDate();
}

// 改了開始時間之後，原本的結束時間可能已經不合法，直接清掉
function onTimeStartChange() {
    const { timeStart, timeEnd } = formData.value;
    if (timeStart && timeEnd && timeEnd <= timeStart) {
        formData.value.timeEnd = '';
    }
}

// dialog 的 @closed 會呼叫，關掉就等於取消。
// 日期不保留 —— 下次開表單一定是走 openCreate 或 openEvent，兩邊都會指定日期
function resetForm() {
    errors.value = {};
    formData.value = {
        recordId: '',
        date: '',
        timeStart: '',
        timeEnd: '',
        type: '',
        notifyRoles: [],
        owners: [],
        content: '',
    };
}

// 錯誤訊息要照畫面由上而下報，不能依賴物件的 key 順序
const FIELD_ORDER = ['date', 'time', 'type', 'notifyRoles', 'content'];

// 一次檢查全部必填，回傳 { 欄位: 訊息 }。
// 不在第一個錯誤就停，否則使用者要按五次送出才知道有五個欄位沒填。
function validate() {
    const { date, timeStart, timeEnd, type, notifyRoles, content } = formData.value;
    const found = {};

    if (!date) found.date = '請選擇日期';
    if (!timeStart || !timeEnd) found.time = '請選擇活動時間';
    if (!type) found.type = '請選擇類型';
    if (!notifyRoles.length) found.notifyRoles = '請選擇活動人員';
    if (!content?.trim()) found.content = '請輸入內容';

    return found;
}

// 欄位一有值就把紅框拿掉，不必等重新送出
watch(
    formData,
    () => {
        if (!Object.keys(errors.value).length) return;

        const next = { ...errors.value };
        const { date, timeStart, timeEnd, type, notifyRoles, content } = formData.value;

        if (date) delete next.date;
        if (timeStart && timeEnd) delete next.time;
        if (type) delete next.type;
        if (notifyRoles.length) delete next.notifyRoles;
        if (content?.trim()) delete next.content;

        errors.value = next;
    },
    { deep: true }
);

async function Submit() {
    const { recordId, date, timeStart, timeEnd, type, notifyRoles, owners, content } = formData.value;

    if (!canEdit.value) {
        return ElMessage.error('只有管理員可以新增或編輯活動');
    }

    errors.value = validate();

    const firstError = FIELD_ORDER.map((key) => errors.value[key]).find(Boolean);
    if (firstError) return ElMessage.error(firstError);

    const payload = {
        recordId,
        date,
        timeStart,
        timeEnd,
        type,
        notifyRoles: [...notifyRoles],
        owners: notifyRoles.includes('owner') ? [...owners] : [],
        content,
    };

    saving.value = true;

    try {
        await $fetch('/api/calendar/update', {
            method: 'POST',
            body: payload,
        });

        await loadEvents();
        formVisible.value = false;
        ElMessage.success('已儲存');
    } catch (error) {
        console.error('儲存失敗:', error);
        ElMessage.error(error.data?.message || '儲存失敗');
    } finally {
        saving.value = false;
    }
}

async function DeleteEvent() {
    if (!canEdit.value) {
        return ElMessage.error('只有管理員可以刪除活動');
    }

    const { isConfirmed } = await Swal.fire({
        html: '確定要刪除這筆活動嗎？',
        showCancelButton: true,
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
        confirmButtonText: '刪除',
    });

    if (!isConfirmed) return;

    saving.value = true;

    try {
        await $fetch('/api/calendar/delete', {
            method: 'POST',
            body: { recordId: formData.value.recordId },
        });

        await loadEvents();
        formVisible.value = false;
        ElMessage.success('已刪除');
    } catch (error) {
        console.error('刪除失敗:', error);
        ElMessage.error(error.data?.message || '刪除失敗');
    } finally {
        saving.value = false;
    }
}

// 記住檢視選擇，下次進來維持一樣
watch(isListView, (value) => setStorage('calendar-list-view', value));

// 換月份就依新的顯示範圍重查，資料回來後再捲到今天附近
watch(
    () => $dayjs(cursor.value).format('YYYY-MM'),
    async () => {
        await loadRange();
        scrollListToToday();
    }
);

// 切到列表檢視時也捲一次
watch(isListView, (value) => {
    if (value) scrollListToToday();
});

// Lifecycle
onMounted(async () => {
    // localStorage 可能是舊版或被手動改過，逐欄位檢查型別再用
    isListView.value = getStorage('calendar-list-view', false) === true;

    const saved = getStorage('calendar-filter', null);
    if (saved) {
        filter.value = {
            people: Array.isArray(saved.people) ? saved.people : [],
            types: Array.isArray(saved.types) ? saved.types : [],
            keyword: typeof saved.keyword === 'string' ? saved.keyword : '',
        };
    }

    loading.value = true;

    try {
        // 志工名單與投票選項只需要載一次
        await Promise.all([loadVolunteers(), loadUsers(), loadVoteOptions()]);
        await loadRange();
    } finally {
        loading.value = false;
    }

    // 一進來就是列表檢視的話（localStorage 記住的），也要捲
    scrollListToToday();

    subscribeToRealtime();
});

onBeforeUnmount(() => {
    reloadEvents.cancel();
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }
});
</script>

<style lang="scss" scoped>
@use 'sass:list';

$blue: #6da2c2;
$grey: #657181;
// 列表卡片的浮起陰影。box-shadow 不會跨規則疊加，
// 要另外加 inset 的地方（.list-item.active）必須把這個一起寫上
$card-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

#calendar {
    // 底部固定的「新增活動」會蓋住內容，留出它的高度
    padding-bottom: 80px;
}

// 月曆
// 月曆上方：篩選（左）＋ 檢視切換（右）
.cal-top {
    display: flex;
    // 兩邊高度不同（icon 29px、el-switch 20px），置中才不會一高一低
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
}

.cal-filter {
    display: flex;
    align-items: center;
    gap: 6px;

    // layouts/default.vue 的全域 button { width: 100% } 會把 icon 撐滿整列
    .filter-btn {
        width: auto;
        padding: 4px;
        border: none;
        background: none;
        color: $grey;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;

        &:hover {
            color: $blue;
        }
    }

    .filter-status {
        font-size: 12px;
        color: $blue;
    }
}

// 篩選 modal
.label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    width: 100%;

    // 「只看我的」捷徑，點了把活動人員設成只有自己
    .only-mine {
        width: auto;
        border: none;
        background: none;
        padding: 0;
        color: #c0c4cc;
        font-size: 12px;
        cursor: pointer;

        &:hover {
            color: $blue;
        }
    }
}

:deep(.el-dialog) {
    // Element Plus 會給 label 算一個固定寬度（剛好包住文字），
    // 裡面的 .label-row 就撐不滿，「只看我的」會黏在標題右邊而不是推到最右
    .el-form-item__label {
        width: 100%;
    }

    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        // 同上，footer 的按鈕也會被全域規則撐滿
        .el-button {
            width: auto !important;
        }
    }
}

// 列表檢視
.month-list {
    margin-bottom: 24px;

    // 列表自己的月份選擇器。月曆的 header 有 el-calendar 的外框，
    // 這個是獨立的，要自己補邊框與內距
    .list-nav {
        margin-bottom: 12px;
        padding: 8px 12px;
        border: 1px solid #dadada;
        border-radius: 4px;
    }

    // 資料多的時候在框內捲動，不要把表單推到看不見的地方
    .list-body {
        // max-height: 50vh;
        overflow-y: auto;
        // 留出捲軸的寬度，不然日期右邊的「N 個活動」會被切到
        padding-right: 8px;
    }

    .list-group {
        // 日期之間要拉開，不然一整個月的卡片會黏成一片
        margin-bottom: 20px;

        &:last-child {
            margin-bottom: 0;
        }
    }

    .list-date {
        display: flex;
        align-items: baseline;
        gap: 6px;
        width: 100%;
        margin-bottom: 6px;
        border: none;
        background: #fff;
        // #calendar 是置中的，日期標題要自己拉回靠左
        text-align: left;
        cursor: pointer;

        // 捲動時吸在容器頂端，一直看得到現在讀到哪一天
        position: sticky;
        top: 0;
        z-index: 1;

        // 做成圓形底色，today / picked 才有地方著色
        .d-day {
            min-width: 28px;
            padding: 0 4px;
            border-radius: 14px;
            color: #303133;
            font-size: 18px;
            font-weight: 700;
            line-height: 28px;
            text-align: center;
            // 等寬數字，日期才不會左右跳動
            font-variant-numeric: tabular-nums;
        }

        .d-week {
            color: $grey;
            font-size: 12px;
        }

        // 推到最右邊
        .d-count {
            margin-left: auto;
            color: #c0c4cc;
            font-size: 12px;
        }

        // 今天：淺紅底深紅字，跟月曆格子的 .cell.today .num 同一套
        &.today .d-day {
            background-color: #fde2e2;
            color: #b33a39;
        }

        // 表單目前編輯的就是這一天：藍底白字，同 .cell.picked .num。
        // 刻意跟 today 用不同顏色，兩個狀態同時成立時也分得出來
        &.picked {
            border-bottom-color: $blue;

            .d-day {
                background-color: $blue;
                color: #fff;
            }

            .d-week {
                color: $blue;
            }
        }
    }

    .list-item {
        display: block;
        width: 100%;
        margin-bottom: 8px;
        padding: 10px 12px;
        border: 1px solid #d0d0d0;
        // 左側色條，顏色由 .list-item.type-x 決定（見 $types 的 @each）
        border-left-width: 3px;
        border-left-color: #dcdfe6;
        border-radius: 4px;
        // 每種類型各自一個底色太花，統一用淡灰，靠陰影把卡片撐起來
        background: #fafafa;
        box-shadow: $card-shadow;
        text-align: left;
        cursor: pointer;

        // 有指定對象卻沒人。列表用人員列的紅色驚嘆號提示就夠了，
        // 一個月幾十張卡片都套虛線框會太吵（月曆格子的 .tag 才用虛線）
        &.unstaffed .li-people {
            :deep(.el-icon),
            .li-none {
                color: #f56c6c;
            }
        }

        &.active {
            box-shadow: 0 0 0 1px $blue inset, $card-shadow;
        }

        .li-head {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }

        .li-badge {
            flex-shrink: 0;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 11px;
            line-height: 16px;
        }

        .li-time {
            color: $grey;
            font-size: 13px;
            // 等寬數字，時間才不會左右跳動
            font-variant-numeric: tabular-nums;
        }

        // 列表就是拿來好好讀的，內容不截斷，讓它換行
        .li-content {
            margin-bottom: 6px;
            color: #303133;
            font-size: 14px;
            line-height: 18px;
            word-break: break-word;
        }

        .li-people {
            display: flex;
            align-items: center;
            gap: 2px;
            color: #909399;
            font-size: 12px;
            line-height: 18px;

            .li-names {
                min-width: 0;
            }

            .more {
                margin-left: 4px;
                color: #c0c4cc;
                white-space: nowrap;
                cursor: pointer;
            }
        }
    }

    .list-empty {
        padding: 32px 0;
        color: #c0c4cc;
        font-size: 13px;
        text-align: center;
    }
}

// 月曆下方的類型配色，靠右
.cal-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    margin: 10px 0;

    .legend-item {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 18px;
    }
}

.cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    .nav {
        width: auto;
        border: none;
        background: none;
        padding: 4px 8px;
        color: #c0c4cc;
        font-size: 16px;
        cursor: pointer;

        &:hover {
            color: $blue;
        }
    }

    .cal-title {
        flex: 1;
        padding: 4px 8px;
        color: $grey;
        font-size: 15px;
        font-weight: 500;
    }

    .today-btn {
        flex-shrink: 0;
        width: auto;
        margin-left: 4px;
        padding: 4px 10px;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        background: #fff;
        color: $grey;
        font-size: 12px;
        cursor: pointer;

        &:hover {
            border-color: $blue;
            color: $blue;
        }
    }
}

.cell {
    height: 100%;
    min-height: 58px;
    text-align: left;
    overflow: hidden;

    .num {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: #303133;
        line-height: 18px;
        width: 18px;
        text-align: center;
        border-radius: 50%;
    }

    &.other .num {
        color: #c0c4cc;
    }

    &.today .num {
        background-color: #fde2e2;
        color: #b33a39;
    }

    &.picked .num {
        background-color: $blue;
        color: #fff;
    }

    .tag {
        display: block;
        margin-top: 2px;
        padding: 1px 3px;
        border: 1px dashed transparent;
        border-radius: 3px;
        font-size: 11px;
        line-height: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
    }
}

// 類型配色
$types: (
    'volunteer': #409eff #ecf5ff,
    'supplies': #67c23a #f0f9eb,
    'dispatch': #e6a23c #fdf6ec,
    'post': #7c5cf0 #f1eefe,
    'other': #303133 #f4f4f5
);

@each $name, $pair in $types {
    .tag.type-#{$name},
    .day-event.type-#{$name},
    .legend-item.type-#{$name} {
        color: list.nth($pair, 1);
        background-color: list.nth($pair, 2);
    }

    // 列表卡片：白底 + 左側色條 + 類型 badge。
    // 這裡刻意多寫一層 .month-list 把特異性拉高 ——
    // 不然會跟 .month-list .list-item 的底色打平，變成誰寫在後面誰贏，
    // 樣式一重排就會默默壞掉
    .month-list .list-item.type-#{$name} {
        border-left-color: list.nth($pair, 1);

        .li-badge {
            color: list.nth($pair, 1);
            background-color: list.nth($pair, 2);
        }
    }

    :deep(.type-text-#{$name} .el-select__selected-item) {
        color: list.nth($pair, 1);
    }
}

.tag.unstaffed {
    border: #f56c6c 1px dashed;
}

// 表單
.field {
    margin-bottom: 20px;
    text-align: left;

    label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #303133;

        i {
            color: #f56c6c;
            font-style: normal;
        }
    }

    .hint {
        font-size: 13px;
        color: #c0c4cc;
    }

    // 送出時沒填的必填欄位。這頁沒用 el-form-item，
    // 所以 Element Plus 內建的 .is-error 用不上，要自己蓋 box-shadow。
    &.invalid {
        :deep(.el-input__wrapper),
        :deep(.el-select__wrapper),
        :deep(.el-textarea__inner) {
            box-shadow: 0 0 0 1px #f56c6c inset;

            // hover / focus 時不要被 Element Plus 蓋回藍色或灰色
            &:hover,
            &.is-focus,
            &.is-hovering {
                box-shadow: 0 0 0 1px #f56c6c inset;
            }
        }
    }
}

.time-row {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.el-select) {
        flex: 1;
        min-width: 0;
    }

    .time-sep {
        flex-shrink: 0;
        color: $grey;
    }
}

// 選取日期當天的活動，接在日期欄位下方
.day-events {
    margin-top: 8px;

    .day-event {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        // 時間與內容之間要留白，擠在一起不好讀
        gap: 12px;
        width: 100%;
        margin-bottom: 4px;
        padding: 4px 8px;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 13px;
        line-height: 20px;
        text-align: left;
        cursor: pointer;

        .ev-time {
            flex-shrink: 0;
            // 等寬數字，時間欄才不會左右跳動
            font-variant-numeric: tabular-nums;
        }

        // 內容吃掉剩下的寬度，太長就截斷
        .ev-content {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        // 負責人／值班人員，靠右
        .ev-people {
            flex-shrink: 0;
            max-width: 45%;
            text-align: right;
            opacity: 0.7;

            // 展開後名字整塊掉到第二行，不要把內容擠成幾個字
            &.expanded {
                flex-basis: 100%;
                max-width: 100%;
                white-space: normal;
            }

            .more {
                margin-left: 4px;
                color: #c0c4cc;
                white-space: nowrap;
                cursor: pointer;
            }
        }

        &.unstaffed {
            border-style: dashed;
            border-color: #f56c6c;
        }
    }
}

.roster {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .chip {
        padding: 4px 10px;
        border-radius: 4px;
        background-color: #f4f4f5;
        color: $grey;
        font-size: 13px;
        line-height: 20px;
    }
}

.warn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid #f5dab1;
    border-radius: 4px;
    background-color: #fdf6ec;
    color: #e6a23c;
    font-size: 13px;
}

.btn {
    display: block;
    width: 100%;
    background-color: #6da2c2;
    border-radius: 4px;

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
}

.perm-hint {
    margin: 0 0 8px;
    color: #c0c4cc;
    font-size: 13px;
    text-align: center;
}

// 新增入口。固定在畫面最下方，月曆與列表兩種檢視都在同一個位置
.add-bar {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10; // 要低於 el-dialog（~2000）
    width: 100%;
    max-width: 450px;
    padding: 10px 16px;
    border-top: 1px solid #ebeef5;
    background: #fff;

    .add-btn {
        margin: 0;
        font-size: 15px;
        line-height: 44px;
    }
}


// 選了日期之後的「當天活動」，純檢視
.day-panel {
    margin-bottom: 20px;
    padding: 12px;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    text-align: left;

    .day-panel-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 8px;

        .dp-date {
            color: #303133;
            font-size: 15px;
            font-weight: 600;
        }

        .dp-count {
            color: #c0c4cc;
            font-size: 12px;
        }
    }

    // 面板自己有標題了，卡片不用再往下推
    .day-events {
        margin-top: 0;
    }

    .day-empty {
        margin: 0;
        color: #c0c4cc;
        font-size: 13px;
    }
}

// dialog footer：垃圾桶固定 30px，取消與確認平分剩下的寬度
// dialog footer：刪除靠左，取消與送出靠右。
// 刪除跟送出隔得遠一點，不容易誤按。
// 新增活動時左邊是空的 span，space-between 一樣把右邊那組推到底
.dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    // 兩顆之間的間距交給 element-variables.css 的
    // .el-button + .el-button { margin-left: 8px }，這裡不要再加 gap
    .da-right {
        display: flex;
        align-items: center;
    }
}

// dialog 裡的表單
.dialog-form {
    text-align: left;

    .field:last-child {
        margin-bottom: 0;
    }
}

:deep(.el-calendar) {
    border-radius: 4px;
}

:deep(.el-calendar__header) {
    padding: 8px 12px;
    border: solid 1px #d0d0d0;
}

:deep(.el-calendar__body) {
    padding: 0;
}

:deep(.el-calendar-table) {
    tr {
        &:first-child {
            td {
                border-color: #d0d0d0;
            }

        }
    }

    th {
        padding: 5px 0;
        color: $grey;
        font-size: 12px;
        font-weight: 500;
        // background-color: #f3f3f3;

        &:first-child {
            border-left: 1px solid #d0d0d0;
        }

        &:last-child {
            border-right: 1px solid #d0d0d0;
        }
    }

    td {
        border-color: #d0d0d0;
        &:first-child, &:last-child {
                border-color: #d0d0d0;
            }
        // 選取狀態改由 .cell.picked 控制，才會跟表單的日期一致
        &.is-selected {
            background-color: transparent;
            
        }
    }

    .el-calendar-day {
        height: auto;
        min-height: 58px;
        padding: 4px;
        background-color: transparent !important;
    }
}

:deep(.el-input),
:deep(.el-select),
:deep(.el-date-editor) {
    width: 100%;
    max-width: 100%;
    height: auto;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
    min-height: 45px;
}

// layouts/default.vue 的全域 button { width: 100% } 會把標籤文字擠成 0 寬度
:deep(.el-tag__close) {
    width: auto;
}

:deep(.el-textarea__inner) {
    height: auto;
}
:deep(.el-date-editor .el-range__icon) {
    width: 28px;
}
:deep(.el-date-editor .el-range-input) {
    text-align: left;
}
</style>
