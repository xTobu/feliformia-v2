<template>
    <!-- 頭像裁切：選好新照片，或點現有頭像重新調整位置時跳出來；拖曳移動、雙指或按鈕縮放，圓框裡的就是頭像。
         按「完成」輸出 512×512 的 JPEG（done 事件），由呼叫的頁面上傳 -->
    <el-dialog
        :model-value="!!(file || source)"
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
                :default-position="defaultPosition"
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
                <button type="button" class="ac-ok" :disabled="busy || !src" @click="confirm">
                    {{ busy ? '處理中…' : src ? '完成' : '載入中…' }}
                </button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup>
import { Cropper, CircleStencil } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { compressImage } from '~/composables/useImageCompress';

// file：新選的照片（先壓成最長邊 1600px 的原圖再裁，原圖跟著 done 一起交出去）。
// source：{ url, crop } 重新調整現有頭像：原圖網址與上次框的範圍（舊頭像沒有原圖就給那張頭像）
// done(blob, { crop, sourceBlob })：裁好的 512×512、這次框的範圍（原圖上的像素）、新選照片的原圖（調整位置時是 null）
const props = defineProps({
    file: { type: Object, default: null },
    source: { type: Object, default: null },
    // 外面在上傳時顯示「處理中」
    busy: { type: Boolean, default: false },
});
const emit = defineEmits(['done', 'cancel']);

const OUTPUT_SIZE = 512;
const cropper = ref(null);
const src = ref(null);
let sourceBlob = null; // 新選照片壓好的原圖
let loadId = 0;

function setSrc(blob) {
    if (src.value) URL.revokeObjectURL(src.value);
    src.value = blob ? URL.createObjectURL(blob) : null;
}

// 原圖一律先變成 blob 再給裁切：新照片先壓過；網址的先抓下來（同源的 blob，畫到 canvas 才不會被擋）
watch(
    () => [props.file, props.source],
    async ([file, source]) => {
        const id = ++loadId;
        setSrc(null);
        sourceBlob = null;
        if (!file && !source) return;
        try {
            const blob = file ? (await compressImage(file)).blob : await (await fetch(source.url)).blob();
            if (id !== loadId) return;
            if (file) sourceBlob = blob;
            setSrc(blob);
        } catch (e) {
            console.error('avatar cropper load error:', e);
            if (id === loadId) emit('cancel');
        }
    },
    { immediate: true }
);

onBeforeUnmount(() => setSrc(null));

// 一開始：重新調整就框在上次的位置；新照片框住中間、取短邊的 9 成
const initialCrop = () => (props.file ? null : props.source?.crop || null);
const defaultSize = ({ imageSize }) => {
    const crop = initialCrop();
    if (crop) return { width: crop.width, height: crop.height };
    const side = Math.min(imageSize.width, imageSize.height) * 0.9;
    return { width: side, height: side };
};
const defaultPosition = ({ coordinates, imageSize }) => {
    const crop = initialCrop();
    if (crop) return { left: crop.left, top: crop.top };
    return { left: (imageSize.width - coordinates.width) / 2, top: (imageSize.height - coordinates.height) / 2 };
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
    const crop = { ...result.coordinates };
    out.toBlob((blob) => blob && emit('done', blob, { crop, sourceBlob }), 'image/jpeg', 0.85);
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
