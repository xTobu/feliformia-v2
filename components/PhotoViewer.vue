<template>
    <!-- 看大圖：照片置中，上方一列是班別與 ✕；多張時左右箭頭或左右滑換張。
         照片下面是資訊（哪一班、誰、幾點、類型、描述或留言內容），再下面放呼叫的頁面給的按鈕（#actions） -->
    <Teleport to="body">
        <div
            v-if="photo"
            class="pv"
            @click.self="emit('close')"
            @touchstart.passive="onTouchStart"
            @touchend="onTouchEnd"
        >
            <!-- 上方一列（跟下方資訊同寬，不跟著照片大小）：左邊是哪一班，右邊是 ✕ -->
            <div class="pv-top">
                <span v-if="photo.label" class="pv-shift">{{ photo.label }}</span>
                <button type="button" class="pv-close" aria-label="關閉" @click="emit('close')">✕</button>
            </div>

            <div class="pv-stage" @click.self="emit('close')">
                <button
                    v-if="photos.length > 1"
                    type="button"
                    class="pv-nav prev"
                    aria-label="上一張"
                    :disabled="index === 0"
                    @click="go(-1)"
                >
                    ‹
                </button>
                <div class="pv-frame">
                    <img :src="photo.url" alt="" class="pv-img" />
                </div>
                <button
                    v-if="photos.length > 1"
                    type="button"
                    class="pv-nav next"
                    aria-label="下一張"
                    :disabled="index === photos.length - 1"
                    @click="go(1)"
                >
                    ›
                </button>
            </div>

            <div class="pv-info">
                <!-- 資訊在左、第幾張在右 -->
                <div class="pv-meta">
                    <span>{{ photo.meta }}</span>
                    <span v-if="photos.length > 1" class="pv-count">{{ index + 1 }} / {{ photos.length }}</span>
                </div>
                <div v-if="photo.kinds?.length" class="pv-kinds">
                    <span v-for="kind in photo.kinds" :key="kind" :class="{ observe: isObserveKind(kind) }">{{ kind }}</span>
                </div>
                <!-- 描述（前面一條直線）或留言內容（對話氣泡），樣子就分得出是哪一種 -->
                <div
                    v-if="photo.text"
                    class="pv-text"
                    :class="photo.textKind === 'comment' ? 'is-comment' : 'is-note'"
                    :aria-label="photo.textKind === 'comment' ? '留言' : '描述'"
                >
                    <div class="pv-text-body">{{ photo.text }}</div>
                </div>
                <div class="pv-actions">
                    <slot name="actions" :photo="photo" :index="index" />
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup>
// photos：[{ url, label（哪一班，例如「10/21 晚班」，放上方左邊）, meta（一行小字：誰 幾點）, kinds?,
//           text?（描述或留言內容）, textKind?（'note' 描述／'comment' 留言，預設描述）, ...其他欄位隨意 }]
// v-model:index：目前看第幾張，null 就關閉
const props = defineProps({
    photos: { type: Array, default: () => [] },
    index: { type: Number, default: null },
});
const emit = defineEmits(['update:index', 'close']);

const photo = computed(() => (props.index == null ? null : props.photos[props.index] || null));

function go(step) {
    const next = props.index + step;
    if (next >= 0 && next < props.photos.length) emit('update:index', next);
}

// 左右滑換張（橫向移動超過 50px、而且比上下移動多）
let start = null;
function onTouchStart(event) {
    const t = event.touches[0];
    start = { x: t.clientX, y: t.clientY };
}
function onTouchEnd(event) {
    if (!start) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
}

// 鍵盤：← → 換張、Esc 關閉
function onKey(event) {
    if (!photo.value) return;
    if (event.key === 'Escape') emit('close');
    else if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'ArrowRight') go(1);
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style lang="scss" scoped>
// 全域 button 有 width: 100%、邊框、底色，這裡的按鈕都要蓋回來
button {
    width: auto;
    height: auto;
    margin: 0;
    cursor: pointer;
}

.pv {
    position: fixed;
    inset: 0;
    z-index: 4000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.94);
}

.pv-stage {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0 12px;
    box-sizing: border-box;
}

// 照片與 ✕ 包在一起，✕ 才會貼著照片的右上角
.pv-frame {
    position: relative;
    display: inline-block;
    max-width: 100%;
}

.pv-img {
    display: block;
    max-width: calc(100vw - 24px);
    max-height: 62vh;
    border-radius: 6px;
    object-fit: contain;
}

// 照片上方一列：寬度跟下方資訊一樣（不跟著照片），左邊班別、右邊 ✕
.pv-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 450px;
    margin-bottom: 10px;
    padding: 0 18px;
    box-sizing: border-box;
}

.pv-shift {
    padding: 0 12px;
    border-radius: 17px;
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    font-size: 14px;
    line-height: 34px;
    white-space: nowrap;
}

.pv-close {
    margin-left: auto;
    width: 34px;
    height: 34px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    font-size: 15px;
    line-height: 34px;
}

// 左右箭頭：疊在照片兩側
.pv-nav {
    position: absolute;
    top: 50%;
    z-index: 1;
    width: 40px;
    height: 40px;
    padding: 0 0 3px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 26px;
    line-height: 1;
    transform: translateY(-50%);

    &.prev {
        left: 18px;
    }

    &.next {
        right: 18px;
    }

    &:disabled {
        opacity: 0.25;
        cursor: default;
    }
}

.pv-info {
    width: 100%;
    max-width: 450px;
    padding: 14px 18px 20px;
    box-sizing: border-box;
    color: #fff;
    text-align: left;
}

.pv-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.72);

    .pv-count {
        flex-shrink: 0;
        padding: 0 6px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.15);
        font-variant-numeric: tabular-nums;
    }
}

.pv-kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;

    span {
        padding: 0 7px;
        border-radius: 4px;
        background: rgba(109, 162, 194, 0.35);
        color: #e6f0f6;
        font-size: 12px;
        line-height: 20px;

        // 剛到要拍的那組（剩食、貓砂）是暖橘
        &.observe {
            background: rgba(224, 138, 60, 0.45);
            color: #fdebd9;
        }
    }
}

.pv-text {
    margin-top: 8px;
    font-size: 15px;
    line-height: 1.5;

    // 太長就在裡面捲（捲動放在內層，外層的氣泡尾巴才不會被切掉）
    .pv-text-body {
        max-height: 18vh;
        overflow-y: auto;
        white-space: pre-line;
        overflow-wrap: anywhere;
    }

    // 描述：前面一條藍色直線
    &.is-note {
        padding-left: 9px;
        border-left: 3px solid #6da2c2;
    }

    // 留言：跟留言頻道一樣的氣泡，左上方往左上翹的小勾（形狀同 ShiftCommentDrawer 的 .ch-bubble）。
    // 底色不透明，尾巴疊在氣泡上才不會一塊深一塊淺
    &.is-comment {
        --bubble-bg: #2e2e2e;
        position: relative;
        display: inline-block;
        max-width: calc(100% - 8px);
        margin-left: 8px;
        padding: 6px 12px;
        border-radius: 16px;
        background: var(--bubble-bg);
        box-sizing: border-box;

        &::before {
            content: '';
            position: absolute;
            top: 3px;
            left: -8px;
            width: 14px;
            height: 16px;
            background: var(--bubble-bg);
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 16'%3E%3Cpath d='M0 0C2.5 3.2 7.5 4.8 14 4.8V16C6.5 16 1.8 9.5 0 0Z'/%3E%3C/svg%3E") no-repeat center / 100% 100%;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 16'%3E%3Cpath d='M0 0C2.5 3.2 7.5 4.8 14 4.8V16C6.5 16 1.8 9.5 0 0Z'/%3E%3C/svg%3E") no-repeat center / 100% 100%;
        }
    }
}

.pv-actions {
    display: flex;
    gap: 10px;
    margin-top: 12px;

    :slotted(button) {
        width: auto;
        height: 36px;
        margin: 0;
        padding: 0 16px;
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 8px;
        background: none;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
    }
}
</style>
