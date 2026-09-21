<template>
    <ClientOnly>
        <div v-loading="loading" id="calendar">
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
                <div class="field" :class="{ invalid: errors.date }">
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
                <div class="field" :class="{ invalid: errors.time }">
                    <label>活動時間 <i>*</i></label>
                    <div class="time-row">
                        <el-time-select
                            v-model="formData.timeStart"
                            start="06:00"
                            end="23:45"
                            step="00:15"
                            placeholder="開始時間"
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
                        />
                    </div>
                </div>

                <!-- 類型 -->
                <div class="field" :class="{ invalid: errors.type }">
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
                <div class="field" :class="{ invalid: errors.notifyRoles }">
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
                <div class="field" :class="{ invalid: errors.content }">
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
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash-es';
import { WarningFilled } from '@element-plus/icons-vue';
import FloatButton from '~/components/FloatButton.vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '行事曆與備註區',
});

const supabase = useSupabaseClient();
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

// State
const loading = ref(true);
const saving = ref(false);
const calendarRef = ref(null);
const cursor = ref(new Date());
const today = $dayjs().format('YYYY-MM-DD');

const events = ref([]);
const volunteerList = ref([]);
const voteOptions = ref([]);
const allUsers = ref([]); // 解 votes.user_id → 暱稱用
const votes = ref([]); // 目前顯示範圍所涵蓋的週投票資料
const realtimeChannel = ref(null);
const errors = ref({}); // 哪些必填欄位沒填，key 見 FIELD_ORDER

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

// 某天某班別的值班名單，格式為「選項名稱 - 暱稱」
function roster(date, shift) {
    if (!date) return [];

    const result = [];

    // 依 sort_order 逐個選項掃，名單順序才會跟 /vote 一致
    for (const option of shiftOptions(shift)) {
        for (const vote of votes.value) {
            // 勾了「本週Pass」的人等於整週請假，data 裡的舊勾選不算數
            if (vote.is_pass) continue;
            // 直接用 data 的日期 key，不比對 week_start（原因見 loadVotes）
            if (!vote.data?.[date]?.[shift]?.[option.id]?.checked) continue;

            result.push(`${option.name} - ${getNickname(vote.user_id)}`);
        }
    }

    return result;
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

// 改了開始時間之後，原本的結束時間可能已經不合法，直接清掉
function onTimeStartChange() {
    const { timeStart, timeEnd } = formData.value;
    if (timeStart && timeEnd && timeEnd <= timeStart) {
        formData.value.timeEnd = '';
    }
}

function editEvent(ev) {
    errors.value = {};
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
    errors.value = {};
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
    if (!notifyRoles.length) found.notifyRoles = '請選擇提示該活動之人員';
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
    const { recordId, date, timeStart, timeEnd, type, notifyRoles, owner, content } = formData.value;

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
        owner: notifyRoles.includes('owner') ? owner : '',
        content,
    };

    saving.value = true;

    try {
        await $fetch('/api/calendar/update', {
            method: 'POST',
            body: payload,
        });

        await loadEvents();
        resetForm();
        ElMessage.success('已儲存');
    } catch (error) {
        console.error('儲存失敗:', error);
        ElMessage.error(error.data?.message || '儲存失敗');
    } finally {
        saving.value = false;
    }
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

    saving.value = true;

    try {
        await $fetch('/api/calendar/delete', {
            method: 'POST',
            body: { recordId: formData.value.recordId },
        });

        await loadEvents();
        resetForm();
        ElMessage.success('已刪除');
    } catch (error) {
        console.error('刪除失敗:', error);
        ElMessage.error(error.data?.message || '刪除失敗');
    } finally {
        saving.value = false;
    }
}

// 換月份就依新的顯示範圍重查
watch(
    () => $dayjs(cursor.value).format('YYYY-MM'),
    () => loadRange()
);

// Lifecycle
onMounted(async () => {
    loading.value = true;

    try {
        // 志工名單與投票選項只需要載一次
        await Promise.all([loadVolunteers(), loadUsers(), loadVoteOptions()]);
        await loadRange();
    } finally {
        loading.value = false;
    }

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
