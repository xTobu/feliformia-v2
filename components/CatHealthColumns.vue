<template>
    <el-popover placement="bottom-end" trigger="click" :width="140" popper-class="hr-cols-pop">
        <template #reference>
            <button type="button" class="hr-cols-btn" aria-label="選擇要顯示的欄位">
                <Icon icon="mdi:view-column-outline" width="18" />
            </button>
        </template>
        <el-checkbox-group v-model="shown" class="hr-cols-list" @change="save">
            <el-checkbox
                v-for="col in cols"
                :key="col.key"
                :value="col.key"
                :label="col.label"
                :disabled="shown.length === 1 && shown[0] === col.key"
            />
        </el-checkbox-group>
    </el-popover>
</template>

<script setup>
// 健康紀錄表的欄位選擇鈕。跟表格分開，頁面才能把它擺進自己的工具列
import { Icon } from '@iconify/vue';

const { cols, shown, restore, save } = useCatHealthCols();

onMounted(restore);
</script>

<style lang="scss" scoped>
.hr-cols-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid #dcdad8;
    border-radius: 8px;
    background: #fff;
    color: #657181;
    cursor: pointer;
}
</style>

<style lang="scss">
/* el-popover 會 teleport 到 body，scoped 選不到 */
.hr-cols-pop {
    .hr-cols-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .el-checkbox {
        height: 28px;
        margin: 0;
    }
}
</style>
