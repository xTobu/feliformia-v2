<template>
    <!-- 頭像裁切：選好照片後跳出來，拖曳移動、雙指或按鈕縮放，圓框裡的就是頭像。
         按「使用這張」輸出 512×512 的 JPEG（done 事件），由呼叫的頁面上傳 -->
    <el-dialog
        :model-value="!!file"
        title="調整頭像"
        width="90%"
        class="avatar-cropper-dialog"
        align-center
        append-to-body
        @update:model-value="(v) => !v && emit('cancel')"
    >
        <div class="ac-stage">
            <Cropper
                v-if="src"
                ref="cropper"
                class="ac-cropper"
                :src="src"
                :stencil-component="CircleStencil"
                :stencil-props="{ aspectRatio: 1 }"
                :default-size="defaultSize"
                image-restriction="stencil"
                background-class="ac-background"
            />
        </div>
        <div class="ac-zoom">
            <button type="button" aria-label="縮小" @click="zoom(0.8)">－</button>
            <span>拖曳移動、縮放調整範圍</span>
            <button type="button" aria-label="放大" @click="zoom(1.25)">＋</button>
        </div>
        <template #footer>
            <div class="ac-actions">
                <button type="button" class="ac-cancel" @click="emit('cancel')">取消</button>
                <button type="button" class="ac-ok" :disabled="busy" @click="confirm">
                    {{ busy ? '處理中…' : '使用這張' }}
                </button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup>
import { Cropper, CircleStencil } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

const props = defineProps({
    // 選好的照片；有值就打開
    file: { type: Object, default: null },
    // 外面在上傳時顯示「處理中」
    busy: { type: Boolean, default: false },
});
const emit = defineEmits(['done', 'cancel']);

const OUTPUT_SIZE = 512;
const cropper = ref(null);
const src = ref(null);

watch(
    () => props.file,
    (file) => {
        if (src.value) URL.revokeObjectURL(src.value);
        src.value = file ? URL.createObjectURL(file) : null;
    }
);

onBeforeUnmount(() => {
    if (src.value) URL.revokeObjectURL(src.value);
});

// 一開始框住照片中間、取短邊的 9 成
const defaultSize = ({ imageSize }) => {
    const side = Math.min(imageSize.width, imageSize.height) * 0.9;
    return { width: side, height: side };
};

const zoom = (factor) => cropper.value?.zoom(factor);

function confirm() {
    const result = cropper.value?.getResult();
    if (!result?.canvas) return;
    const out = document.createElement('canvas');
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff'; // 透明背景（png）轉成 JPEG 時是白底
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(result.canvas, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    out.toBlob((blob) => blob && emit('done', blob), 'image/jpeg', 0.85);
}
</script>

<style lang="scss" scoped>
.ac-stage {
    height: 320px;
    border-radius: 8px;
    overflow: hidden;
    background: #222;
}

.ac-cropper {
    height: 100%;
}

:deep(.ac-background) {
    background: #222;
}

.ac-zoom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 10px;
    font-size: 12px;
    color: #8e8783;

    button {
        width: 36px;
        height: 36px;
        margin: 0;
        padding: 0;
        border: 1px solid #ddd;
        border-radius: 50%;
        background: #fff;
        color: #657181;
        font-size: 18px;
        cursor: pointer;
    }
}

.ac-actions {
    display: flex;
    gap: 10px;

    button {
        height: 44px;
        margin: 0;
        border-radius: 8px;
        font-size: 15px;
        cursor: pointer;
    }

    .ac-cancel {
        width: 34%;
        border: 1px solid #ddd;
        background: #fff;
        color: #657181;
    }

    .ac-ok {
        flex: 1;
        border: none;
        background: #6da2c2;
        color: #fff;

        &:disabled {
            opacity: 0.6;
            cursor: default;
        }
    }
}
</style>

<style lang="scss">
/* el-dialog 會 teleport 到 body，scoped 選不到 dialog 本身 */
.avatar-cropper-dialog {
    max-width: 420px;
    border-radius: 12px;
}
</style>
