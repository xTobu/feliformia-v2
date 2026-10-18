<template>
    <!-- 值班記錄表的回報區塊：前一班同分頁的回報、這一班其他人的回報。依人分組，一人一張灰底卡片。
         沒有內容就整塊不顯示；預設展開，收起後這台裝置會記住（每個 storageKey 各自記） -->
    <div v-if="entries.length || unfinished.length" class="report-block">
        <button
            type="button"
            class="rb-head"
            :aria-expanded="open"
            @click="toggle"
        >
            <span class="rb-title">{{ title }}</span>
            <span class="rb-meta">{{ metaText }}</span>
            <span class="rb-chev" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
        </button>
        <div v-show="open" class="rb-body">
            <div v-for="entry in entries" :key="entry.key" class="rb-card">
                <div class="rb-name">
                    <span class="rb-who">{{ entry.name || '（舊資料）' }}</span>
                    <span v-if="entry.at" class="rb-time">{{ formatTime(entry.at) }}</span>
                </div>
                <!-- 回報是 textarea 寫的：保留換行，長的也完整顯示（太長就收起整塊） -->
                <div class="rb-text">{{ entry.text }}</div>
            </div>
            <div v-if="unfinished.length" class="rb-unfinished">
                <b>收尾未完成：</b>{{ unfinished.join('、') }}
            </div>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    title: { type: String, required: true },
    // 標題列後面的小字，例如「10/18 晚班」；會自動接上人數與未完成數
    meta: { type: String, default: '' },
    // [{ key, name, text, at }]，只放有內容的
    entries: { type: Array, default: () => [] },
    // 收尾分頁才有：上一班沒勾完的項目
    unfinished: { type: Array, default: () => [] },
    // 收起狀態存在這台裝置的 key；沒給就不記
    storageKey: { type: String, default: '' },
});

const { $dayjs } = useNuxtApp();
const storage = useLocalStorage();
const storeKey = computed(() => props.storageKey && `shift-report-collapsed:${props.storageKey}`);

const open = ref(!(storeKey.value && storage.get(storeKey.value, false)));
watch(storeKey, (key) => {
    open.value = !(key && storage.get(key, false));
});

function toggle() {
    open.value = !open.value;
    if (storeKey.value) storage.set(storeKey.value, !open.value);
}

const metaText = computed(() =>
    [
        props.meta,
        props.entries.length ? `${props.entries.length} 人` : '',
        props.unfinished.length ? `${props.unfinished.length} 項未完成` : '',
    ]
        .filter(Boolean)
        .join(' · ')
);

function formatTime(iso) {
    return $dayjs(iso).format('HH:mm');
}
</script>

<style lang="scss" scoped>
.report-block {
    margin-bottom: 14px;
    border: 1px solid #d8d4d1;
    border-radius: 6px;
    background: #fff;
    text-align: left;
}

// 全域 button 有 width: 100%、邊框、底色、padding，這裡每一項都要蓋回來
.rb-head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: auto;
    margin: 0;
    padding: 9px 10px;
    border: none;
    background: none;
    color: #657181;
    font-size: 13px;
    text-align: left;
    cursor: pointer;

    .rb-title {
        flex-shrink: 0;
        font-size: 14px;
        font-weight: 500;
        color: #4a4542;
    }

    .rb-meta {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        color: #8e8783;
    }

    .rb-chev {
        margin-left: auto;
        color: #8e8783;
        font-size: 14px;
    }
}

.rb-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px 10px;
    border-top: 1px solid #eee;
}

.rb-card {
    padding: 8px 10px;
    border-radius: 6px;
    background: #f4f5f5;
}

.rb-name {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 2px;

    .rb-who {
        font-size: 13px;
        font-weight: 500;
        color: #6da2c2;
    }

    .rb-time {
        font-size: 12px;
        color: #8e8783;
    }
}

.rb-text {
    font-size: 14px;
    line-height: 1.55;
    color: #222;
    white-space: pre-line;
    overflow-wrap: anywhere;
}

.rb-unfinished {
    padding-top: 8px;
    border-top: 1px dashed #ccc;
    font-size: 14px;
    color: #4a4542;

    b {
        font-weight: 500;
        color: #b33a39;
    }
}
</style>
