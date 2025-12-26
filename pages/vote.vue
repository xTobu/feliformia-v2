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
        </div>

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
                            v-for="option in voteOptions"
                            :key="'morning-' + option.id"
                            class="option-row"
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
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="開始"
                                            style="width: 100px"
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
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="結束"
                                            style="width: 100px"
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
                            v-for="option in voteOptions"
                            :key="'night-' + option.id"
                            class="option-row"
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
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="開始"
                                            style="width: 100px"
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
                                            start="06:00"
                                            step="00:15"
                                            end="23:30"
                                            placeholder="結束"
                                            style="width: 100px"
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

                <!-- 備註 -->
                <div class="note-section">
                    <div class="note-label">備註</div>
                    <textarea
                        :value="getNoteValue(day.date)"
                        @blur="setNoteValue(day.date, $event)"
                        placeholder="請輸入備註"
                    ></textarea>
                </div>
            </div>
        </div>

        <!-- 提示 -->
        <p class="medical-hint">★ 醫療：皮下/胰島素/餵藥</p>

        <!-- 值班概況 -->
        <div class="vote-status">
            <h2>值班概況</h2>
            <div class="status-row">
                <div class="status-label">已投票</div>
                <div class="status-names">{{ votedNames || '無' }}</div>
            </div>
            <div class="status-row">
                <div class="status-label">未投票</div>
                <div class="status-names">{{ notVotedNames || '無' }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { debounce } from 'lodash-es';
import Swal from 'sweetalert2';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '值班投票',
});

const supabase = useSupabaseClient();
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
const saveStatus = ref('');
const currentUserId = ref(null);

// 計算本週範圍文字
const weekRangeText = computed(() => {
    if (!weekStart.value) return '';
    const start = $dayjs(weekStart.value);
    const end = start.add(6, 'day');
    return `${start.format('YYYY/MM/DD')} - ${end.format('MM/DD')}`;
});

// 已投票名單
const votedNames = computed(() => {
    return allVotes.value
        .filter((v) => !v.is_pass || Object.keys(v.data || {}).length > 0)
        .map((v) => v.nickname || '未命名')
        .join('、');
});

// 未投票名單
const notVotedNames = computed(() => {
    const votedUserIds = allVotes.value.map((v) => v.user_id);

    return allUsers.value
        .filter((u) => !votedUserIds.includes(u.id))
        .map((u) => u.nickname || '未命名')
        .join('、');
});

// 初始化週
function initWeek(date = null) {
    const targetDate = date ? $dayjs(date) : $dayjs();
    // 取得該週的週一
    const dayOfWeek = targetDate.day();
    const monday = targetDate.subtract(
        dayOfWeek === 0 ? 6 : dayOfWeek - 1,
        'day'
    );
    weekStart.value = monday.format('YYYY-MM-DD');

    const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    weekDays.value = [];

    for (let i = 0; i < 7; i++) {
        const day = monday.add(i, 'day');
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
    loadData();
    setupRealtimeSubscription();
}

// 本週
function thisWeek() {
    initWeek();
    loadData();
    setupRealtimeSubscription();
}

// 下一週
function nextWeek() {
    const next = $dayjs(weekStart.value).add(7, 'day');
    initWeek(next);
    loadData();
    setupRealtimeSubscription();
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
    const { data } = await supabase.from('profiles').select('id, nickname');

    if (data) {
        allUsers.value = data;
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
            const name = vote.nickname || '未命名';

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
            names.push(vote.nickname || '未命名');
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

// 取得備註值
function getNoteValue(date) {
    return myVoteData.value[date]?.note || '';
}

// 設定備註值
function setNoteValue(date, event) {
    if (!myVoteData.value[date]) myVoteData.value[date] = {};
    myVoteData.value[date].note = event.target.value;
    debouncedSave();
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
            nickname: displayName.value || '未命名',
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

    initWeek();
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
    padding: 16px;
    padding-bottom: 80px;
}

.vote-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .header-left {
        h1 {
            font-size: 18px;
            margin: 0 0 4px 0;
        }

        .week-range {
            color: #6da2c2;
            font-weight: 500;
            font-size: 15px;
            margin: 0;
        }
    }
}

.week-nav {
    display: flex;
    justify-content: center;
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
    padding: 16px;
    margin-bottom: 16px;
}

.day-title {
    font-weight: 500;
    font-size: 15px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
}

.shift-section {
    display: flex;
    margin-bottom: 12px;
}

.shift-label {
    width: 45px;
    color: #6da2c2;
    font-size: 14px;
    font-weight: 500;
    flex-shrink: 0;
    padding-top: 2px;
}

.shift-options {
    flex: 1;

    // 讓勾選後的文字不要變藍色
    :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
        color: inherit;
    }
}

.option-row {
    margin-bottom: 8px;

    &:last-child {
        margin-bottom: 0;
    }
}

.option-main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

.other-voter {
    padding: 2px 0;
    font-size: 14.25px;
    color: #666;

    // junx 先用 margin-left 硬推
    text-align: left;
    margin-left: 64px;
}

.time-inputs {
    display: inline-flex;
    align-items: center;
    gap: 4px;

    span {
        color: #999;
    }
}

.note-section {
    display: flex;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #eee;

    .note-label {
        width: 45px;
        color: #6da2c2;
        font-size: 14px;
        font-weight: 500;
        flex-shrink: 0;
    }

    textarea {
        flex: 1;
        min-height: 60px;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        resize: vertical;
        font-family: inherit;

        &:focus {
            outline: none;
            border-color: #6da2c2;
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
        width: 60px;
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
}

.save-status {
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 14px;
    z-index: 100;
}
</style>
