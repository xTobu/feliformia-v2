<template>
    <ClientOnly>
        <div id="regular">
            <h1>卯咪健康週表</h1>
            <form @submit.prevent>
                <div class="d_flex">
                    <div class="W100 arrow">
                        <el-select
                            style="width: 100%"
                            v-model="selectedCat"
                            placeholder="請選擇卯咪"
                        >
                            <el-option
                                v-for="cat in optionsCats"
                                :label="cat.name.split(/[：:]/)[0]"
                                :value="cat.id"
                                :key="cat.id"
                            />
                        </el-select>
                    </div>
                </div>
            </form>

            <el-table
                class="weekly-table"
                :data="computedTableData"
                header-cell-class-name="weekly-head"
                cell-class-name="weekly-cell"
                border
                stripe
                style="width: 100%"
                empty-text="尚未選擇卯咪"
            >
                <el-table-column
                    align="center"
                    fixed
                    label="班別"
                    min-width="25%"
                >
                    <template #default="scope">
                        {{ scope.row.date }} {{ scope.row.shift }}
                    </template>
                </el-table-column>
                <el-table-column align="center" label="乾" min-width="18.75%">
                    <template #default="scope">
                        <span
                            :class="{ warning: isWarningCell(scope.row.feed) }"
                        >
                            {{ scope.row.feed }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column align="center" label="罐" min-width="18.75%">
                    <template #default="scope">
                        <span
                            :class="{ warning: isWarningCell(scope.row.can) }"
                        >
                            {{ scope.row.can }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column align="center" label="尿" min-width="18.75%">
                    <template #default="scope">
                        <el-icon
                            v-if="scope.row.urine"
                            style="color: #0071b0; font-size: 20px"
                        >
                            <Check />
                        </el-icon>
                        <el-icon v-else style="color: #740a00; font-size: 20px">
                            <Close />
                        </el-icon>
                    </template>
                </el-table-column>
                <el-table-column align="center" label="屎" min-width="18.75%">
                    <template #default="scope">
                        <el-icon
                            v-if="scope.row.feces === '正常'"
                            style="color: #0071b0; font-size: 20px"
                        >
                            <Check />
                        </el-icon>
                        <el-icon
                            v-else-if="scope.row.feces === false"
                            style="color: #740a00; font-size: 20px"
                        >
                            <Close />
                        </el-icon>
                        <span
                            v-else
                            :class="{ warning: isWarningCell(scope.row.feces) }"
                        >
                            {{ scope.row.feces }}
                        </span>
                    </template>
                </el-table-column>
            </el-table>
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
    title: '卯咪健康週表',
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
        (accumulator, { id, date, shift, cats }) => {
            const cat = cats.find(
                (item) => item.cat.recordId == selectedCat.value
            );
            if (!cat) {
                return accumulator;
            }

            const {
                feed,
                feed_detail,
                can,
                can_detail,
                feces,
                feces_warning,
                urine,
            } = cat;

            // 映射表
            const shiftMap = {
                morning: '早',
                night: '晚',
            };
            const markMap = {
                0: '沒吃',
                25: '吃1/3',
                50: '吃1/2',
                75: '吃2/3',
                100: '吃光',
            };

            // 班別 - 日期
            const newDate = $dayjs(date).format('MM/DD');

            // 班別 - 早晚班
            const newShift = shiftMap[shift];

            // 乾
            let newFeed = '';
            if (feed) {
                newFeed = markMap[feed_detail];
            }

            // 罐
            let newCan = '';
            if (can) {
                newCan = markMap[can_detail];
            }

            // 尿
            let newUrine = urine;

            // 便
            let newFeces = false;
            if (feces) {
                newFeces = feces_warning;
            }

            return [
                ...accumulator,
                {
                    id,
                    date: newDate,
                    shift: newShift,
                    feed: newFeed,
                    can: newCan,
                    feces: newFeces,
                    urine: newUrine,
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
        const data = await $fetch('/api/regular/between', {
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
    const queryCat = route.query.cat;

    const objCats = dataWeekly.value.reduce((accumulator, currentValue) => {
        let cats = {};
        currentValue.cats.forEach((dataCat) => {
            cats[dataCat.cat.recordId] = dataCat.cat.name;
            if (queryCat && queryCat == dataCat.cat.recordId) {
                selectedCat.value = dataCat.cat.recordId;
            }
        });
        return { ...accumulator, ...cats };
    }, {});

    const arrCats = Object.keys(objCats).map((key) => ({
        id: key,
        name: objCats[key],
    }));

    optionsCats.value = arrCats;
}

function isWarningCell(status) {
    return ~['沒吃', '軟便', '拉稀'].indexOf(status);
}

// Lifecycle
onMounted(async () => {
    await InitWeekly();
    await InitCatList();
});
</script>

<style lang="scss">
.el-table {
    &.weekly-table {
        margin: 0 0 48px 0;
    }
    .weekly-head {
        height: 36px;
        background: #8e8783 !important;
        color: #fff;
        font-size: 16px;
        line-height: 16px;
        font-weight: 400;
        padding: 4px 0;
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

#regular {
    a {
        display: block;
    }
}
</style>
