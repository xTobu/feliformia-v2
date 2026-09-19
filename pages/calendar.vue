<template>
    <ClientOnly>
        <div v-loading="loading" id="calendar">
            <h1>Hi, {{ displayName }}！這裡是行事曆與備註區</h1>

            <!-- 月曆 -->
            <el-calendar ref="calendarRef" v-model="cursor">
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
                            picked: data.day === formData.date,
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

            <form @submit.prevent="Submit">
                <!-- 日期 -->
                <div class="field">
                    <label>日期 <i>*</i></label>
                    <el-date-picker
                        v-model="formData.date"
                        type="date"
                        value-format="YYYY-MM-DD"
                        placeholder="請選擇上方日期"
                        :clearable="false"
                        @change="onDateChange"
                    />
                    <div class="day-events" v-if="formData.date && dayEvents.length">
                        <button
                            type="button"
                            v-for="ev in dayEvents"
                            :key="ev.recordId"
                            class="day-event"
                            :class="[
                                `type-${ev.type}`,
                                {
                                    active: ev.recordId === formData.recordId,
                                    unstaffed: isUnstaffed(ev),
                                },
                            ]"
                            @click="editEvent(ev)"
                        >
                            {{ ev.timeStart }}-{{ ev.timeEnd }} {{ eventLabel(ev) }}
                        </button>
                    </div>
                </div>

                <!-- 活動時間 -->
                <div class="field">
                    <label>活動時間 <i>*</i></label>
                    <div class="time-row">
                        <el-time-select
                            v-model="formData.timeStart"
                            start="00:00"
                            end="23:45"
                            step="00:15"
                            placeholder="開始時間"
                        />
                        <span class="time-sep">→</span>
                        <el-time-select
                            v-model="formData.timeEnd"
                            start="00:00"
                            end="23:45"
                            step="00:15"
                            placeholder="結束時間"
                        />
                    </div>
                </div>

                <!-- 類型 -->
                <div class="field">
                    <label>類型 <i>*</i></label>
                    <el-select
                        v-model="formData.type"
                        placeholder="請選擇"
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
                <div class="field">
                    <label>提示該活動之人員 <i>*</i></label>
                    <el-select
                        v-model="formData.notifyRoles"
                        multiple
                        placeholder="請選擇"
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
                        v-model="formData.owner"
                        filterable
                        clearable
                        placeholder="請選擇"
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
                <div class="field">
                    <label>內容 <i>*</i></label>
                    <el-input
                        type="textarea"
                        v-model="formData.content"
                        placeholder="請輸入備註內容"
                    />
                </div>

                <button type="submit" class="btn" :disabled="saving">
                    {{ saving ? '儲存中...' : formData.recordId ? '確認更新' : '確認送出' }}
                </button>

                <div class="edit-actions" v-if="formData.recordId">
                    <button type="button" class="link-btn" @click="resetForm">
                        取消編輯
                    </button>
                    <button type="button" class="link-btn danger" @click="DeleteEvent">
                        刪除這筆
                    </button>
                </div>
            </form>

            <FloatButton />
        </div>

        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
import Swal from 'sweetalert2';
import { WarningFilled } from '@element-plus/icons-vue';
import FloatButton from '~/components/FloatButton.vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '行事曆與備註區',
});

const { $dayjs } = useNuxtApp();
const { displayName } = useProfile();

const typeList = [
    { value: 'volunteer', label: '志工體驗', color: '#409eff' },
    { value: 'supplies', label: '物資贈送', color: '#67c23a' },
    { value: 'dispatch', label: '出車', color: '#e6a23c' },
    { value: 'post', label: '發文', color: '#7c5cf0' },
    { value: 'other', label: '其他', color: '#303133' },
];

const roleList = [
    { value: 'morning', label: '早班' },
    { value: 'night', label: '晚班' },
    { value: 'owner', label: '負責人' },
];

/* ============================================================
 * Mock data（純切版用，不接任何 API）
 * 之後接後端時，把這一整塊換成 API 呼叫即可：
 *   events        <- GET  活動列表
 *   roster()      <- 依日期從 votes 算出的當班名單
 *   volunteerList <- GET  志工名單
 *   Submit / DeleteEvent 內的陣列操作 <- POST
 * ========================================================== */

// 每月固定這幾筆，方便檢視版面
// 出車／發文多半會指定負責人；物資贈送／志工體驗通常只掛早晚班，
// 而排班要等日期接近才會催投票，所以常常是還沒有人的狀態（月曆上會是紅色虛線）
const MOCK_EVENTS = [
    // 志工體驗／物資贈送：只掛早晚班
    { day: 1, timeStart: '14:00', timeEnd: '16:00', type: 'volunteer', notifyRoles: ['morning'], owner: '', content: 'Apple 志工體驗' },
    { day: 3, timeStart: '18:00', timeEnd: '20:00', type: 'volunteer', notifyRoles: ['night'], owner: '', content: '虎嚕媽打掃體驗' },
    { day: 3, timeStart: '20:30', timeEnd: '21:00', type: 'supplies', notifyRoles: ['night'], owner: '', content: '阿璇捐籠子' },
    { day: 5, timeStart: '10:00', timeEnd: '12:00', type: 'volunteer', notifyRoles: ['morning'], owner: '', content: '佽二次體驗' },
    { day: 7, timeStart: '13:00', timeEnd: '15:00', type: 'supplies', notifyRoles: ['morning', 'night'], owner: '', content: '多筆物資寄放' },
    { day: 9, timeStart: '19:00', timeEnd: '21:00', type: 'volunteer', notifyRoles: ['night'], owner: '', content: '佳潔-二次體驗' },
    { day: 10, timeStart: '11:00', timeEnd: '12:00', type: 'supplies', notifyRoles: ['morning'], owner: '', content: '小姨捐物資' },
    { day: 11, timeStart: '15:00', timeEnd: '17:00', type: 'volunteer', notifyRoles: ['morning'], owner: '', content: 'Katie 體驗' },
    // 出車／發文：指定負責人
    { day: 15, timeStart: '09:00', timeEnd: '11:00', type: 'dispatch', notifyRoles: ['owner'], owner: '小萬', content: '雪兒＼老屋出車' },
    { day: 18, timeStart: '19:00', timeEnd: '20:00', type: 'dispatch', notifyRoles: ['night', 'owner'], owner: '小貝', content: '貓咪去新家(借籠子組)' },
    { day: 22, timeStart: '20:00', timeEnd: '21:00', type: 'post', notifyRoles: ['owner'], owner: '', content: '送養文待發' },
    { day: 25, timeStart: '19:00', timeEnd: '20:00', type: 'dispatch', notifyRoles: ['owner'], owner: 'Summer', content: 'TNR' },
    { day: 28, timeStart: '20:00', timeEnd: '21:00', type: 'post', notifyRoles: ['owner'], owner: '思芸', content: '認養回報發文' },
    { day: 30, timeStart: '13:00', timeEnd: '14:00', type: 'other', notifyRoles: ['morning', 'owner'], owner: '小萬', content: '結紮預約' },
];

// 有人投票的日子，其餘日子當作還沒人排班
const MOCK_MORNING_DAYS = [3, 5, 10, 15, 22];
const MOCK_NIGHT_DAYS = [3, 9, 18, 25];

const MOCK_ROSTER_MORNING = ['值班 - 小貝', '快閃/協助 - Summer'];
const MOCK_ROSTER_NIGHT = ['值班 - 阿璇'];

const volunteerList = ref(
    ['小萬', '小貝', 'Summer', '阿璇', '思芸', 'Katie'].map((name) => ({
        label: name,
        value: name,
    }))
);

function buildMockEvents(monthDate) {
    const base = $dayjs(monthDate).startOf('month');
    const daysInMonth = base.daysInMonth();

    return MOCK_EVENTS.filter((item) => item.day <= daysInMonth).map((item) => ({
        ...item,
        recordId: `mock-${base.format('YYYYMM')}-${item.day}-${item.timeStart}`,
        date: base.date(item.day).format('YYYY-MM-DD'),
    }));
}

// 某天某班別的值班名單，格式為「選項名稱 - 暱稱」
function roster(date, shift) {
    if (!date) return [];

    const day = Number(date.slice(-2));

    if (shift === 'morning') {
        return MOCK_MORNING_DAYS.includes(day) ? MOCK_ROSTER_MORNING : [];
    }
    return MOCK_NIGHT_DAYS.includes(day) ? MOCK_ROSTER_NIGHT : [];
}

/* ========================= Mock data 結束 ====================== */

// State
const loading = ref(true);
const saving = ref(false);
const calendarRef = ref(null);
const cursor = ref(new Date());
const today = $dayjs().format('YYYY-MM-DD');

const events = ref([]);

const formData = ref({
    recordId: '',
    date: '',
    timeStart: '',
    timeEnd: '',
    type: '',
    notifyRoles: [],
    owner: '',
    content: '',
});

// Computed
const eventsByDate = computed(() => {
    const map = {};
    for (const ev of events.value) {
        (map[ev.date] ||= []).push(ev);
    }
    for (const date in map) {
        map[date].sort((a, b) => a.timeStart.localeCompare(b.timeStart));
    }
    return map;
});

const dayEvents = computed(() => eventsByDate.value[formData.value.date] || []);

const rosterMorning = computed(() => roster(formData.value.date, 'morning'));
const rosterNight = computed(() => roster(formData.value.date, 'night'));

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
    if (roles.includes('owner') && !ev.owner) return true;
    if (roles.includes('morning') && !roster(ev.date, 'morning').length) return true;
    if (roles.includes('night') && !roster(ev.date, 'night').length) return true;
    return false;
}

function goto(type) {
    calendarRef.value?.selectDate(type);
}

// 只把月曆切回本月，不動表單已選的日期
function goToday() {
    cursor.value = new Date();
}

function pickDate(day) {
    formData.value.date = day;
    formData.value.recordId = '';
}

function onDateChange(day) {
    if (day) {
        cursor.value = $dayjs(day).toDate();
        formData.value.recordId = '';
    }
}

function editEvent(ev) {
    formData.value = {
        recordId: ev.recordId,
        date: ev.date,
        timeStart: ev.timeStart,
        timeEnd: ev.timeEnd,
        type: ev.type,
        notifyRoles: [...ev.notifyRoles],
        owner: ev.owner || '',
        content: ev.content || '',
    };
}

function resetForm() {
    const { date } = formData.value;
    formData.value = {
        recordId: '',
        date,
        timeStart: '',
        timeEnd: '',
        type: '',
        notifyRoles: [],
        owner: '',
        content: '',
    };
}

function Submit() {
    const { recordId, date, timeStart, timeEnd, type, notifyRoles, owner, content } = formData.value;

    if (!date) return ElMessage.error('請選擇日期');
    if (!timeStart || !timeEnd) return ElMessage.error('請選擇活動時間');
    if (!type) return ElMessage.error('請選擇類型');
    if (!notifyRoles.length) return ElMessage.error('請選擇提示該活動之人員');
    if (!content?.trim()) return ElMessage.error('請輸入內容');

    const payload = {
        date,
        timeStart,
        timeEnd,
        type,
        notifyRoles: [...notifyRoles],
        owner: notifyRoles.includes('owner') ? owner : '',
        content,
    };

    saving.value = true;

    if (recordId) {
        const index = events.value.findIndex((ev) => ev.recordId === recordId);
        if (index > -1) {
            events.value[index] = { ...events.value[index], ...payload };
        }
    } else {
        events.value.push({ recordId: `mock-new-${Date.now()}`, ...payload });
    }

    saving.value = false;
    resetForm();
    ElMessage.success('已儲存（mock，重新整理就會還原）');
}

async function DeleteEvent() {
    const { isConfirmed } = await Swal.fire({
        html: '確定要刪除這筆行事曆備註嗎？',
        showCancelButton: true,
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
        confirmButtonText: '刪除',
    });

    if (!isConfirmed) return;

    events.value = events.value.filter(
        (ev) => ev.recordId !== formData.value.recordId
    );
    resetForm();
    ElMessage.success('已刪除（mock）');
}

// Lifecycle
onMounted(() => {
    // 產生前後各兩個月的 mock 活動，切換月份時都看得到內容
    const list = [];
    for (let offset = -2; offset <= 2; offset++) {
        list.push(...buildMockEvents($dayjs().add(offset, 'month')));
    }
    events.value = list;
    loading.value = false;
});
</script>

<style lang="scss" scoped>
@use 'sass:list';

$blue: #6da2c2;
$grey: #657181;

#calendar {
    padding-bottom: 30px;

    h1 {
        text-align: left;
    }
}

// 月曆
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
    .day-event.type-#{$name} {
        color: list.nth($pair, 1);
        background-color: list.nth($pair, 2);
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

.day-events {
    margin-top: 8px;

    .day-event {
        display: block;
        width: 100%;
        margin-bottom: 4px;
        padding: 4px 8px;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 13px;
        line-height: 20px;
        text-align: left;
        cursor: pointer;

        &.unstaffed {
            border-style: dashed;
            border-color: #f56c6c;
        }

        &.active {
            box-shadow: inset 0 0 0 1px currentColor;
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
    background-color: #409eff;
    border-radius: 4px;

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
}

.edit-actions {
    display: flex;
    justify-content: center;
    gap: 20px;

    .link-btn {
        width: auto;
        border: none;
        background: none;
        color: $grey;
        font-size: 13px;
        text-decoration: underline;
        cursor: pointer;

        &.danger {
            color: #b33a39;
        }
    }
}

:deep(.el-calendar) {
    margin-bottom: 24px;
    border: 1px solid #ebeef5;
    border-radius: 4px;
}

:deep(.el-calendar__header) {
    padding: 8px 12px;
}

:deep(.el-calendar__body) {
    padding: 0 0 12px;
}

:deep(.el-calendar-table) {
    th {
        padding: 10px 0;
        color: $grey;
        font-size: 12px;
        font-weight: 500;
    }

    td {
        border-color: #ebeef5;

        // 選取狀態改由 .cell.picked 控制，才會跟表單的日期一致
        &.is-selected {
            background-color: transparent;
        }
    }

    .el-calendar-day {
        height: auto;
        min-height: 58px;
        padding: 4px;

        &:hover {
            background-color: #f5f7fa;
        }
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
