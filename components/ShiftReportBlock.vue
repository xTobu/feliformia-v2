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
            <span v-if="meta" class="rb-meta">{{ meta }}</span>
            <!-- 人數與未完成數收在一個小標籤裡，跟日期班別分開 -->
            <span v-if="countText" class="rb-badge">{{
                countText
            }}</span>
            <span class="rb-chev" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
        </button>
        <div v-show="open" class="rb-body">
            <div v-if="entriesLabel && entries.length" class="rb-section">{{ entriesLabel }}</div>
            <div v-for="entry in entries" :key="entry.key" class="rb-card">
                <div class="rb-name">
                    <span class="rb-who">{{ entry.name || '（舊資料）' }}</span>
                    <span v-if="entry.at" class="rb-time">{{ formatTime(entry.at) }}</span>
                </div>
                <!-- 回報是 textarea 寫的：保留換行，長的也完整顯示（太長就收起整塊） -->
                <div class="rb-text">{{ entry.text }}</div>
            </div>
            <!-- 上一班沒勾完的：一項一行，對象用小標籤。上面有回報時才加分隔線 -->
            <div
                v-if="unfinished.length"
                class="rb-unfinished"
                :class="{ 'after-entries': entries.length }"
            >
                <div class="rb-unfinished-title">未完成 {{ unfinished.length }} 項</div>
                <div v-for="item in unfinished" :key="item.key" class="rb-unfinished-row">
                    <span v-if="item.target" class="rb-target">{{ item.target }}</span>
                    <span class="rb-content">{{ item.content }}</span>
                    <span v-if="item.tag" class="rb-tag">{{ item.tag }}</span>
                </div>
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
    // 上一班這個分頁沒勾完的項目 [{ key, target, content, tag }]（tag：醫療分頁的類別）
    unfinished: { type: Array, default: () => [] },
    // 回報卡片上方的小標題（前班區塊用「前班○○回報」）；空字串就不顯示
    entriesLabel: { type: String, default: '' },
    // 標題列人數後面的字：「2 人」或「2 人回報」
    countLabel: { type: String, default: '人' },
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

const countText = computed(() =>
    [
        props.entries.length ? `${props.entries.length} ${props.countLabel}` : '',
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
    padding: 11px 12px;
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

    // 人數・未完成數的小標籤
    .rb-badge {
        flex-shrink: 0;
        padding: 0 7px;
        border-radius: 10px;
        background: #f0eeec;
        color: #767676;
        font-size: 12px;
        line-height: 20px;
        white-space: nowrap;
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
    gap: 10px;
    padding: 14px 12px;
    border-top: 1px solid #eee;
}

// 區塊裡的小標題：前班回報、未完成 N 項。字後面拉一條細線分段；
// 用小一點的灰字，不搶回報內容與未完成項目
.rb-section,
.rb-unfinished-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #8e8783;

    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #d8d4d1;
    }
}

.rb-unfinished-title {
    margin-bottom: 2px;
}

.rb-card {
    padding: 10px 12px;
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
    // 接在回報後面時多留一點空，靠標題分段，不再用虛線
    &.after-entries {
        margin-top: 12px;
    }


    .rb-unfinished-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 0;
        font-size: 14px;
        line-height: 1.4;
        color: #222;

        & + .rb-unfinished-row {
            border-top: 1px solid #eee;
        }
    }

    // 對象標籤：跟備餐分頁「全員」那種來源標籤同一個樣子
    .rb-target {
        flex-shrink: 0;
        min-width: 34px;
        padding: 0 6px;
        border-radius: 3px;
        background: #f0eeec;
        color: #767676;
        font-size: 12px;
        line-height: 20px;
        text-align: center;
    }

    .rb-content {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    // 類別（醫療、餵藥、外用）：靠右的小灰字
    .rb-tag {
        flex-shrink: 0;
        font-size: 12px;
        color: #8e8783;
    }
}
</style>
