<template>
    <!-- 套用中的貓咪搜尋條件：一個一個可以拿掉；下面寫找到幾隻、清除。沒有條件就不顯示 -->
    <template v-if="tags.length">
        <div class="filter-tags">
            <button v-for="t in tags" :key="t.key" type="button" class="filter-tag" @click="t.remove()">
                {{ t.label }}<Icon icon="mdi:close" width="13" />
            </button>
        </div>
        <div class="filter-found">
            <span>找到 {{ count }} 隻{{ hint }}</span>
            <button type="button" @click="emit('update:filter', emptyCatFilter())">清除</button>
        </div>
    </template>
</template>

<script setup>
// v-model:filter：套用中的條件。count：符合的有幾隻。hint：接在「找到 N 隻」後面的說明
import { Icon } from '@iconify/vue';
import { CAT_STATUS_OPTIONS, emptyCatFilter } from '~/composables/catSearch';

const props = defineProps({
    filter: { type: Object, required: true },
    count: { type: Number, default: 0 },
    hint: { type: String, default: '' },
});
const emit = defineEmits(['update:filter']);

const tags = computed(() => {
    const f = props.filter;
    const set = (patch) => emit('update:filter', { ...f, ...patch });
    const list = [];
    if (f.keyword.trim()) list.push({ key: 'keyword', label: `「${f.keyword.trim()}」`, remove: () => set({ keyword: '' }) });
    if (f.status !== 'all') {
        const label = CAT_STATUS_OPTIONS.find((o) => o.key === f.status)?.label;
        list.push({ key: 'status', label, remove: () => set({ status: 'all' }) });
    }
    return list;
});
</script>

<style lang="scss" scoped>
.filter-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.filter-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    width: auto;
    height: 26px;
    margin: 0;
    padding: 0 6px 0 10px;
    border: 1px solid #c9dff0;
    border-radius: 13px;
    background: #eef6fc;
    color: #3f7ea3;
    font-size: 13px;
}

.filter-found {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    color: #8a7f78;
    font-size: 13px;

    button {
        width: auto;
        margin: 0;
        padding: 0;
        border: none;
        background: none;
        color: #3f7ea3;
        font-size: 13px;
    }
}
</style>
