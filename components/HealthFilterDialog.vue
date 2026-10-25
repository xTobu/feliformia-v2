<template>
    <!-- 醫療紀錄的搜尋與篩選視窗（貓咪檔案的小檔案）：關鍵字、時間、類型、項目、陪同者。
         視窗裡改的是草稿，按「看 N 筆結果」才套用；直接關掉就不改 -->
    <div class="health-filter-dialog">
        <el-dialog
            :model-value="modelValue"
            title="搜尋醫療紀錄"
            width="90%"
            class="health-filter"
            align-center
            @update:model-value="emit('update:modelValue', $event)"
            @open="draft = copyOf(filter)"
        >
            <div class="hf-label">關鍵字</div>
            <el-input
                v-model="draft.keyword"
                placeholder="描述、項目、陪同者"
                clearable
                @keydown.enter="(e) => !isImeEnter(e) && apply()"
            >
                <template #prefix><Icon icon="mdi:magnify" width="16" /></template>
            </el-input>

            <!-- 時間：快速選項（再點一次取消），或自己選開始、結束（只填一邊也可以） -->
            <div class="hf-label">時間</div>
            <div class="chips">
                <button
                    v-for="r in ranges"
                    :key="r.key"
                    type="button"
                    class="chip"
                    :class="{ on: draft.from === r.from && draft.to === r.to }"
                    @click="pickRange(r)"
                >
                    {{ r.label }}
                </button>
            </div>
            <div class="hf-dates">
                <el-date-picker
                    v-model="draft.from"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="開始"
                    :editable="false"
                />
                <span class="hf-dash">~</span>
                <el-date-picker
                    v-model="draft.to"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="結束"
                    :editable="false"
                />
            </div>

            <div class="hf-label">類型</div>
            <div class="chips">
                <button
                    v-for="t in HEALTH_TYPES"
                    :key="t.key"
                    type="button"
                    class="chip"
                    :class="{ on: draft.kinds.includes(t.key) }"
                    @click="toggle('kinds', t.key)"
                >
                    {{ t.label }}
                </button>
            </div>

            <!-- 項目、陪同者：只列這隻貓的紀錄裡出現過的 -->
            <template v-if="itemChoices.length">
                <div class="hf-label">項目</div>
                <div class="chips">
                    <button
                        v-for="item in itemChoices"
                        :key="item"
                        type="button"
                        class="chip"
                        :class="{ on: draft.items.includes(item) }"
                        @click="toggle('items', item)"
                    >
                        {{ item }}
                    </button>
                </div>
            </template>
            <template v-if="companionChoices.length">
                <div class="hf-label">陪同者</div>
                <div class="chips">
                    <button
                        v-for="name in companionChoices"
                        :key="name"
                        type="button"
                        class="chip"
                        :class="{ on: draft.companions.includes(name) }"
                        @click="toggle('companions', name)"
                    >
                        {{ name }}
                    </button>
                </div>
            </template>

            <template #footer>
                <el-button @click="draft = emptyHealthFilter()">清除</el-button>
                <el-button type="primary" @click="apply">
                    {{ count ? `看 ${count} 筆結果` : '沒有符合的紀錄' }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
// v-model：開關。records：這隻貓全部的醫療紀錄（選項從這裡來、即時算筆數）。filter：目前套用的條件
// apply(filter)：按「看 N 筆結果」，新的條件
import { Icon } from '@iconify/vue';
import {
    HEALTH_TYPES,
    emptyHealthFilter,
    healthDateRanges,
    matchHealthFilter,
    sortHealthItems,
} from '~/composables/healthKinds';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    records: { type: Array, default: () => [] },
    filter: { type: Object, required: true },
});
const emit = defineEmits(['update:modelValue', 'apply']);

const { $dayjs } = useNuxtApp();
const ranges = computed(() => healthDateRanges($dayjs));

const copyOf = (f) => ({ ...f, kinds: [...f.kinds], items: [...f.items], companions: [...f.companions] });
const draft = ref(copyOf(props.filter));

// 項目照預設清單順序、自己加的接後面；陪同者照出現次數多的在前
const itemChoices = computed(() => sortHealthItems(props.records.flatMap((r) => r.items)));
const companionChoices = computed(() => {
    const counts = new Map();
    for (const name of props.records.flatMap((r) => r.companions || [])) counts.set(name, (counts.get(name) || 0) + 1);
    return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
});

const count = computed(() => props.records.filter((r) => matchHealthFilter(r, draft.value)).length);

function toggle(group, value) {
    const list = draft.value[group];
    draft.value[group] = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function pickRange(range) {
    const on = draft.value.from === range.from && draft.value.to === range.to;
    draft.value.from = on ? null : range.from;
    draft.value.to = on ? null : range.to;
}

function apply() {
    emit('apply', { ...copyOf(draft.value), keyword: draft.value.keyword.trim() });
    emit('update:modelValue', false);
}
</script>

<style lang="scss" scoped>
.health-filter-dialog {
    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }
}

.hf-label {
    margin: 14px 0 6px;
    color: #767676;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;

    &:first-child {
        margin-top: 0;
    }
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .chip {
        width: auto;
        height: 30px;
        margin: 0;
        padding: 0 14px;
        border: 1px solid #d8d4d1;
        border-radius: 15px;
        background: #fff;
        color: #657181;
        font-size: 14px;
        line-height: 28px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }
    }
}

.hf-dates {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
}

.hf-dash {
    color: #a8a29e;
}

:deep(.health-filter) {
    max-width: 420px;

    .el-dialog__body {
        max-height: 65vh;
        overflow-y: auto;
        padding-right: 8px;
    }

    .el-date-editor {
        flex: 1;
        width: auto;
        min-width: 0;
    }

    .el-input__wrapper {
        height: 40px;
        min-height: 40px;
        box-sizing: border-box;
    }

    .el-input {
        height: 40px;
    }

    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        .el-button {
            flex: 1;
        }
    }
}
</style>
