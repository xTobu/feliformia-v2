<template>
    <div id="vote">
        <!-- 標題 -->
        <div class="vote-header">
            <div class="header-left">
                <p class="week-range">{{ weekRangeText }}</p>
            </div>
            <el-checkbox v-model="isPass" @change="debouncedSave">
                本週Pass
            </el-checkbox>
        </div>

        <!-- 週選擇器 -->
        <div class="week-nav">
            <button @click="prevWeek" class="nav-btn">&lt; 上週</button>
            <button @click="thisWeek" class="nav-btn today">本週</button>
            <button @click="nextWeek" class="nav-btn">下週 &gt;</button>
            <button @click="openDatePicker" class="nav-btn icon-btn">
                <el-icon><Calendar /></el-icon>
            </button>
            <button @click="copyWeekLink" class="nav-btn icon-btn">
                <el-icon><Share /></el-icon>
            </button>
        </div>
        <el-date-picker
            ref="datePickerRef"
            v-model="jumpDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="
                position: absolute;
                opacity: 0;
                pointer-events: none;
                width: 0;
                height: 0;
            "
            @change="jumpToDate"
        />

        <!-- Loading -->
        <div v-if="loading" class="loading">載入中...</div>

        <!-- 投票內容 -->
        <div v-else class="vote-content" :class="{ disabled: isPass }">
            <div v-for="day in weekDays" :key="day.date" class="day-card">
                <div class="day-title">
                    {{ day.dateText }} ({{ day.weekday }})
                </div>

                <!-- 早班 -->
                <div class="shift-section">
                    <div class="shift-label">早班</div>
                    <div class="shift-options">
                        <div
                            v-for="option in morningOptions"
                            :key="'morning-' + option.id"
                            class="option-row"
                            :class="{
                                'no-votes': hasNoVotes(
                                    day.date,
                                    'morning',
                                    option.id
                                ),
                            }"
                        >
                            <!-- 有時間選擇的選項（如醫療） -->
                            <template v-if="option.has_time_range">
                                <div class="option-main">
                                    <el-checkbox
                                        :model-value="
                                            isChecked(
                                                day.date,
                                                'morning',
                                                option.id
                                            )
                                        "
                                        @change="
                                            (val) =>
                                                toggleOption(
                                                    day.date,
                                                    'morning',
                                                    option,
                                                    val
                                                )
                                        "
                                    >
                                        {{ option.name
                                        }}<template
                                            v-if="
                                                isChecked(
                                                    day.date,
                                                    'morning',
                                                    option.id
                                                )
                                            "
                                            >：{{ displayName }}
                                            {{
                                                getTimeValue(
                                                    day.date,
                                                    'morning',
                                                    option.id,
                                                    'start'
                                                )
                                            }}
                                            →
                                            {{
                                                getTimeValue(
                                                    day.date,
                                                    'morning',
                                                    option.id,
                                                    'end'
                                                )
                                            }}</template
                                        >
                                    </el-checkbox>

                                    <!-- 只有自己沒投時才顯示時間選擇器 -->
                                    <div
                                        v-if="
                                            !isChecked(
                                                day.date,
                                                'morning',
                                                option.id
                                            )
                                        "
                                        class="time-inputs"
                                    >
                                        <el-time-select
                                            :model-value="
                                                getTimeValue(
                                                    day.date,
                                                    'morning',
                                                    option.id,
                                                    'start'
                                                )
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    setTimeSelectValue(
                                                        day.date,
                                                        'morning',
                                                        option.id,
                                                        'start',
                                                        val
                                                    )
                                            "
                                            prefix-icon=""
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="開始時間"
                                        />
                                        <span>→</span>
                                        <el-time-select
                                            :model-value="
                                                getTimeValue(
                                                    day.date,
                                                    'morning',
                                                    option.id,
                                                    'end'
                                                )
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    setTimeSelectValue(
                                                        day.date,
                                                        'morning',
                                                        option.id,
                                                        'end',
                                                        val
                                                    )
                                            "
                                            prefix-icon=""
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="結束時間"
                                        />
                                    </div>
                                </div>

                                <!-- 其他人的投票（分行顯示） -->
                                <div
                                    v-for="(voter, idx) in getOtherVoters(
                                        day.date,
                                        'morning',
                                        option.id
                                    )"
                                    :key="idx"
                                    class="other-voter"
                                >
                                    {{ voter }}
                                </div>
                            </template>

                            <!-- 一般選項（灌食、值班等） -->
                            <template v-else>
                                <div class="option-main">
                                    <el-checkbox
                                        :model-value="
                                            isChecked(
                                                day.date,
                                                'morning',
                                                option.id
                                            )
                                        "
                                        @change="
                                            (val) =>
                                                toggleOption(
                                                    day.date,
                                                    'morning',
                                                    option,
                                                    val
                                                )
                                        "
                                    >
                                        {{ option.name
                                        }}<template
                                            v-if="
                                                getAllVotersText(
                                                    day.date,
                                                    'morning',
                                                    option
                                                )
                                            "
                                            >：{{
                                                getAllVotersText(
                                                    day.date,
                                                    'morning',
                                                    option
                                                )
                                            }}</template
                                        >
                                    </el-checkbox>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- 晚班 -->
                <div class="shift-section">
                    <div class="shift-label">晚班</div>
                    <div class="shift-options">
                        <div
                            v-for="option in nightOptions"
                            :key="'night-' + option.id"
                            class="option-row"
                            :class="{
                                'no-votes': hasNoVotes(
                                    day.date,
                                    'night',
                                    option.id
                                ),
                            }"
                        >
                            <!-- 有時間選擇的選項（如醫療） -->
                            <template v-if="option.has_time_range">
                                <div class="option-main">
                                    <el-checkbox
                                        :model-value="
                                            isChecked(
                                                day.date,
                                                'night',
                                                option.id
                                            )
                                        "
                                        @change="
                                            (val) =>
                                                toggleOption(
                                                    day.date,
                                                    'night',
                                                    option,
                                                    val
                                                )
                                        "
                                    >
                                        {{ option.name
                                        }}<template
                                            v-if="
                                                isChecked(
                                                    day.date,
                                                    'night',
                                                    option.id
                                                )
                                            "
                                            >：{{ displayName }}
                                            {{
                                                getTimeValue(
                                                    day.date,
                                                    'night',
                                                    option.id,
                                                    'start'
                                                )
                                            }}
                                            →
                                            {{
                                                getTimeValue(
                                                    day.date,
                                                    'night',
                                                    option.id,
                                                    'end'
                                                )
                                            }}</template
                                        >
                                    </el-checkbox>

                                    <!-- 只有自己沒投時才顯示時間選擇器 -->
                                    <div
                                        v-if="
                                            !isChecked(
                                                day.date,
                                                'night',
                                                option.id
                                            )
                                        "
                                        class="time-inputs"
                                    >
                                        <el-time-select
                                            :model-value="
                                                getTimeValue(
                                                    day.date,
                                                    'night',
                                                    option.id,
                                                    'start'
                                                )
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    setTimeSelectValue(
                                                        day.date,
                                                        'night',
                                                        option.id,
                                                        'start',
                                                        val
                                                    )
                                            "
                                            prefix-icon=""
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="開始時間"
                                        />
                                        <span>→</span>
                                        <el-time-select
                                            :model-value="
                                                getTimeValue(
                                                    day.date,
                                                    'night',
                                                    option.id,
                                                    'end'
                                                )
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    setTimeSelectValue(
                                                        day.date,
                                                        'night',
                                                        option.id,
                                                        'end',
                                                        val
                                                    )
                                            "
                                            prefix-icon=""
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="結束時間"
                                        />
                                    </div>
                                </div>

                                <!-- 其他人的投票（分行顯示） -->
                                <div
                                    v-for="(voter, idx) in getOtherVoters(
                                        day.date,
                                        'night',
                                        option.id
                                    )"
                                    :key="idx"
                                    class="other-voter"
                                >
                                    {{ voter }}
                                </div>
                            </template>

                            <!-- 一般選項（灌食、值班等） -->
                            <template v-else>
                                <div class="option-main">
                                    <el-checkbox
                                        :model-value="
                                            isChecked(
                                                day.date,
                                                'night',
                                                option.id
                                            )
                                        "
                                        @change="
                                            (val) =>
                                                toggleOption(
                                                    day.date,
                                                    'night',
                                                    option,
                                                    val
                                                )
                                        "
                                    >
                                        {{ option.name
                                        }}<template
                                            v-if="
                                                getAllVotersText(
                                                    day.date,
                                                    'night',
                                                    option
                                                )
                                            "
                                            >：{{
                                                getAllVotersText(
                                                    day.date,
                                                    'night',
                                                    option
                                                )
                                            }}</template
                                        >
                                    </el-checkbox>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 提示 -->
        <p class="medical-hint">★ 醫療：皮下/胰島素/餵藥</p>

        <!-- 值班概況 -->
        <div class="vote-status">
            <h2>值班概況</h2>
            <div class="status-row">
                <div class="status-label">未投票</div>
                <div class="status-names">{{ notVotedNames || '無' }}</div>
            </div>
            <div class="status-row">
                <div class="status-label">已投票</div>
                <div class="status-names">{{ votedNames || '無' }}</div>
            </div>
            <div class="status-row">
                <div class="status-label">本週 Pass</div>
                <div class="status-names">{{ passNames || '無' }}</div>
            </div>
            <div class="status-row empty-slots">
                <div class="empty-header">
                    <div class="status-label">本週空班</div>
                    <el-button text @click="showEmptySlots = !showEmptySlots">
                        {{ showEmptySlots ? '收合' : '展開' }}
                    </el-button>
                </div>
                <div v-show="showEmptySlots" class="status-content">
                    <template v-if="emptySlots.length">
                        <div
                            v-for="day in emptySlots"
                            :key="day.date"
                            class="empty-day"
                        >
                            <div class="empty-date">
                                {{ day.dateText }} ({{ day.weekday }})
                            </div>
                            <div class="empty-list">
                                <div
                                    v-for="slot in day.slots"
                                    :key="slot"
                                    class="empty-item"
                                >
                                    • {{ slot }}
                                </div>
                            </div>
                            <div class="empty-spacer">&nbsp;</div>
                        </div>
                    </template>
                    <span v-else>無</span>
                </div>
            </div>
            <div class="status-row weekly-stats">
                <div class="empty-header">
                    <div class="status-label">本週統計</div>
                    <el-button text @click="showWeeklyStats = !showWeeklyStats">
                        {{ showWeeklyStats ? '收合' : '展開' }}
                    </el-button>
                </div>
                <div v-show="showWeeklyStats" class="status-content">
                    <div class="stats-filter">
                        <el-select
                            v-model="selectedStats"
                            multiple
                            collapse-tags
                            collapse-tags-tooltip
                            placeholder="全部顯示"
                            clearable
                        >
                            <el-option
                                v-for="option in weeklyStats"
                                :key="option.id"
                                :label="option.name"
                                :value="option.id"
                            />
                        </el-select>
                    </div>
                    <div
                        v-for="option in filteredWeeklyStats"
                        :key="option.id"
                        class="stats-option"
                    >
                        <div class="stats-option-name">{{ option.name }}</div>
                        <div class="stats-days">
                            <div
                                v-for="day in option.days"
                                :key="day.date"
                                class="stats-day"
                            >
                                <div class="stats-date">
                                    {{ day.dateText }} ({{ day.weekday }})
                                </div>
                                <div class="stats-voters">
                                    <template v-if="day.voters.length">
                                        <div
                                            v-for="voter in day.voters"
                                            :key="voter.name"
                                            class="voter-item"
                                        >
                                            • {{ voter.name
                                            }}<span
                                                v-if="
                                                    voter.timeStart &&
                                                    voter.timeEnd
                                                "
                                                class="voter-time"
                                            >
                                                {{ voter.timeStart }} →
                                                {{ voter.timeEnd }}</span
                                            >
                                        </div>
                                    </template>
                                    <span v-else class="no-voter"
                                        >無人投票</span
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { debounce } from 'lodash-es';
import Swal from 'sweetalert2';
import { Calendar, Share } from '@element-plus/icons-vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '值班投票',
});

const supabase = useSupabaseClient();
const route = useRoute();
const router = useRouter();
const { $dayjs } = useNuxtApp();
const { displayName } = useProfile();

// 狀態
const loading = ref(true);
const isPass = ref(false);
const weekStart = ref(null);
const weekDays = ref([]);
const voteOptions = ref([]);
const myVoteData = ref({});
const allVotes = ref([]);
const allUsers = ref([]);
const currentUserId = ref(null);
const jumpDate = ref(null);
const datePickerRef = ref(null);
const showEmptySlots = ref(false);
const showWeeklyStats = ref(false);
const selectedStats = ref([]);

// localStorage 管理
const { get: getStorage, set: setStorage } = useLocalStorage();

// 從 localStorage 讀取篩選設定
onMounted(() => {
    const saved = getStorage('vote-stats-filter', []);
    if (saved.length) {
        selectedStats.value = saved;
    }
});

// 監聽變化並存到 localStorage
watch(
    selectedStats,
    (newVal) => {
        setStorage('vote-stats-filter', newVal);
    },
    { deep: true }
);

// 早班選項（shift 為 'both' 或 'morning'）
const morningOptions = computed(() => {
    return voteOptions.value.filter(
        (opt) => !opt.shift || opt.shift === 'both' || opt.shift === 'morning'
    );
});

// 晚班選項（shift 為 'both' 或 'night'）
const nightOptions = computed(() => {
    return voteOptions.value.filter(
        (opt) => !opt.shift || opt.shift === 'both' || opt.shift === 'night'
    );
});

// 計算本週範圍文字
const weekRangeText = computed(() => {
    if (!weekStart.value) return '';
    const start = $dayjs(weekStart.value);
    const end = start.add(6, 'day');
    return `${start.format('YYYY/MM/DD')} - ${end.format('MM/DD')}`;
});

// 用 user_id 查 nickname 的 Map
const userMap = computed(() => {
    const map = new Map();
    for (const user of allUsers.value) {
        map.set(user.id, user.nickname || user.email || '未命名');
    }
    return map;
});

// 根據 user_id 取得 nickname
function getNickname(userId) {
    return userMap.value.get(userId) || '未命名';
}

// 檢查 data 中是否有任何 checked 項目
function hasAnyChecked(data) {
    if (!data) return false;
    for (const date in data) {
        for (const shift in data[date]) {
            for (const optionId in data[date][shift]) {
                if (data[date][shift][optionId]?.checked) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 檢查某個選項是否完全沒有人投票（不含 Pass 的人）
function hasNoVotes(date, shift, optionId) {
    // 如果該選項設定為跳過空班檢查，直接回傳 false
    const option = voteOptions.value.find((opt) => opt.id === optionId);
    if (option?.skip_empty_check) {
        return false;
    }

    for (const vote of allVotes.value) {
        // 跳過 Pass 的人
        if (vote.is_pass) continue;

        const voteData = vote.data?.[date]?.[shift]?.[optionId];
        if (voteData?.checked) {
            return false; // 有人投票
        }
    }
    return true; // 沒有人投票
}

// 已投票名單（有勾選任何選項 或 Pass）
const votedNames = computed(() => {
    return allVotes.value
        .filter((v) => v.is_pass || hasAnyChecked(v.data))
        .map((v) => getNickname(v.user_id))
        .join('、');
});

// 本週 Pass 名單
const passNames = computed(() => {
    return allVotes.value
        .filter((v) => v.is_pass)
        .map((v) => getNickname(v.user_id))
        .join('、');
});

// 未投票名單（沒有任何動作的人，只顯示啟用中的用戶）
const notVotedNames = computed(() => {
    // 取得有投票或 Pass 的 user_id
    const activeUserIds = allVotes.value
        .filter((v) => v.is_pass || hasAnyChecked(v.data))
        .map((v) => v.user_id);

    return allUsers.value
        .filter((u) => u.is_active !== false && !activeUserIds.includes(u.id))
        .map((u) => u.nickname || u.email || '未命名')
        .join('、');
});

// 本週空班列表
const emptySlots = computed(() => {
    const result = [];
    const shiftLabels = { morning: '早班', night: '晚班' };

    for (const day of weekDays.value) {
        const daySlots = [];

        // 早班：檢查 morningOptions
        for (const option of morningOptions.value) {
            if (hasNoVotes(day.date, 'morning', option.id)) {
                daySlots.push(`${shiftLabels['morning']} - ${option.name}`);
            }
        }

        // 晚班：檢查 nightOptions
        for (const option of nightOptions.value) {
            if (hasNoVotes(day.date, 'night', option.id)) {
                daySlots.push(`${shiftLabels['night']} - ${option.name}`);
            }
        }

        if (daySlots.length > 0) {
            result.push({
                date: day.date,
                dateText: day.dateText,
                weekday: day.weekday,
                slots: daySlots,
            });
        }
    }

    return result;
});

// 本週統計：每個班別+選項的投票人
const weeklyStats = computed(() => {
    const result = [];

    // 早班選項
    for (const option of morningOptions.value) {
        const days = [];

        for (const day of weekDays.value) {
            const voters = [];

            for (const vote of allVotes.value) {
                if (vote.is_pass) continue;

                const voteData = vote.data?.[day.date]?.morning?.[option.id];
                if (voteData?.checked) {
                    const voterInfo = {
                        name: getNickname(vote.user_id),
                        timeStart: voteData.time_start || null,
                        timeEnd: voteData.time_end || null,
                    };
                    voters.push(voterInfo);
                }
            }

            days.push({
                date: day.date,
                dateText: day.dateText,
                weekday: day.weekday,
                voters,
            });
        }

        result.push({
            id: `morning-${option.id}`,
            name: `早班 - ${option.name}`,
            hasTimeRange: option.has_time_range,
            days,
        });
    }

    // 晚班選項
    for (const option of nightOptions.value) {
        const days = [];

        for (const day of weekDays.value) {
            const voters = [];

            for (const vote of allVotes.value) {
                if (vote.is_pass) continue;

                const voteData = vote.data?.[day.date]?.night?.[option.id];
                if (voteData?.checked) {
                    const voterInfo = {
                        name: getNickname(vote.user_id),
                        timeStart: voteData.time_start || null,
                        timeEnd: voteData.time_end || null,
                    };
                    voters.push(voterInfo);
                }
            }

            days.push({
                date: day.date,
                dateText: day.dateText,
                weekday: day.weekday,
                voters,
            });
        }

        result.push({
            id: `night-${option.id}`,
            name: `晚班 - ${option.name}`,
            hasTimeRange: option.has_time_range,
            days,
        });
    }

    return result;
});

// 過濾後的本週統計
const filteredWeeklyStats = computed(() => {
    if (selectedStats.value.length === 0) {
        return weeklyStats.value;
    }
    return weeklyStats.value.filter((option) =>
        selectedStats.value.includes(option.id)
    );
});

// 初始化週（從週二開始：二三四五六日一）
function initWeek(date = null) {
    const targetDate = date ? $dayjs(date) : $dayjs();
    // 取得該週的週二
    const dayOfWeek = targetDate.day(); // 0=日, 1=一, 2=二, ...
    const daysToSubtract = (dayOfWeek - 2 + 7) % 7; // 計算到週二要減幾天
    const tuesday = targetDate.subtract(daysToSubtract, 'day');
    weekStart.value = tuesday.format('YYYY-MM-DD');

    const weekdays = ['二', '三', '四', '五', '六', '日', '一'];
    weekDays.value = [];

    for (let i = 0; i < 7; i++) {
        const day = tuesday.add(i, 'day');
        weekDays.value.push({
            date: day.format('YYYY-MM-DD'),
            dateText: day.format('MM/DD'),
            weekday: weekdays[i],
        });
    }
}

// 上一週
function prevWeek() {
    const prev = $dayjs(weekStart.value).subtract(7, 'day');
    initWeek(prev);
    router.replace({ query: { date: weekStart.value } });
    loadData();
    setupRealtimeSubscription();
}

// 本週
function thisWeek() {
    initWeek();
    router.replace({ query: {} });
    loadData();
    setupRealtimeSubscription();
}

// 下一週
function nextWeek() {
    const next = $dayjs(weekStart.value).add(7, 'day');
    initWeek(next);
    router.replace({ query: { date: weekStart.value } });
    loadData();
    setupRealtimeSubscription();
}

// 跳至指定日期
function jumpToDate(date) {
    if (date) {
        initWeek($dayjs(date));
        router.replace({ query: { date: weekStart.value } });
        loadData();
        setupRealtimeSubscription();
        jumpDate.value = null; // 清空選擇器
    }
}

// 打開日期選擇器
function openDatePicker() {
    datePickerRef.value?.focus();
}

// 複製本週連結
async function copyWeekLink() {
    const url = `${window.location.origin}/vote?date=${weekStart.value}`;
    try {
        await navigator.clipboard.writeText(url);
        Swal.fire({
            html: `已複製連結<br><span style="font-size: 12px; color: #999; word-break: break-all;">${url}</span>`,
            timer: 2000,
            showConfirmButton: false,
        });
    } catch {
        Swal.fire({
            text: '複製失敗',
            confirmButtonColor: '#b33a39',
        });
    }
}

// 載入投票選項
async function loadVoteOptions() {
    const { data } = await supabase
        .from('vote_options')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    if (data) {
        voteOptions.value = data;
    }
}

// 載入所有用戶
async function loadUsers() {
    try {
        allUsers.value = await $fetch('/api/users/list');
    } catch (error) {
        console.error('載入用戶失敗:', error);
    }
}

// 載入所有投票
async function loadAllVotes() {
    const { data } = await supabase
        .from('votes')
        .select('*')
        .eq('week_start', weekStart.value);

    if (data) {
        allVotes.value = data;

        // 找到自己的投票
        const myVote = data.find((v) => v.user_id === currentUserId.value);
        if (myVote) {
            isPass.value = myVote.is_pass || false;
            myVoteData.value = myVote.data || {};
        } else {
            isPass.value = false;
            myVoteData.value = {};
        }
    }
}

// 載入資料
async function loadData() {
    loading.value = true;
    await Promise.all([loadVoteOptions(), loadUsers(), loadAllVotes()]);
    loading.value = false;
}

// 檢查是否勾選
function isChecked(date, shift, optionId) {
    return myVoteData.value[date]?.[shift]?.[optionId]?.checked || false;
}

// 取得其他人的投票（不含自己，不含 Pass 的人）
function getOtherVoters(date, shift, optionId) {
    const voters = [];

    for (const vote of allVotes.value) {
        // 跳過自己
        if (vote.user_id === currentUserId.value) continue;
        // 跳過 Pass 的人
        if (vote.is_pass) continue;

        const voteData = vote.data?.[date]?.[shift]?.[optionId];
        if (voteData?.checked) {
            const name = getNickname(vote.user_id);

            // 如果有時間，加上時間資訊
            if (voteData.time_start && voteData.time_end) {
                voters.push(
                    `${name} ${voteData.time_start} → ${voteData.time_end}`
                );
            } else {
                voters.push(name);
            }
        }
    }

    return voters;
}

// 取得所有投票者文字（用於 checkbox 旁邊顯示，不含 Pass 的人）
function getAllVotersText(date, shift, option) {
    const names = [];

    // 先加自己（如果自己沒有 Pass）
    if (isChecked(date, shift, option.id) && !isPass.value) {
        names.push(displayName.value);
    }

    // 再加其他人（跳過 Pass 的人）
    for (const vote of allVotes.value) {
        if (vote.user_id === currentUserId.value) continue;
        if (vote.is_pass) continue;

        const voteData = vote.data?.[date]?.[shift]?.[option.id];
        if (voteData?.checked) {
            names.push(getNickname(vote.user_id));
        }
    }

    return names.join('、');
}

// 檢查時間是否填寫完整
function hasValidTime(date, shift, optionId) {
    const timeStart = myVoteData.value[date]?.[shift]?.[optionId]?.time_start;
    const timeEnd = myVoteData.value[date]?.[shift]?.[optionId]?.time_end;
    return timeStart && timeEnd;
}

// 切換選項
function toggleOption(date, shift, option, newValue) {
    if (!myVoteData.value[date]) {
        myVoteData.value[date] = {};
    }
    if (!myVoteData.value[date][shift]) {
        myVoteData.value[date][shift] = {};
    }
    if (!myVoteData.value[date][shift][option.id]) {
        myVoteData.value[date][shift][option.id] = {};
    }

    // 如果是需要時間的選項，且要勾選，檢查時間是否填寫
    if (newValue && option.has_time_range) {
        if (!hasValidTime(date, shift, option.id)) {
            // 時間未填寫，不允許勾選
            return;
        }
    }

    myVoteData.value[date][shift][option.id].checked = newValue;

    debouncedSave();
}

// 取得時間值
function getTimeValue(date, shift, optionId, type) {
    return myVoteData.value[date]?.[shift]?.[optionId]?.[`time_${type}`] || '';
}

// 設定時間值（給 el-time-select 用）
function setTimeSelectValue(date, shift, optionId, type, val) {
    if (!myVoteData.value[date]) myVoteData.value[date] = {};
    if (!myVoteData.value[date][shift]) myVoteData.value[date][shift] = {};
    if (!myVoteData.value[date][shift][optionId])
        myVoteData.value[date][shift][optionId] = {};

    myVoteData.value[date][shift][optionId][`time_${type}`] = val;
    // 不要自動儲存，等用戶勾選時再儲存
}

// 儲存投票
async function saveVote() {
    if (!currentUserId.value) {
        Swal.fire({
            html: '請先登入',
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    try {
        const voteRecord = {
            user_id: currentUserId.value,
            week_start: weekStart.value,
            is_pass: isPass.value,
            data: myVoteData.value,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('votes').upsert(voteRecord, {
            onConflict: 'user_id,week_start',
        });

        if (error) {
            console.error('Save error:', error);
            Swal.fire({
                html: '投票失敗。<br>請確認網路狀態，或者聯繫群組。',
                confirmButtonColor: '#b33a39',
            });
        } else {
            // 更新本地 allVotes 中自己的那筆
            const index = allVotes.value.findIndex(
                (v) => v.user_id === currentUserId.value
            );
            if (index !== -1) {
                allVotes.value[index] = {
                    ...allVotes.value[index],
                    ...voteRecord,
                };
            } else {
                allVotes.value.push(voteRecord);
            }
        }
    } catch (err) {
        console.error('Save error:', err);
        Swal.fire({
            html: '儲存失敗。<br>請確認網路狀態後重試。',
            confirmButtonColor: '#b33a39',
        });
    }
}

// 防抖儲存
const debouncedSave = debounce(saveVote, 800);

// Realtime 訂閱
let votesChannel = null;

function setupRealtimeSubscription() {
    // 取消舊的訂閱
    if (votesChannel) {
        supabase.removeChannel(votesChannel);
    }

    // 訂閱 votes 表的變更（只訂閱當前週）
    votesChannel = supabase
        .channel(`votes:${weekStart.value}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'votes',
                filter: `week_start=eq.${weekStart.value}`,
            },
            (payload) => {
                console.log('Realtime vote update:', payload);
                handleRealtimeUpdate(payload);
            }
        )
        .subscribe();
}

function handleRealtimeUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        // 新增投票，加入 allVotes
        // 跳過自己的（自己的已經在本地更新了）
        if (newRecord.user_id !== currentUserId.value) {
            allVotes.value.push(newRecord);
        }
    } else if (eventType === 'UPDATE') {
        // 更新投票
        const index = allVotes.value.findIndex(
            (v) =>
                v.user_id === newRecord.user_id &&
                v.week_start === newRecord.week_start
        );
        if (index !== -1) {
            // 如果是自己的，只更新非本地控制的欄位
            if (newRecord.user_id === currentUserId.value) {
                // 自己的投票不需要更新（本地已是最新）
                return;
            }
            allVotes.value[index] = newRecord;
        } else {
            // 找不到就加入
            if (newRecord.user_id !== currentUserId.value) {
                allVotes.value.push(newRecord);
            }
        }
    } else if (eventType === 'DELETE') {
        // 刪除投票
        const index = allVotes.value.findIndex(
            (v) =>
                v.user_id === oldRecord.user_id &&
                v.week_start === oldRecord.week_start
        );
        if (index !== -1) {
            allVotes.value.splice(index, 1);
        }
    }
}

// 初始化
onMounted(async () => {
    // 取得當前用戶 ID（只取一次）
    const {
        data: { user: currentUser },
    } = await supabase.auth.getUser();
    currentUserId.value = currentUser?.id;

    // 檢查 URL 是否有指定日期
    const dateParam = route.query.date;
    if (dateParam && $dayjs(dateParam).isValid()) {
        initWeek($dayjs(dateParam));
    } else {
        initWeek();
    }

    await loadData();
    setupRealtimeSubscription();
});

// 清理訂閱
onUnmounted(() => {
    if (votesChannel) {
        supabase.removeChannel(votesChannel);
    }
});
</script>

<style lang="scss" scoped>
#vote {
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;
}

.vote-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .header-left {
        .week-range {
            color: #555;
            font-weight: 500;
            font-size: 17px;
            margin: 0;
        }
    }
}

.week-nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;

    .nav-btn {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        font-size: 13px;
        cursor: pointer;

        &:hover {
            background: #f5f5f5;
        }

        &.today {
            background: #6da2c2;
            color: white;
            border-color: #6da2c2;

            &:hover {
                background: #5a8fb0;
            }
        }

        &.icon-btn {
            width: 32px;
            display: flex;
            align-items: center;
            justify-content: center;

            .el-icon {
                font-size: 14px;
            }
        }
    }
}

.loading {
    text-align: center;
    padding: 40px;
    color: #999;
}

.vote-content {
    &.disabled {
        opacity: 0.4;
        pointer-events: none;
    }
}

.day-card {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 16px;
}

.day-title {
    font-weight: 500;
    font-size: 15px;
    padding: 8px;
    border-bottom: 1px solid #eee;
    background: #f5f7f8;
}

.shift-section {
    display: flex;
    padding: 12px 12px 8px;

    &:first-child {
        padding-top: 0;
    }
}

/* 早班和晚班之間的分隔線 */
.shift-section + .shift-section {
    border-top: 1px solid #eee;
}

.shift-label {
    width: 45px;
    color: #6da2c2;
    font-size: 14px;
    font-weight: 500;
    flex-shrink: 0;
    display: flex;
    align-items: center;
}

.shift-options {
    flex: 1;

    /* 讓勾選後的文字不要變藍色 */
    :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
        color: inherit;
    }
}

.option-row {
    &:last-child {
        margin-bottom: 0;
    }

    /* 沒有人投票時的 highlight 樣式 */
    &.no-votes {
        background: #fff8e6;
        // border-left: 3px solid #e6a23c;
        margin-left: -8px;
        padding-left: 8px;
        margin-right: -8px;
        padding-right: 8px;
        padding-top: 4px;
        padding-bottom: 4px;
        margin-bottom: 4px;
        border-radius: 0 4px 4px 0;
    }
}

.option-main {
    display: flex;
    align-items: center;
    gap: 8px;
}

.other-voter {
    padding: 2px 0;
    font-size: 14px;
    font-weight: 500;
    color: #666;
    text-align: left;
    margin-left: 68px;
}

.time-inputs {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: calc(100% - 60px);

    span {
        color: #999;
    }
    :deep(.el-select__wrapper) {
        justify-content: start;
        font-size: 12px;
        height: 40px;
        padding: 0px 6px 0 8px;
        .el-select__prefix {
            display: none;
        }
    }
}

.medical-hint {
    text-align: right;
    color: #b33a39;
    font-size: 13px;
    margin: 16px 0;
}

.vote-status {
    background: #f5f7f8;
    border-radius: 8px;
    padding: 16px;

    h2 {
        font-size: 16px;
        margin: 0 0 12px 0;
    }

    .status-row {
        display: flex;
        padding: 10px 0;
        border-top: 1px solid #e0e0e0;

        &:first-of-type {
            border-top: none;
        }
    }

    .status-label {
        width: 75px;
        font-weight: 500;
        font-size: 14px;
        flex-shrink: 0;
    }

    .status-names {
        flex: 1;
        font-size: 14px;
        color: #666;
        line-height: 1.5;
    }

    .empty-slots {
        flex-direction: column;
        align-items: flex-start;

        .empty-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;

            .status-label {
                margin-bottom: 0;
            }

            .el-button {
                color: #6da2c2;
                padding: 4px 8px;
            }
        }

        .status-content {
            width: 100%;
            font-size: 14px;
            color: #666;
            margin-top: 12px;
            text-align: left;
            padding-left: 50%;
        }

        .empty-day {
            margin-bottom: 4px;

            &:last-child {
                margin-bottom: 0;

                .empty-spacer {
                    display: none;
                }
            }
        }

        .empty-spacer {
            height: 8px;
            user-select: text;
        }

        .empty-date {
            font-weight: 500;
            color: #555;
            margin-bottom: 4px;
        }

        .empty-list {
            margin: 0;
            padding-left: 8px;

            .empty-item {
                // color: #e6a23c;
                line-height: 1.6;
                text-align: left;
            }
        }
    }

    .weekly-stats {
        flex-direction: column;
        align-items: flex-start;

        .empty-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;

            .status-label {
                margin-bottom: 0;
            }

            .el-button {
                color: #6da2c2;
                padding: 4px 8px;
            }
        }

        .status-content {
            width: 100%;
            font-size: 14px;
            color: #666;
            margin-top: 12px;
            text-align: left;
            padding-left: 50%;
        }

        .stats-filter {
            margin-bottom: 16px;

            :deep(button) {
                width: auto;
            }
        }

        .stats-option {
            margin-bottom: 20px;

            &:last-child {
                margin-bottom: 0;
            }
        }

        .stats-option-name {
            font-weight: 600;
            color: #b33a39;
            font-size: 15px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e0e0e0;
        }

        .stats-days {
            // 不需要額外 padding，已經由 status-content 的 padding-left: 50% 處理
        }

        .stats-day {
            margin-bottom: 8px;

            &:last-child {
                margin-bottom: 0;
            }
        }

        .stats-date {
            font-weight: 500;
            color: #555;
            margin-bottom: 2px;
        }

        .stats-voters {
            padding-left: 8px;
            line-height: 1.6;
            color: #555;

            .voter-item {
                margin-bottom: 2px;
            }

            .voter-time {
                color: #888;
                font-size: 13px;
                margin-left: 4px;
            }

            .no-voter {
                color: #999;
            }
        }
    }
}
</style>
