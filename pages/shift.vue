<template>
    <ClientOnly>
        <div v-loading="loading" id="shift">
            <h1>值班記錄表</h1>
            <form @submit.prevent="Submit">
                <div class="d_flex">
                    <div class="W50">
                        <el-date-picker
                            v-model="formData.date"
                            :disabled-date="disabledDate"
                            type="date"
                            :clearable="false"
                            @change="dateHandler"
                            placeholder="請選擇日期"
                        />
                    </div>
                    <div class="W50 arrow">
                        <el-select
                            v-model="formData.shift"
                            placeholder="請選擇班別"
                            @change="dateHandler"
                        >
                            <el-option
                                v-for="item in shiftList"
                                :key="item.value"
                                :label="item.label"
                                :value="item.value"
                                :disabled="disableShift(item.value)"
                            />
                        </el-select>
                    </div>
                </div>

                <!-- 分頁：依值班的時間順序 -->
                <div class="tabs" role="tablist">
                    <button
                        v-for="t in tabList"
                        :key="t.value"
                        type="button"
                        role="tab"
                        :aria-selected="tab === t.value"
                        :class="{ active: tab === t.value }"
                        @click="setTab(t.value)"
                    >
                        {{ t.label }}
                        <span v-if="t.remaining" class="remaining">{{
                            t.remaining
                        }}</span>
                    </button>
                </div>

                <!-- ========== 觀察：上一班放的飯吃了多少、排泄 ========== -->
                <div v-show="tab === 'arrive'" class="W100">
                    <div v-if="prev.note" class="W100 ps f_grey prev-note">
                        <b>*前班備註：</b>
                        <span style="white-space: pre-line">{{ prev.note }}</span>
                    </div>

                    <div
                        v-for="cat in formData.cats"
                        :key="cat.cat_id"
                        class="d_flex record_item intake-card"
                    >
                        <div class="name">{{ cat.name }}</div>
                        <el-tag
                            v-if="prev.released.includes(cat.cat_id)"
                            class="released-badge"
                            type="warning"
                            size="small"
                            >上一班放風</el-tag
                        >
                        <div class="detail intake">
                            <!-- 食物 - 乾 -->
                            <div class="feed food d_flex">
                                <p class="f_blue">食物</p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.intake.feed"
                                        :disabled="isDisabled"
                                        @change="
                                            foodHandler(cat, 'feed');
                                            onAutoSave();
                                        "
                                        >乾</el-checkbox
                                    >
                                    <el-slider
                                        v-model="cat.intake.feed_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.intake.feed"
                                        @change="onAutoSave"
                                    />
                                </div>
                            </div>

                            <!-- 食物 - 罐 -->
                            <div class="can food d_flex">
                                <p class="f_blue"></p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.intake.can"
                                        :disabled="isDisabled"
                                        @change="
                                            foodHandler(cat, 'can');
                                            onAutoSave();
                                        "
                                        >罐</el-checkbox
                                    >
                                    <el-slider
                                        v-model="cat.intake.can_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.intake.can"
                                        @change="onAutoSave"
                                    />
                                </div>
                            </div>

                            <!-- 排泄 -->
                            <div class="excretion d_flex">
                                <p class="f_blue">排泄</p>
                                <div class="d_flex">
                                    <div class="W40 d_flex">
                                        <el-checkbox
                                            v-model="cat.intake.urine"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >尿</el-checkbox
                                        >
                                        <el-checkbox
                                            v-model="cat.intake.feces"
                                            :disabled="isDisabled"
                                            @change="
                                                fecesHandler(cat);
                                                onAutoSave();
                                            "
                                            >便</el-checkbox
                                        >
                                    </div>
                                    <div class="W60 d_flex">
                                        <el-radio-group
                                            v-model="cat.intake.feces_warning"
                                            :disabled="isDisabled || !cat.intake.feces"
                                            @change="onAutoSave"
                                        >
                                            <el-radio value="正常">正常</el-radio>
                                            <el-radio value="軟便">軟便</el-radio>
                                            <el-radio value="拉稀">拉稀</el-radio>
                                        </el-radio-group>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 醫療：醫療事項（只列有事項的貓） ========== -->
                <div v-show="tab === 'care'" class="W100">
                    <div
                        v-for="cat in careCats"
                        :key="cat.cat_id"
                        class="d_flex record_item"
                    >
                        <div class="name">{{ cat.name }}</div>
                        <div class="detail">
                            <div
                                v-for="(item, index) in cat.medical"
                                :key="item.notice_id"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">事項</p>
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{ item.treatment }}</font>
                                        <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                        <font v-if="item.end_date" class="f_grey"
                                            >療程至 {{ $dayjs(item.end_date).format('MM/DD') }}</font
                                        >
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="item.done"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 不屬於單一貓咪的項目（小房間、費洛蒙…） -->
                    <div
                        v-for="group in careTaskGroups"
                        :key="group.name"
                        class="d_flex record_item task-card"
                    >
                        <div class="name">{{ group.name }}</div>
                        <div class="detail">
                            <div
                                v-for="(item, index) in group.items"
                                :key="item.notice_id"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">事項</p>
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{ item.treatment || group.name }}</font>
                                        <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="item.done"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <el-empty
                        v-if="careCats.length === 0 && careTaskGroups.length === 0"
                        description="這一班沒有醫療事項"
                    />
                </div>

                <!-- ========== 放飯：乾乾、罐罐、補充、其他、放風 ========== -->
                <div v-show="tab === 'leave'" class="W100">
                    <!-- 全員的隨餐放最上面，不在每隻貓重複 -->
                    <div
                        v-for="group in leaveTaskGroups"
                        :key="group.name"
                        class="d_flex record_item task-card"
                    >
                        <div class="name">{{ group.name }}</div>
                        <div class="detail">
                            <div
                                v-for="(item, index) in group.items"
                                :key="item.notice_id"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">{{ categoryLabel(item.category, '隨餐') }}</p>
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{ item.treatment }}</font>
                                        <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="item.done"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        v-for="cat in formData.cats"
                        :key="cat.cat_id"
                        class="d_flex record_item"
                    >
                        <div class="name">{{ cat.name }}</div>
                        <div class="detail">
                            <!-- 乾乾、罐罐：照做就好，不用打勾 -->
                            <div
                                v-for="(meal, index) in cat.meals"
                                :key="meal.notice_id || `diet-${index}`"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">{{ categoryLabel(meal.category, '主食') }}</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <font class="treatment">{{ meal.treatment }}</font>
                                        <font v-if="meal.reason" class="f_grey">{{ meal.reason }}</font>
                                    </div>
                                </div>
                            </div>
                            <div
                                v-if="cat.meals.length === 0"
                                class="d_flex item-row"
                            >
                                <p class="f_blue">飲食</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <font class="f_grey">尚未設定飲食</font>
                                    </div>
                                </div>
                            </div>

                            <!-- 補充、其他：加進飯裡，要打勾 -->
                            <div
                                v-for="item in cat.with_meal"
                                :key="item.notice_id"
                                class="d_flex item-row divided"
                            >
                                <p class="f_blue">{{ categoryLabel(item.category, '隨餐') }}</p>
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{ item.treatment }}</font>
                                        <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                        <font v-if="item.end_date" class="f_grey"
                                            >療程至 {{ $dayjs(item.end_date).format('MM/DD') }}</font
                                        >
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="item.done"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>

                            <!-- 放風：離開時沒有關籠。下一班在觀察分頁會看到 -->
                            <div class="d_flex item-row divided">
                                <p class="f_blue">放風</p>
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="f_grey">離開時沒有關籠</font>
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="cat.released"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >放風</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 每個分頁共用 ========== -->
                <div class="W100 mb20 report">
                    <el-input
                        type="textarea"
                        v-model="formData.note"
                        :disabled="isDisabled"
                        placeholder="值班回報（下一班會在觀察分頁看到）"
                        @input="onAutoSave"
                    />
                </div>

                <div class="W100 mb20">
                    <div class="member-row">
                        <el-select
                            v-model="formData.member"
                            filterable
                            :disabled="isDisabled"
                            placeholder="請選擇填表志工"
                            class="member-select"
                            @change="onAutoSave"
                        >
                            <el-option
                                v-for="member in memberList"
                                :key="member.value"
                                :label="member.label"
                                :value="member.value"
                            />
                        </el-select>
                        <el-button
                            :disabled="isDisabled || !nickname"
                            @click="selectMe"
                        >
                            選自己
                        </el-button>
                    </div>
                </div>

                <div class="W100">
                    <div class="d_flex space-between">
                        <p class="last-update">
                            即時更新：{{
                                lastUpdatedAt
                                    ? $dayjs(lastUpdatedAt).format('HH:mm:ss')
                                    : ''
                            }}
                        </p>
                        <p class="last-saved">
                            成功儲存：{{
                                lastSavedAt
                                    ? $dayjs(lastSavedAt).format('HH:mm:ss')
                                    : '尚無變更'
                            }}
                        </p>
                    </div>

                    <button type="submit" class="btn" v-show="!isDisabled">
                        <template v-if="saveStatus === 'saving'">儲存中...</template>
                        <template v-else-if="saveStatus === 'error'"
                            >儲存失敗，請手動重試</template
                        >
                        <template v-else>儲存表單</template>
                    </button>

                    <NuxtLink class="f_red" :to="prevLink">看前班紀錄</NuxtLink>
                    <NuxtLink class="f_red" to="/shift">回到現在這一班</NuxtLink>
                </div>
            </form>
        </div>

        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
// 值班記錄表：一個班一筆 shifts，合併觀察（吃喝排泄）、醫療、放飯（放什麼、放風）。
// 分頁的 value 沿用 arrive / care / leave，網址參數不變，舊連結還能用
// /regular、/medicine 維持原樣，兩邊資料不互通
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash-es';
import Swal from 'sweetalert2';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '值班記錄表',
});

const { $dayjs } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const supabase = useSupabaseClient();
const { nickname, getUserId } = useProfile();

// State
const loading = ref(true);
const saveStatus = ref('success');
const lastUpdatedAt = ref(null);
const lastSavedAt = ref(null);
const realtimeChannel = ref(null);
const isPending = ref(false); // 追蹤是否有待儲存的變更
const tab = ref('arrive');
const prev = ref({ note: null, released: [] });

const shiftList = [
    { value: 'morning', label: '早班' },
    { value: 'night', label: '晚班' },
];

const marks = {
    0: '沒吃',
    25: '吃1/3',
    50: '吃1/2',
    75: '吃2/3',
    100: '吃光',
};

const memberList = ref([]);

const formData = ref({
    recordId: '',
    date: new Date(),
    shift: '',
    cats: [],
    tasks: [],
    note: '',
    member: '',
});

// Computed
const careCats = computed(() =>
    formData.value.cats.filter((cat) => cat.medical.length > 0)
);

// 飲食管理的類別。快照是建立當下的資料，舊的班可能還是 meal / with_meal，
// 或根本沒有 category，所以都要有預設文字
const CATEGORY_LABELS = {
    dry: '乾乾',
    wet: '罐罐',
    supplement: '補充',
    diet_other: '其他',
    meal_med: '醫藥', // 舊的班才有，新的藥都歸醫療
};
const ADDON_CATEGORIES = ['supplement', 'diet_other', 'meal_med', 'with_meal'];

function categoryLabel(category, fallback) {
    return CATEGORY_LABELS[category] || fallback;
}

// 非貓咪項目照名字分組（全員、小房間…）
function groupTasks(filter) {
    const map = new Map();
    for (const task of formData.value.tasks.filter(filter)) {
        if (!map.has(task.name)) map.set(task.name, []);
        map.get(task.name).push(task);
    }
    return [...map].map(([name, items]) => ({ name, items }));
}
const careTaskGroups = computed(() =>
    groupTasks((t) => !ADDON_CATEGORIES.includes(t.category))
);
const leaveTaskGroups = computed(() =>
    groupTasks((t) => ADDON_CATEGORIES.includes(t.category))
);

// 分頁上的數字：還沒打勾的項目數
const tabList = computed(() => {
    const undone = (list) => list.filter((i) => !i.done).length;
    const cats = formData.value.cats;
    const tasks = formData.value.tasks;
    return [
        { value: 'arrive', label: '觀察', remaining: 0 },
        {
            value: 'care',
            label: '醫療',
            remaining:
                cats.reduce((sum, c) => sum + undone(c.medical), 0) +
                undone(tasks.filter((t) => !ADDON_CATEGORIES.includes(t.category))),
        },
        {
            value: 'leave',
            label: '放飯',
            remaining:
                cats.reduce((sum, c) => sum + undone(c.with_meal), 0) +
                undone(tasks.filter((t) => ADDON_CATEGORIES.includes(t.category))),
        },
    ];
});

const prevLink = computed(() => {
    let date = $dayjs(formData.value.date);
    if (formData.value.shift === 'morning') date = date.subtract(1, 'day');
    return {
        name: 'shift',
        query: {
            date: date.format('YYYY-MM-DD'),
            shift: formData.value.shift === 'morning' ? 'night' : 'morning',
        },
    };
});

const isDisabled = computed(() => {
    const day = $dayjs(formData.value.date);
    const disabled = $dayjs().subtract(config.public.disabledDays || 2, 'day');
    return day < disabled;
});

// Date picker disabled date
const disabledDate = (time) => {
    const dateFrom = new Date(config.public.releaseDate || '2024-01-01');
    dateFrom.setDate(dateFrom.getDate() - 1);
    return time.getTime() > Date.now() || time.getTime() < dateFrom;
};

// 今天 18:00 前不能選晚班（跟 /medicine 一樣，避免提早建立晚班的記錄）
function disableShift(fromShift) {
    const { date } = formData.value;
    return (
        date &&
        $dayjs(date).isSame($dayjs(), 'day') &&
        new Date().getHours() < 18 &&
        fromShift === 'night'
    );
}

// Methods
const autoSave = debounce(UpdateShift, 800);

function onAutoSave() {
    isPending.value = true;
    if (formData.value.recordId) {
        autoSave();
    }
}

function setTab(value) {
    tab.value = value;
    router.replace({ query: { ...route.query, tab: value } });
}

function selectMe() {
    if (nickname.value) {
        formData.value.member = nickname.value;
        onAutoSave();
    }
}

function foodHandler(cat, type) {
    cat.intake[type === 'can' ? 'can_detail' : 'feed_detail'] = 0;
}

function fecesHandler(cat) {
    cat.intake.feces_warning = cat.intake.feces ? '正常' : null;
}

function dateHandler() {
    const { date, shift } = formData.value;
    if (disableShift(shift)) {
        ElMessage.error('錯誤，請重新選擇日期');
        return;
    }
    router.push({
        name: 'shift',
        query: { date: $dayjs(date).format('YYYY-MM-DD'), shift, tab: tab.value },
    });
}

function InitFromQuery() {
    const { date, shift, tab: queryTab } = route.query;

    formData.value.date = date ? new Date(date) : new Date();
    formData.value.shift = ['morning', 'night'].includes(shift)
        ? shift
        : new Date().getHours() < 18
        ? 'morning'
        : 'night';
    if (['arrive', 'care', 'leave'].includes(queryTab)) tab.value = queryTab;
}

async function InitMemberList() {
    try {
        const data = await $fetch('/api/volunteer/list');
        memberList.value = data.map((v) => ({ label: v.name, value: v.name }));
    } catch (e) {
        console.error('InitMemberList error:', e);
    }
}

async function InitShift() {
    const { date, shift } = formData.value;
    const params = { date: $dayjs(date).format('YYYY-MM-DD'), shift };
    // cache: 'no-store'：同一個網址同時被請求兩次時（開兩個分頁、或直接打開過 API 網址），
    // Chrome 會讓後到的等前一個寫完快取，最多卡 20 秒。這兩支每次都要最新資料，不用快取
    const [data, prevData] = await Promise.all([
        $fetch('/api/shift', { params, cache: 'no-store' }),
        // 前一班唯讀：沒有記錄就回 null，不會建立
        $fetch('/api/shift/previous', { params, cache: 'no-store' }).catch((e) => {
            console.error('InitPrevShift error:', e);
            return null;
        }),
    ]);

    formData.value.recordId = data.recordId;
    formData.value.date = new Date(data.date);
    formData.value.shift = data.shift;
    formData.value.cats = data.cats;
    formData.value.tasks = data.tasks;
    formData.value.note = data.note;
    formData.value.member = data.member;
    prev.value = {
        note: prevData?.note || null,
        released: prevData?.released || [],
    };

    subscribeToRealtime(data.recordId);
}

async function UpdateShift() {
    try {
        saveStatus.value = 'saving';
        const { recordId, cats, tasks, note, member } = formData.value;
        await $fetch('/api/shift/update', {
            method: 'POST',
            body: { recordId, cats, tasks, note, member },
        });
        saveStatus.value = 'success';
        lastSavedAt.value = new Date();
    } catch (e) {
        console.error('UpdateShift error:', e);
        saveStatus.value = 'error';
    } finally {
        isPending.value = false;
    }
}

function subscribeToRealtime(recordId) {
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }

    realtimeChannel.value = supabase
        .channel(`shift-${recordId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'shifts',
                filter: `id=eq.${recordId}`,
            },
            (payload) => {
                if (!payload.new) return;
                // 是自己的更新就忽略
                if (payload.new.updated_by === getUserId()) return;

                // 別人的更新，直接套用（jsonb 欄位收到的已經是物件）
                formData.value.cats = payload.new.cats;
                formData.value.tasks = payload.new.tasks;
                formData.value.note = payload.new.note;
                formData.value.member = payload.new.member;
                lastUpdatedAt.value = new Date();
            }
        )
        .subscribe();
}

async function Submit() {
    if (!formData.value.member) {
        ElMessage.error('請選擇填表志工');
        return;
    }
    await UpdateShift();
}

// 頁面離開前警告
function handleBeforeUnload(e) {
    if (isPending.value) {
        e.preventDefault();
        e.returnValue = '你有未儲存的變更，確定要離開嗎？';
        return e.returnValue;
    }
}

// Vue Router 導航離開前警告（手機滑動返回）
onBeforeRouteLeave((to, from, next) => {
    if (isPending.value) {
        const answer = window.confirm('你有未儲存的變更，確定要離開嗎？');
        if (!answer) {
            next(false);
            return;
        }
    }
    next();
});

async function load() {
    loading.value = true;
    try {
        InitFromQuery();
        await InitShift();
    } catch (error) {
        Swal.fire({
            html: `網路連線異常<br>請確認連線後重試。<br><br>錯誤：${error.message}`,
            confirmButtonColor: '#b33a39',
        });
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    InitMemberList();
    load();
});

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }
});

// 換日期或班別才重新載入；只換分頁不用
watch(
    () => [route.query.date, route.query.shift],
    ([date, shift], [oldDate, oldShift]) => {
        if (date !== oldDate || shift !== oldShift) load();
    }
);
</script>

<style lang="scss" scoped>
#shift {
    a {
        display: block;
    }

    .last-update,
    .last-saved {
        margin: 0 0 5px 0;
        color: #ccc;
        font-size: 11px;
    }

    .member-row {
        display: flex;
        gap: 8px;
        align-items: center;

        .member-select {
            flex: 1;
        }

        .el-button {
            width: auto !important;
            flex-shrink: 0;
            height: 45px;
        }
    }

    // ---- 觀察：跟 /regular 相同的吃喝排泄樣式 ----
    .el-slider {
        &.is-disabled {
            opacity: 0.5;
            :deep(.el-slider__marks-text) {
                color: #bbb;
            }
        }
    }

    .intake {
        .food {
            .el-slider {
                width: calc(100% - 60px);
                transform: translate(0, -6px);
            }
            .el-checkbox {
                width: 40px;
                margin-top: 4px;
            }
        }

        .excretion {
            > .d_flex {
                justify-content: start;
                flex-wrap: nowrap;
            }
            .W40 {
                display: flex;
                flex-wrap: nowrap;
                justify-content: start;
                padding-top: 12px;
                width: 80px;
            }
            .W60 {
                padding-left: 24px;
                width: calc(100% - 80px);
                :deep(.el-radio-group) {
                    display: flex;
                    flex-wrap: nowrap;
                    justify-content: start;
                    width: 100%;
                    label {
                        margin-right: 10px;
                    }
                }
            }
        }
    }
}

// ---- 分頁 ----
.tabs {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    gap: 6px;
    margin: 0 0 14px;
    padding: 8px 0;
    background: #fff;

    button {
        flex: 1;
        height: 40px;
        border: 1px solid #d8d4d1;
        border-radius: 6px;
        background: #fff;
        color: #657181;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;

        &.active {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }
    }

    .remaining {
        display: inline-block;
        min-width: 18px;
        height: 18px;
        margin-left: 4px;
        padding: 0 5px;
        border-radius: 9px;
        background: #b33a39;
        color: #fff;
        font-size: 12px;
        line-height: 18px;
        vertical-align: 1px;
    }
}

.prev-note {
    padding-top: 0;
}

.report {
    margin-top: 6px;
}

// ---- 卡片：跟 /medicine 相同 ----
.record_item {
    padding-right: 10px;
    border: 1px solid #d8d4d1;
    border-radius: 6px;
    margin-bottom: 14px;

    &:nth-child(even) {
        background-color: transparent;
    }

    &:first-child {
        border-top-color: #d8d4d1;
    }

    // 貓名 14px，行高經實測補償，見 pages/medicine.vue
    padding-top: 35px;

    // 不用 overflow: hidden 裁圓角：觀察分頁的滑桿標籤（吃光）會超出右邊被切掉。
    // 改成標籤自己配合卡片的圓角（6px 減掉 1px 邊框）
    .name {
        height: 26px;
        font-size: 14px;
        line-height: 25px;
        border-top-left-radius: 5px;
        border-bottom-right-radius: 6px;
    }

    // 觀察分頁滑桿最右邊的「吃光」會超出滑桿半個字寬，右邊留跟 /regular 一樣的 25px
    &.intake-card {
        padding-right: 25px;
    }

    // 非貓咪項目（全員、小房間…）用不同底色，一眼分出不是貓
    &.task-card {
        background-color: #faf8f6;

        .name {
            background-color: #b5aea9;
        }
    }

    .released-badge {
        position: absolute;
        top: 4px;
        right: 8px;
    }

    .detail {
        > .d_flex.divided {
            border-top: 1px dashed #ccc;
            padding-top: 10px;
        }

        > .item-row {
            align-items: baseline;

            > div {
                .done {
                    width: 40px;
                    > label {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        gap: 6px;
                        :deep(.el-checkbox__label) {
                            padding-left: 0 !important;
                            font-size: 12px;
                        }
                    }
                }

                .txt {
                    text-align: left;
                    width: calc(100% - 60px);

                    &.full {
                        width: 100%;
                    }

                    font {
                        display: block;
                        padding: 5px;

                        &.f_grey {
                            opacity: 0.9;
                            font-size: 14px;
                        }
                    }
                }
            }
        }
    }
}

// ---- 表單元件：跟 /regular 相同 ----
:deep(.el-slider__stop) {
    background-color: var(--el-color-primary);
}

:deep(.el-slider__marks-text) {
    color: #657181;
    font-size: 12px;
}

:deep(.el-radio__label) {
    font-weight: 400;
}

:deep(.el-checkbox),
:deep(.el-radio) {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 40px;
    margin-right: 0;

    span {
        padding: 4px 0 0;
        color: #657181;
        font-size: 12px;
        line-height: 14px;
    }

    .el-checkbox__input {
        width: 18px;
        height: 18px;
        padding-top: 0;
    }
}

:deep(.el-input) {
    max-width: 100%;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
    height: 45px;
}
</style>
