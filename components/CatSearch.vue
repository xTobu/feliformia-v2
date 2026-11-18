<template>
    <!-- 貓咪搜尋：一顆放大鏡（有套用條件時淡藍底），點了打開視窗選名稱或暱稱、領養狀態。
         視窗裡改的是草稿，按「看 N 隻」才套用。後台貓咪管理與貓咪列表共用 -->
    <div class="cat-search">
        <button type="button" class="search-btn" :class="{ on: isCatFilterOn(filter) }" aria-label="搜尋貓咪" @click="open">
            <Icon icon="mdi:magnify" width="18" />
        </button>
        <el-dialog v-model="visible" title="搜尋貓咪" width="90%" class="cat-search-dialog" align-center append-to-body>
            <div class="search-label">名稱或暱稱</div>
            <el-input
                v-model="draft.keyword"
                placeholder="例如：餅乾"
                clearable
                @keydown.enter="(e) => !isImeEnter(e) && apply()"
            >
                <template #prefix><Icon icon="mdi:magnify" width="16" /></template>
            </el-input>
            <div class="search-label">領養</div>
            <div class="search-chips">
                <button
                    v-for="o in CAT_STATUS_OPTIONS"
                    :key="o.key"
                    type="button"
                    class="chip"
                    :class="{ on: draft.status === o.key }"
                    @click="draft.status = o.key"
                >
                    {{ o.label }}
                </button>
            </div>
            <template #footer>
                <div class="search-footer">
                    <el-button @click="draft = emptyCatFilter()">清除</el-button>
                    <el-button type="primary" @click="apply">
                        {{ count ? `看 ${count} 隻` : '沒有符合的貓咪' }}
                    </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
// v-model:filter：套用中的條件（{ keyword, status }）。cats：全部的貓（即時算筆數）
import { Icon } from '@iconify/vue';
import { CAT_STATUS_OPTIONS, emptyCatFilter, isCatFilterOn, matchesCatFilter } from '~/composables/catSearch';

const props = defineProps({
    filter: { type: Object, required: true },
    cats: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:filter']);

const visible = ref(false);
const draft = ref(emptyCatFilter());
const count = computed(() => props.cats.filter((c) => matchesCatFilter(c, draft.value)).length);

function open() {
    draft.value = { ...props.filter };
    visible.value = true;
}

function apply() {
    emit('update:filter', { keyword: draft.value.keyword.trim(), status: draft.value.status });
    visible.value = false;
}
</script>

<style lang="scss" scoped>
// 跟旁邊的按鈕一樣高的方塊；有套用條件時淡藍底
.search-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 1px solid #c9dff0;
    border-radius: 6px;
    background: #fff;
    color: #3f7ea3;
    cursor: pointer;

    &.on {
        border-color: #6da2c2;
        background: #eef6fc;
    }
}
</style>

<style lang="scss">
// 視窗 append 到 body，不能用 scoped
.cat-search-dialog {
    max-width: 420px;

    .search-label {
        margin: 14px 0 6px;
        color: #767676;
        font-size: 13px;
        font-weight: 500;
        text-align: left;

        &:first-child {
            margin-top: 0;
        }
    }

    .el-input__wrapper {
        height: 40px;
    }

    .search-chips {
        display: flex;
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
            cursor: pointer;

            &.on {
                border-color: #6da2c2;
                background: #6da2c2;
                color: #fff;
            }
        }
    }

    .search-footer {
        display: flex;

        .el-button {
            flex: 1;
        }
    }
}
</style>
