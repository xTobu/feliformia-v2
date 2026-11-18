<template>
    <!-- 日期鈕：沒選是「全部日期」；選了顯示那一段（只選一頭就寫「10/18 起」「到 10/24」），旁邊 ✕ 清掉。
         點開有快選（全部、近 3／7／30 天）與自訂起訖。樣子跟貓咪檔案每日紀錄的日期鈕一樣。
         右邊的 slot 放同一列的其他按鈕（例如欄位選擇） -->
    <div class="drf">
        <div class="drf-row">
            <span class="drf-btn" :class="{ on: hasRange, open }">
                <button type="button" class="drf-main" @click="open = !open">
                    <Icon v-if="!hasRange" icon="mdi:calendar-blank-outline" width="14" />{{ rangeLabel }}
                </button>
                <button v-if="hasRange" type="button" class="drf-clear" aria-label="清除日期" @click="set(null, null)">
                    <Icon icon="mdi:close" width="13" />
                </button>
            </span>
            <slot />
        </div>
        <div v-if="open" class="drf-panel">
            <div class="drf-quick">
                <button
                    v-for="q in QUICK_RANGES"
                    :key="q.days"
                    type="button"
                    class="drf-kind"
                    :class="{ on: quickActive(q.days) }"
                    @click="set(q.days ? quickFrom(q.days) : null, null)"
                >
                    {{ q.label }}
                </button>
            </div>
            <div class="drf-range">
                <el-date-picker
                    :model-value="from"
                    type="date"
                    value-format="YYYY-MM-DD"
                    format="MM/DD"
                    placeholder="開始"
                    :editable="false"
                    :clearable="false"
                    :disabled-date="(d) => isFuture(d) || (to && dayOf(d) > to)"
                    @update:model-value="emit('update:from', $event)"
                />
                <span class="drf-sep">–</span>
                <el-date-picker
                    :model-value="to"
                    type="date"
                    value-format="YYYY-MM-DD"
                    format="MM/DD"
                    placeholder="結束"
                    :editable="false"
                    :clearable="false"
                    :disabled-date="(d) => isFuture(d) || (from && dayOf(d) < from)"
                    @update:model-value="emit('update:to', $event)"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
// v-model:from、v-model:to：'YYYY-MM-DD' 或 null（null＝不限）
import { Icon } from '@iconify/vue';

const props = defineProps({
    from: { type: String, default: null },
    to: { type: String, default: null },
});
const emit = defineEmits(['update:from', 'update:to']);

const { $dayjs } = useNuxtApp();

const QUICK_RANGES = [
    { days: 0, label: '全部' },
    { days: 3, label: '近 3 天' },
    { days: 7, label: '近 7 天' },
    { days: 30, label: '近 30 天' },
];

const open = ref(false);
const hasRange = computed(() => !!(props.from || props.to));
const dayOf = (d) => $dayjs(d).format('YYYY-MM-DD');
const isFuture = (d) => $dayjs(d).isAfter($dayjs(), 'day');
const shortDate = (date) => $dayjs(date).format('M/D');

const rangeLabel = computed(() => {
    const { from, to } = props;
    if (from && to) {
        if (from === to) return shortDate(from);
        // 同一個月只寫一次月份：10/18–24
        const sameMonth = from.slice(0, 7) === to.slice(0, 7);
        return `${shortDate(from)}–${sameMonth ? $dayjs(to).format('D') : shortDate(to)}`;
    }
    if (from) return `${shortDate(from)} 起`;
    if (to) return `到 ${shortDate(to)}`;
    return '全部日期';
});

// 近 N 天：含今天往前 N 天，結束不填（一直到今天）
const quickFrom = (days) => $dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD');
const quickActive = (days) => (days ? props.from === quickFrom(days) && !props.to : !hasRange.value);

function set(from, to) {
    emit('update:from', from);
    emit('update:to', to);
    open.value = false;
}
</script>

<style lang="scss" scoped>
.drf {
    margin-bottom: 8px;
}

.drf-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
}

.drf-btn {
    display: inline-flex;
    align-items: center;
    border: 1px solid #d8d4d1;
    border-radius: 999px;
    background: #fff;
    color: #4a4542;

    &.on,
    &.open {
        border-color: #657181;
    }

    &.on {
        background: #eef1f5;
    }

    // 全域 button 有 width: 100%、邊框、底色，這裡蓋回來
    button {
        display: inline-flex;
        align-items: center;
        width: auto;
        height: auto;
        margin: 0;
        border: none;
        background: none;
        color: inherit;
        font-size: 13px;
        cursor: pointer;
    }
}

.drf-main {
    gap: 4px;
    padding: 4px 9px;

    .on & {
        padding-right: 2px;
    }
}

.drf-clear {
    padding: 4px 8px 4px 4px;
    color: #8a7f78 !important;
}

.drf-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
    padding: 10px;
    border: 1px solid #ece8e5;
    border-radius: 10px;
    background: #fff;
}

.drf-quick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.drf-kind {
    display: inline-flex;
    align-items: center;
    width: auto;
    height: auto;
    margin: 0;
    padding: 4px 8px;
    border: 1px solid #d8d4d1;
    border-radius: 999px;
    background: #fff;
    color: #8a7f78;
    font-size: 13px;
    cursor: pointer;

    &.on {
        border-color: #657181;
        background: #657181;
        color: #fff;
    }
}

.drf-range {
    display: flex;
    align-items: center;
    gap: 6px;

    :deep(.el-date-editor) {
        width: 120px;
    }
}

.drf-sep {
    color: #a8a29e;
}
</style>
