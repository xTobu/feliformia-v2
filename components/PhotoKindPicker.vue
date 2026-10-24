<template>
    <!-- 照片類型膠囊（可多選，點一下選、再點一下取消）。分頁的類型分小組時（composables/photoKinds.js），
         組與組之間一條直線；擇一的那組（觀察的剩食、貓砂）點另一個就換過去。放在 flex 換行的容器裡（.pp-kinds、.pd-filter）。
         allLabel 有給就在最前面多一顆「全部」（篩選用：什麼都沒選＝全部，篩選不受擇一限制），後面也一條直線 -->
    <button
        v-if="allLabel"
        type="button"
        class="kind-chip"
        :class="{ on: !modelValue.length }"
        :aria-pressed="!modelValue.length"
        :disabled="disabled"
        @click="emit('update:modelValue', [])"
    >
        {{ allLabel }}
    </button>
    <!-- 「全部」跟類型之間也隔一條線 -->
    <span v-if="allLabel && groups.length" class="kind-sep" aria-hidden="true"></span>
    <template v-for="(group, index) in groups" :key="index">
        <span v-if="index > 0" class="kind-sep" aria-hidden="true"></span>
        <button
            v-for="kind in group.kinds"
            :key="kind"
            type="button"
            class="kind-chip"
            :class="{ on: modelValue.includes(kind), observe: group.observe }"
            :aria-pressed="modelValue.includes(kind)"
            :disabled="disabled"
            @click="toggle(kind, group)"
        >
            {{ kind }}
        </button>
    </template>
</template>

<script setup>
const props = defineProps({
    // arrive / care / meal：用哪一組類型
    tab: { type: String, default: '' },
    modelValue: { type: Array, default: () => [] },
    allLabel: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const groups = computed(() => PHOTO_KIND_GROUPS[props.tab] || []);

function toggle(kind, group) {
    const list = props.modelValue;
    if (list.includes(kind)) {
        emit('update:modelValue', list.filter((k) => k !== kind));
        return;
    }
    // 擇一的那組：選了這個就拿掉同組的另一個（篩選不受限制）
    const others = group.single && !props.allLabel ? group.kinds : [];
    emit('update:modelValue', [...list.filter((k) => !others.includes(k)), kind]);
}
</script>

<style lang="scss" scoped>
// 手機寬度一排放得下六個；全域 button 有 width: 100%，這裡蓋回來
.kind-chip {
    flex-shrink: 0;
    width: auto;
    height: 28px;
    margin: 0;
    padding: 0 9px;
    border: 1px solid #d8d4d1;
    border-radius: 14px;
    background: #fff;
    color: #657181;
    font-size: 13px;
    cursor: pointer;

    &.on {
        border-color: #6da2c2;
        background: #6da2c2;
        color: #fff;
    }

    // 剛到要拍的那組（剩食、貓砂）選到時是暖橘
    &.observe.on {
        border-color: #e08a3c;
        background: #e08a3c;
    }

    &:disabled {
        cursor: default;
        opacity: 0.6;
    }
}

// 小組之間的直線
.kind-sep {
    flex-shrink: 0;
    align-self: center;
    width: 1px;
    height: 18px;
    margin: 0 3px;
    background: #d8d4d1;
}
</style>
