<template>
    <!-- 照護項目的附圖：一排小縮圖，點了看大圖（可以左右換張）。後台清單與值班表共用。
         compact：只顯示第一張、多張時角落標 +N（後台清單放在文字右邊用） -->
    <div v-if="paths.length" class="care-photos" :class="{ compact }">
        <button
            v-for="(path, i) in compact ? paths.slice(0, 1) : paths"
            :key="path"
            type="button"
            class="care-photo"
            aria-label="看附圖"
            @click.stop="index = i"
        >
            <img :src="thumbUrl(path)" alt="" loading="lazy" />
            <span v-if="compact && paths.length > 1" class="care-more">+{{ paths.length - 1 }}</span>
        </button>
        <PhotoViewer v-model:index="index" :photos="viewerPhotos" @close="index = null" />
    </div>
</template>

<script setup>
// paths：照片路徑（大圖）。label：看大圖時上方寫的字（例如項目名稱）
import { useCareItemPhotos } from '~/composables/careItemPhotos';

const props = defineProps({
    paths: { type: Array, default: () => [] },
    label: { type: String, default: '' },
    compact: { type: Boolean, default: false },
});

const { photoUrl, thumbUrl } = useCareItemPhotos();
const index = ref(null);
const viewerPhotos = computed(() => props.paths.map((p) => ({ url: photoUrl(p), label: props.label, meta: '附圖' })));
</script>

<style lang="scss" scoped>
.care-photos {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;

    // 只顯示一張、放在旁邊：大一點，不留上邊距
    &.compact {
        flex-shrink: 0;
        margin-top: 0;

        .care-photo {
            width: 48px;
            height: 48px;
        }
    }
}

// 多張時第一張右下角標還有幾張
.care-more {
    position: absolute;
    right: 2px;
    bottom: 2px;
    padding: 0 4px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 11px;
    line-height: 16px;
}

// 全域 button 樣式要蓋回來
.care-photo {
    position: relative;
    width: 40px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 6px;
    overflow: hidden;
    background: #f0eeec;
    cursor: zoom-in;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}
</style>
