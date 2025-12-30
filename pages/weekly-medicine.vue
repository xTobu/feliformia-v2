<template>
    <ClientOnly>
        <div id="medicine">
            <h1>卯咪餵藥週表</h1>
            <form @submit.prevent>
                <div class="d_flex">
                    <div class="W100 arrow">
                        <el-select
                            style="width: 100%"
                            v-model="selectedCat"
                            placeholder="請選擇卯咪"
                        >
                            <el-option
                                v-for="(cat, key) in optionsCats"
                                :label="cat"
                                :value="cat"
                                :key="key"
                            />
                        </el-select>
                    </div>
                </div>
            </form>

            <el-empty v-if="!selectedCat" description="請選擇卯咪" />

            <template v-for="data in computedTableData" :key="data.id">
                <div class="info-header">
                    <el-tag type="warning">{{ data.date }}{{ data.shift }}</el-tag>
                    <el-tag v-if="data.member"> {{ data.member }}</el-tag>  
                </div>
                <el-table
                    class="weekly-table"
                    :data="data.treatment"
                    header-cell-class-name="weekly-head"
                    cell-class-name="weekly-cell"
                    border
                    style="width: 100%"
                    empty-text="尚未選擇卯咪"
                >
                    <el-table-column
                        align="center"
                        label="事項"
                        min-width="80%"
                    >
                        <template #default="scope">
                            <span>{{ scope.row.treatment }}</span>
                        </template>
                    </el-table-column>

                    <el-table-column
                        align="center"
                        label="完成"
                        min-width="20%"
                    >
                        <template #default="scope">
                            <el-icon
                                v-if="scope.row.done"
                                style="color: #0071b0; font-size: 20px"
                            >
                                <Check />
                            </el-icon>
                            <el-icon
                                v-else
                                style="color: #740a00; font-size: 20px"
                            >
                                <Close />
                            </el-icon>
                        </template>
                    </el-table-column>
                </el-table>
            </template>

            <FloatButton />
        </div>

        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
import { Check, Close } from '@element-plus/icons-vue';
import FloatButton from '~/components/FloatButton.vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '卯咪餵藥週表',
});

const { $dayjs } = useNuxtApp();
const route = useRoute();

// State
const selectedCat = ref('');
const optionsCats = ref([]);
const dataWeekly = ref([]);

// Computed
const computedTableData = computed(() => {
    if (!selectedCat.value) {
        return [];
    }

    const arrCatWeek = dataWeekly.value.reduce(
        (accumulator, { id, date, shift, cats, member }) => {
            const cat = cats.filter((item) => item.name === selectedCat.value);
            if (!cat || cat.length === 0) {
                return accumulator;
            }

            // 班別 - 日期
            const newDate = $dayjs(date).format('MM/DD');

            // 班別 - 早晚班
            const shiftMap = {
                morning: '早',
                night: '晚',
            };
            const newShift = shiftMap[shift];

            return [
                ...accumulator,
                {
                    id,
                    member,
                    date: newDate,
                    shift: newShift,
                    treatment: cat,
                },
            ];
        },
        []
    );

    return arrCatWeek;
});

// Methods
async function InitWeekly() {
    try {
        const data = await $fetch('/api/medicine/between', {
            method: 'POST',
            body: {
                dateStart: $dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
                dateEnd: $dayjs().format('YYYY-MM-DD'),
            },
        });
        dataWeekly.value = data;
    } catch (e) {
        console.error('InitWeekly error:', e);
    }
}

async function InitCatList() {
    const objCats = dataWeekly.value.reduce((accumulator, currentValue) => {
        let cats = {};
        currentValue.cats.forEach((dataCat) => {
            cats[dataCat.name] = true;
        });
        return { ...accumulator, ...cats };
    }, {});

    const arrCats = Object.keys(objCats);
    optionsCats.value = arrCats;
}

// Lifecycle
onMounted(async () => {
    await InitWeekly();
    await InitCatList();
});
</script>

<style lang="scss">
    .info-header {
        display: flex;
        gap: 4px;
        justify-content: start;
        align-items: center;
        margin-bottom: 4px;
    }
    .el-table {
        &.weekly-table {
            margin: 0 0 32px 0;
        }
        .weekly-head {
            height: 32px;
            background: #8e8783 !important;
            color: #fff;
            font-size: 16px;
            line-height: 16px;
            font-weight: 400;
            padding: 2px 0;
        }
        .weekly-cell {
            > .cell {
                display: flex;
                justify-content: center;
                align-items: center;
            }
        }
        span.warning {
            color: #b7282e;
        }
    }

    #medicine {
        a {
            display: block;
        }
        div.label-tag {
            float: left;
            font-weight: 500;
            padding: 4px 6px;
            font-size: 15px;
            color: #333;
            border-radius: 4px;
    
        }
    }

    .el-table .cell {
        font-size: 14px;
    }
</style>
