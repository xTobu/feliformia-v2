<template>
    <ClientOnly>
        <div v-loading="loading" id="medicine">
            <h1>餵藥及特殊飲食紀錄表</h1>
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

                <div class="W100">
                    <div
                        v-for="(cat, index) in formData.cats"
                        class="d_flex record_item"
                        :key="`${cat.notice}${index}`"
                    >
                        <div class="name">{{ cat.name }}</div>
                        <div class="detail">
                            <div class="d_flex treatment">
                                <p class="f_blue">事項</p>
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{
                                            cat.treatment
                                        }}</font>
                                        <font class="f_grey">{{
                                            cat.reason && `原因：${cat.reason}`
                                        }}</font>
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="cat.done"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 前班備註 -->
                <div class="W100 ps f_grey">
                    <template v-if="formData.remark">
                        <b>*前班備註：</b>
                        <span style="white-space: pre-line">{{
                            formData.remark
                        }}</span>
                    </template>
                </div>

                <!-- 額外狀況回報 -->
                <div class="W100 mb20">
                    <el-input
                        type="textarea"
                        v-model="formData.note"
                        :disabled="isDisabled"
                        placeholder="額外狀況回報"
                        @change="onAutoSave"
                    />
                </div>

                <!-- 填表志工 -->
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

                <!-- 按鈕區 -->
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
                        <template v-if="saveStatus === 'saving'"
                            >儲存中...</template
                        >
                        <template v-else-if="saveStatus === 'error'"
                            >儲存失敗，請手動重試</template
                        >
                        <template v-else>儲存表單</template>
                    </button>

                    <button
                        type="button"
                        class="btn line-green"
                        v-show="!isDisabled"
                        @click="ManualNotifyLine"
                    >
                        {{ loadingNotify ? '通知中...' : 'LINE 手動發送' }}
                    </button>

                    <NuxtLink class="f_red" :to="prevLink" target="_blank"
                        >看前班紀錄</NuxtLink
                    >
                    <NuxtLink class="f_red" to="/medicine" target="_blank"
                        >回到今天</NuxtLink
                    >
                    <NuxtLink class="f_red" to="/regular" target="_blank"
                        >前往飲食及如廁紀錄</NuxtLink
                    >
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
import { debounce, isEqual } from 'lodash-es';
import Swal from 'sweetalert2';
import FloatButton from '~/components/FloatButton.vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '餵藥及特殊飲食須知',
});

const { $dayjs } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const supabase = useSupabaseClient();
const { nickname } = useProfile();

// State
const loading = ref(true);
const loadingNotify = ref(false);
const saveStatus = ref('success');
const lastUpdatedAt = ref(null);
const lastSavedAt = ref(null);
const realtimeChannel = ref(null);

const shiftList = [
    { value: 'morning', label: '早班' },
    { value: 'night', label: '晚班' },
];

const memberList = ref([]);

const formData = ref({
    recordId: '',
    date: new Date(),
    shift: '',
    cats: [],
    note: '',
    member: '',
    remark: '',
});

// Computed
const prevDateShift = computed(() => {
    let date = formData.value.date ? $dayjs(formData.value.date) : $dayjs();
    if (formData.value.shift === 'morning') {
        date = date.subtract(1, 'day');
    }
    const shift = formData.value.shift === 'morning' ? 'night' : 'morning';
    return { date: date.toDate(), shift };
});

const prevLink = computed(() => ({
    name: 'medicine',
    query: {
        date: $dayjs(prevDateShift.value.date).format('YYYY-MM-DD'),
        shift: prevDateShift.value.shift,
    },
}));

const isDisabled = computed(() => {
    const { date } = formData.value;
    const day = $dayjs(date);
    const disabled = $dayjs().subtract(config.public.disabledDays || 2, 'day');
    return day < disabled;
});

// Date picker disabled date
const disabledDate = (time) => {
    const dateFrom = new Date(config.public.releaseDate || '2024-01-01');
    dateFrom.setDate(dateFrom.getDate() - 1);
    return time.getTime() > Date.now() || time.getTime() < dateFrom;
};

// Disable night shift if today and before 18:00
function disableShift(fromShift) {
    const { date } = formData.value;
    return (
        date &&
        date.getDate() === new Date().getDate() &&
        new Date().getHours() < 18 &&
        fromShift === 'night'
    );
}

// Methods
const autoSave = debounce(UpdateMedicine, 800);

function onAutoSave() {
    if (formData.value.recordId) {
        autoSave();
    }
}

function selectMe() {
    if (nickname.value) {
        formData.value.member = nickname.value;
        onAutoSave();
    }
}

function dateHandler() {
    const { date, shift } = formData.value;
    if (
        date.getDate() === new Date().getDate() &&
        new Date().getHours() < 18 &&
        shift === 'night'
    ) {
        ElMessage.error('錯誤，請重新選擇日期');
        return;
    }
    router.push({
        name: 'medicine',
        query: {
            date: $dayjs(date).format('YYYY-MM-DD'),
            shift,
        },
    });
}

function InitDateAndShift() {
    const { date, shift } = route.query;

    formData.value.date = date ? new Date(date) : new Date();
    formData.value.shift = shift
        ? shift === 'morning'
            ? 'morning'
            : 'night'
        : new Date().getHours() < 18
        ? 'morning'
        : 'night';
}

async function InitMemberList() {
    try {
        const data = await $fetch('/api/volunteer/list');
        memberList.value = data.map((v) => ({
            label: v.name,
            value: v.name,
        }));
    } catch (e) {
        console.error('InitMemberList error:', e);
    }
}

async function InitMedicine() {
    try {
        const { date, shift } = formData.value;
        const data = await $fetch('/api/medicine', {
            params: {
                date: $dayjs(date).format('YYYY-MM-DD'),
                shift,
            },
        });

        formData.value.recordId = data.recordId;
        formData.value.date = new Date(data.date);
        formData.value.shift = data.shift;
        formData.value.cats = data.cats;
        formData.value.note = data.note;
        formData.value.member = data.member;

        subscribeToRealtime(data.recordId);
    } catch (e) {
        console.error('InitMedicine error:', e);
        throw e;
    }
}

async function InitPrevMedicine() {
    try {
        const { date, shift } = prevDateShift.value;
        const data = await $fetch('/api/medicine', {
            params: {
                date: $dayjs(date).format('YYYY-MM-DD'),
                shift,
            },
        });
        formData.value.remark = data.note;
    } catch (e) {
        console.error('InitPrevMedicine error:', e);
    }
}

async function UpdateMedicine() {
    try {
        saveStatus.value = 'saving';
        const { recordId, date, shift, cats, note, member } = formData.value;

        await $fetch('/api/medicine/update', {
            method: 'POST',
            body: {
                recordId,
                date: $dayjs(date).format('YYYY-MM-DD'),
                shift,
                cats,
                note,
                member,
            },
        });

        saveStatus.value = 'success';
        lastSavedAt.value = new Date();
    } catch (e) {
        console.error('UpdateMedicine error:', e);
        saveStatus.value = 'error';
    }
}

function subscribeToRealtime(recordId) {
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }

    console.log('訂閱 medicine recordId:', recordId);

    realtimeChannel.value = supabase
        .channel(`medicine-${recordId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'medicines',
                filter: `id=eq.${recordId}`,
            },
            (payload) => {
                console.log('Medicine Realtime update:', payload);
                if (payload.new) {
                    const newCats =
                        typeof payload.new.cats === 'string'
                            ? JSON.parse(payload.new.cats)
                            : payload.new.cats;

                    formData.value.cats = newCats;
                    formData.value.note = payload.new.note;
                    formData.value.member = payload.new.member;
                    lastUpdatedAt.value = new Date();
                }
            }
        )
        .subscribe((status, err) => {
            console.log('Medicine Realtime status:', status);
            if (err) {
                console.error('Medicine Realtime error:', err);
            }
        });
}

async function Submit() {
    if (!formData.value.member) {
        ElMessage.error('請選擇填表志工');
        return;
    }
    await UpdateMedicine();
}

async function ManualNotifyLine() {
    const ShiftMap = { morning: '早班', night: '晚班' };

    try {
        loadingNotify.value = true;
        const textDate = $dayjs(formData.value.date).format('YYYY/MM/DD');
        const textShift = ShiftMap[formData.value.shift];
        const textPush = `餵藥及特殊飲食紀錄\n---------------\n日期： ${textDate}\n班別： ${textShift}\n志工： ${
            formData.value.member || ''
        }\n回報：\n${formData.value.note || ''}`;
        const textSite =
            config.public.deploySite === 'feliformia'
                ? ''
                : `[${config.public.deploySite || 'Local'}]\n`;
        const textManual = '[大哥通知]\n';

        const htmlPush = `<div style="text-align: left;"><b><h3>將以下訊息通知大哥</h3></b>餵藥及特殊飲食紀錄<br>---------------<br>日期： ${textDate}<br>班別： ${textShift}<br>志工： ${
            formData.value.member || ''
        }<br>回報：<br>${formData.value.note || ''}</div>`;

        const { isConfirmed } = await Swal.fire({
            html: htmlPush,
            showCancelButton: true,
            cancelButtonText: '取消',
            confirmButtonColor: '#b33a39',
            confirmButtonText: '是的',
        });

        if (isConfirmed) {
            try {
                await $fetch('/api/line/message/push', {
                    method: 'POST',
                    body: { text: textSite + textManual + textPush },
                });
                Swal.fire({
                    text: '手動發送成功',
                    confirmButtonColor: '#b33a39',
                });
            } catch {
                Swal.fire({
                    html: '手動發送失敗。<br>請確認網路狀態後重試。',
                    confirmButtonColor: '#b33a39',
                });
            }
        }
    } finally {
        loadingNotify.value = false;
    }
}

// Lifecycle
onMounted(async () => {
    try {
        InitDateAndShift();
        await Promise.all([InitMemberList(), InitMedicine()]);
        await InitPrevMedicine();
    } catch (error) {
        Swal.fire({
            html: `網路連線異常<br>請確認連線後重試。<br><br>錯誤：${error.message}`,
            confirmButtonColor: '#b33a39',
        });
    } finally {
        loading.value = false;
    }
});

// 監聽 route 變化，重新載入資料
watch(
    () => route.query,
    async (newQuery, oldQuery) => {
        if (
            newQuery.date !== oldQuery?.date ||
            newQuery.shift !== oldQuery?.shift
        ) {
            loading.value = true;
            try {
                InitDateAndShift();
                await InitMedicine();
                await InitPrevMedicine();
            } catch (error) {
                console.error('Reload error:', error);
            } finally {
                loading.value = false;
            }
        }
    }
);

onUnmounted(() => {
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }
});
</script>

<style lang="scss" scoped>
#medicine {
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
        }
    }

    .line-green {
        background-color: #03c100;
        color: white;
    }
}

.record_item {
    padding-right: 10px;

    .detail {
        > .d_flex {
            align-items: baseline;

            > div {
                .treatment {
                    vertical-align: text-top;

                    > .d_flex {
                        flex-direction: column;
                    }
                }

                .done {
                    width: 40px;
                }

                .txt {
                    text-align: left;
                    width: calc(100% - 60px);

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
</style>
