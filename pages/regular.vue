<template>
    <ClientOnly>
        <div v-loading="loading" id="regular">
            <h1>飲食及如廁紀錄表</h1>
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
                            />
                        </el-select>
                    </div>
                </div>

                <div class="W100">
                    <div
                        class="d_flex record_item"
                        v-for="(cat, index) in formData.cats"
                        :key="`${cat.name}${index}`"
                    >
                        <img
                            v-if="cat.cat?.reminder"
                            class="warning"
                            src="~/assets/img/ic-warning.svg"
                            alt=""
                        />
                        <a
                            class="name"
                            target="_blank"
                            :href="'/weekly?cat=' + cat.cat?.recordId"
                            >{{ cat.name }}</a
                        >

                        <div class="detail">
                            <!-- 食物 - 乾 -->
                            <div class="feed food d_flex">
                                <p class="f_blue">食物</p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.feed"
                                        :disabled="isDisabled"
                                        @change="
                                            () => {
                                                foodHandler('feed', index);
                                                onAutoSave();
                                            }
                                        "
                                        >乾</el-checkbox
                                    >
                                    <el-slider
                                        v-model="cat.feed_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.feed"
                                        @change="onAutoSave"
                                    />
                                </div>
                            </div>

                            <!-- 食物 - 罐 -->
                            <div class="can food d_flex">
                                <p class="f_blue"></p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.can"
                                        :disabled="isDisabled"
                                        @change="
                                            () => {
                                                foodHandler('can', index);
                                                onAutoSave();
                                            }
                                        "
                                        >罐</el-checkbox
                                    >
                                    <el-slider
                                        v-model="cat.can_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.can"
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
                                            v-model="cat.urine"
                                            :disabled="isDisabled"
                                            @change="onAutoSave"
                                            >尿</el-checkbox
                                        >
                                        <el-checkbox
                                            v-model="cat.feces"
                                            :disabled="isDisabled"
                                            @change="
                                                () => {
                                                    fecesHandler(
                                                        cat.feces,
                                                        index
                                                    );
                                                    onAutoSave();
                                                }
                                            "
                                            >便</el-checkbox
                                        >
                                    </div>
                                    <div class="W60 d_flex">
                                        <el-radio-group
                                            v-model="cat.feces_warning"
                                            :disabled="isDisabled || !cat.feces"
                                            @change="onAutoSave"
                                        >
                                            <el-radio label="正常"
                                                >正常</el-radio
                                            >
                                            <el-radio label="軟便"
                                                >軟便</el-radio
                                            >
                                            <el-radio label="拉稀"
                                                >拉稀</el-radio
                                            >
                                        </el-radio-group>
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
                <div class="W100">
                    <el-select
                        v-model="formData.member"
                        filterable
                        :disabled="isDisabled"
                        placeholder="請選擇填表志工"
                        class="mb20 W100"
                        @change="onAutoSave"
                    >
                        <el-option
                            v-for="member in memberList"
                            :key="member.value"
                            :label="member.label"
                            :value="member.value"
                        />
                    </el-select>
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
                    <NuxtLink class="f_red" to="/regular" target="_blank"
                        >回到今天</NuxtLink
                    >
                    <NuxtLink class="f_red" to="/medicine" target="_blank"
                        >前往餵藥及特殊飲食須知</NuxtLink
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
    title: '飲食及如廁紀錄表',
});

const { $dayjs } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const supabase = useSupabaseClient();

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
    name: 'regular',
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

// Methods
const autoSave = debounce(UpdateRegular, 1000);

function onAutoSave() {
    if (formData.value.recordId) {
        autoSave();
    }
}

function fecesHandler(e, index) {
    formData.value.cats[index].feces_warning = e ? '正常' : null;
}

function foodHandler(type, index) {
    if (type === 'can') {
        formData.value.cats[index].can_detail = 0;
    } else {
        formData.value.cats[index].feed_detail = 0;
    }
}

function dateHandler() {
    const { date, shift } = formData.value;
    router.push({
        name: 'regular',
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

async function InitRegular() {
    try {
        const { date, shift } = formData.value;
        const data = await $fetch('/api/regular', {
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
        console.error('InitRegular error:', e);
        throw e;
    }
}

async function InitPrevRegular() {
    try {
        const { date, shift } = prevDateShift.value;
        const data = await $fetch('/api/regular', {
            params: {
                date: $dayjs(date).format('YYYY-MM-DD'),
                shift,
            },
        });
        formData.value.remark = data.note;
    } catch (e) {
        console.error('InitPrevRegular error:', e);
    }
}

async function UpdateRegular() {
    try {
        saveStatus.value = 'saving';
        const { recordId, date, shift, cats, note, member } = formData.value;

        await $fetch('/api/regular/update', {
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
        console.error('UpdateRegular error:', e);
        saveStatus.value = 'error';
    }
}

function subscribeToRealtime(recordId) {
    // 先移除舊的 channel
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }

    realtimeChannel.value = supabase
        .channel(`regular-${recordId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'regulars',
                filter: `id=eq.${recordId}`,
            },
            (payload) => {
                if (payload.new) {
                    const newData = {
                        recordId: payload.new.id,
                        date: new Date(payload.new.date),
                        shift: payload.new.shift,
                        cats:
                            typeof payload.new.cats === 'string'
                                ? JSON.parse(payload.new.cats)
                                : payload.new.cats,
                        note: payload.new.note,
                        member: payload.new.member,
                    };

                    const oldData = {
                        recordId: formData.value.recordId,
                        date: formData.value.date,
                        shift: formData.value.shift,
                        cats: formData.value.cats,
                        note: formData.value.note,
                        member: formData.value.member,
                    };

                    if (!isEqual(oldData, newData)) {
                        formData.value.recordId = newData.recordId;
                        formData.value.date = newData.date;
                        formData.value.shift = newData.shift;
                        formData.value.cats = newData.cats;
                        formData.value.note = newData.note;
                        formData.value.member = newData.member;
                        lastUpdatedAt.value = new Date();
                    }
                }
            }
        )
        .subscribe((status) => {
            //   console.log('Realtime status:', status)  // 加 log 檢查
        });
}

async function Submit() {
    if (!formData.value.member) {
        ElMessage.error('請選擇填表志工');
        return;
    }
    await UpdateRegular();
}

async function ManualNotifyLine() {
    const ShiftMap = { morning: '早班', night: '晚班' };

    try {
        loadingNotify.value = true;
        const textDate = $dayjs(formData.value.date).format('YYYY/MM/DD');
        const textShift = ShiftMap[formData.value.shift];
        const textPush = `飲食及如廁紀錄\n---------------\n日期： ${textDate}\n班別： ${textShift}\n志工： ${
            formData.value.member || ''
        }\n回報：\n${formData.value.note || ''}`;
        const textSite =
            config.public.deploySite === 'feliformia'
                ? ''
                : `[${config.public.deploySite || 'Local'}]\n`;
        const textManual = '[大哥通知]\n';

        const htmlPush = `<div style="text-align: left;"><b><h3>將以下訊息通知大哥</h3></b>飲食及如廁紀錄<br>---------------<br>日期： ${textDate}<br>班別： ${textShift}<br>志工： ${
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
        await Promise.all([InitMemberList(), InitRegular()]);
        await InitPrevRegular();
    } catch (error) {
        Swal.fire({
            html: `網路連線異常<br>請確認連線後重試。<br><br>錯誤：${error.message}`,
            confirmButtonColor: '#b33a39',
        });
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => {
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }
});
</script>

<style lang="scss" scoped>
#regular {
    a {
        display: block;
    }

    .last-update,
    .last-saved {
        margin: 0 0 5px 0;
        color: #ccc;
        font-size: 11px;
    }

    .line-green {
        background-color: #03c100;
        color: white;
    }

    .detail {
        .food {
            .el-slider {
                width: calc(100% - 60px);
                transform: translate(0, -6px);
            }
            .el-checkbox {
                width: 40px;
            }
        }
    }

    .excretion {
        > .d_flex {
            justify-content: start;
        }
        .W40 {
            justify-content: start;
            padding-top: 10px;
            width: 80px;
        }
        .W60 {
            padding-top: 10px;
            width: calc(100% - 80px);
            .el-radio-group {
                justify-content: start;
                width: 100%;
                > label {
                    width: 45px;
                }
            }
        }
    }
}
</style>
