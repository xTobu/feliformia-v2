<template>
    <!-- 留言頻道與照片庫標題列上的「留言／照片」切換：兩邊是不同的面板（留言頻道、🗂️ 照片庫），
         點另一邊就由呼叫的頁面關掉這個、打開那個 -->
    <div class="ch-switch" role="tablist">
        <button
            v-for="option in OPTIONS"
            :key="option.value"
            type="button"
            role="tab"
            :aria-selected="current === option.value"
            :class="{ on: current === option.value }"
            :disabled="disabled"
            @click="current !== option.value && emit('switch', option.value)"
        >
            {{ option.label }}
        </button>
    </div>
</template>

<script setup>
defineProps({
    // messages / photos：現在在哪一邊
    current: { type: String, required: true },
    // 暫時不能切（照片庫選取中、預覽要上傳的照片時）：膠囊留著，只是按不了
    disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['switch']);

const OPTIONS = [
    { value: 'messages', label: '留言' },
    { value: 'photos', label: '照片' },
];
</script>

<style lang="scss" scoped>
// 位置由呼叫的標題列安排（前面的按鈕用 margin-left: auto 推到右邊）
.ch-switch {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    padding: 2px;
    border-radius: 14px;
    background: #f2f0ee;

    // 全域 button 有 width: 100%，這裡蓋回來
    button {
        width: auto;
        height: auto;
        margin: 0;
        padding: 2px 10px;
        border: none;
        border-radius: 12px;
        background: none;
        color: #657181;
        font-size: 12px;
        line-height: 20px;
        cursor: pointer;

        &.on {
            background: #6da2c2;
            color: #fff;
        }

        &:disabled {
            cursor: default;
            opacity: 0.45;
        }
    }
}
</style>
