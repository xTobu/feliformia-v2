<template>
    <div class="hr-wrap">
        <!-- maxHeight：限制高度，表格自己上下捲、表頭固定在上面（左邊班別兩欄本來就固定）；
             捲到接近底部發 near-end，頁面拿來載入更早的班 -->
        <div
            ref="scrollEl"
            class="hr-scroll"
            :class="{ stuck, limited: !!maxHeight }"
            :style="maxHeight ? { maxHeight } : null"
            @scroll.passive="onScroll"
        >
            <table class="hr-table">
            <!-- 欄寬寫在 colgroup：班別是兩欄（日期、早晚），表頭合成一格「班別」 -->
            <colgroup>
                <col class="hr-date-w" />
                <col class="hr-shift-w" />
                <col v-for="col in visibleCols" :key="col.key" :style="{ width: col.width }" />
            </colgroup>
            <thead>
                <tr>
                    <th class="hr-shift-col" colspan="2">班別</th>
                    <th v-for="col in visibleCols" :key="col.key" :class="col.group ? `hr-g-${col.group}` : null">
                        {{ col.label }}
                    </th>
                </tr>
            </thead>
            <tbody>
                <!-- 一天兩班：日期（含週幾）合併成一格跨當天的列，旁邊一欄是早班太陽、晚班月亮（同貓咪檔案日常，點了到值班紀錄那一班）。
                     天與天之間一條深一點的線，隔天交替底色 -->
                <tr
                    v-for="row in rows"
                    :key="row.entry.shift_id"
                    :class="{ alt: row.alt, 'day-end': row.last }"
                >
                    <td v-if="row.first" class="hr-date" :rowspan="row.span">
                        {{ dateLabel(row.entry.date) }}<span class="hr-weekday">{{ weekdayLabel(row.entry.date) }}</span>
                    </td>
                    <td class="hr-shift">
                        <!-- 沒有紀錄的班不連過去：打開值班紀錄會順手建立那一班 -->
                        <component
                            :is="linkShift && !row.entry.missing ? 'NuxtLink' : 'span'"
                            :to="linkShift && !row.entry.missing ? `/shift?date=${row.entry.date}&shift=${row.entry.shift}` : undefined"
                            :class="['hr-shift-icon', row.entry.shift]"
                            :aria-label="row.entry.shift === 'night' ? '晚班' : '早班'"
                        >
                            <Icon
                                :icon="row.entry.shift === 'night' ? 'mdi:weather-night' : 'mdi:white-balance-sunny'"
                                width="17"
                            />
                        </component>
                    </td>

                    <!-- 沒人打開過的班（missing）：跟沒登記一樣，飲食如廁是 —、放風是叉叉，值班欄寫「沒有紀錄」 -->
                    <td v-for="cell in rowCells(row.entry)" :key="cell.key" :class="cell.cls">
                        <!-- 尿、便、放風是二選一，用勾勾叉叉比文字好掃；
                             軟便、拉稀這種還是要寫出來，所以 mark 是 null 時印文字 -->
                        <Icon v-if="cell.mark === 'ok'" icon="mdi:check" width="19" class="hr-ok" />
                        <Icon v-else-if="cell.mark === 'no'" icon="mdi:close" width="19" class="hr-no" />
                        <!-- 被提及：有就一個驚嘆號，沒有就留白（叉叉會讓整欄都是符號，反而看不出哪幾班要看）。
                             點了查那一班的回報，不預先載入 —— 多半用不到 -->
                        <button
                            v-else-if="cell.mark === 'note'"
                            type="button"
                            class="hr-note"
                            aria-label="看這一班的回報"
                            @click="openReport(row.entry)"
                        >
                            <Icon icon="mdi:exclamation-thick" width="17" />
                        </button>
                        <template v-else>{{ cell.text }}</template>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>

        <!-- 被提及點開：那一班的值班回報。三個分頁各一段，有寫的才列 -->
        <el-dialog v-model="reportOpen" :title="reportTitle" class="hr-report-dialog" width="90%">
            <p v-if="reportLoading" class="hr-report-state">載入中...</p>
            <p v-else-if="reportError" class="hr-report-state">讀不到回報，請再試一次</p>
            <p v-else-if="!reportSections.length" class="hr-report-state">這一班沒有回報</p>
            <div v-else class="hr-report-list">
                <div v-for="(sec, i) in reportSections" :key="i" class="hr-report-sec">
                    <div class="hr-report-head">
                        <span class="hr-report-tab">{{ sec.label }}</span>
                        <span v-if="sec.name" class="hr-report-name">{{ sec.name }}</span>
                    </div>
                    <p class="hr-report-text"><ReportText :text="sec.text" :names="highlightNames" /></p>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup>
// 一隻貓的飲食排泄表，一班一列。
// 貓咪檔案的「健康紀錄」分頁與 /weekly 共用這一份 ——
// 兩邊顯示的是同一份 shifts 資料，不要各寫一份然後走樣。
import { Icon } from '@iconify/vue';
import { intakeCells, isIntakeTouched } from '~/composables/intake';

const props = defineProps({
    // /api/cats/timeline 回傳的 entries（已過濾 in_shift）
    entries: { type: Array, default: () => [] },
    // 班別那格要不要連到值班記錄表的那一班
    linkShift: { type: Boolean, default: true },
    // 回報彈窗裡要標藍底的名字（現在看的這隻貓與牠的暱稱）
    highlightNames: { type: Array, default: () => [] },
    // 表格最高多高（CSS 長度）；給了就表格自己捲、表頭固定，沒給就整張攤開
    maxHeight: { type: String, default: '' },
});
const emit = defineEmits(['near-end']);

const { $dayjs } = useNuxtApp();

// 左右捲到非最左邊時，班別那欄加陰影 —— 不然黏住的欄位跟捲過去的內容
// 疊在一起，看起來像破圖。只有真的被蓋住時才加，沒捲動時不要多一條線
const scrollEl = ref(null);
const stuck = ref(false);
const onScroll = () => {
    const el = scrollEl.value;
    stuck.value = (el?.scrollLeft || 0) > 0;
    checkNearEnd();
};

// 限制高度時：捲到離底部 120px 內、或內容還沒填滿框（沒有捲軸），就請頁面再載入更早的班
function checkNearEnd() {
    const el = scrollEl.value;
    if (!props.maxHeight || !el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) emit('near-end');
}
watch(
    () => props.entries.length,
    () => nextTick(checkNearEnd)
);
// 從別的分頁切過來時資料可能已經在了，掛上去時也檢查一次
onMounted(() => nextTick(checkNearEnd));

// from：對應 intakeCells() 回傳的 label（表頭用短的，格子裡的 label 是長的）。
// 放風不在 intake 裡，另外從 entry.released 取
// 要顯示哪些欄位：跟選欄位的按鈕（CatHealthColumns.vue）共用同一份狀態
const { visibleCols, restore } = useCatHealthCols();

onMounted(restore);

// 日期那格：上面「11/16」，下面小字「週日」；不是今年的，小字前面加年份（「2025・週日」），日期欄才不會撐寬
const WEEKDAYS = '日一二三四五六';
const dateLabel = (date) => $dayjs(date).format('MM/DD');
const weekdayLabel = (date) => {
    const d = $dayjs(date);
    const year = d.year() === $dayjs().year() ? '' : `${d.year()}・`;
    return `${year}週${WEEKDAYS[d.day()]}`;
};

// 同一天的班併成一組（entries 照日期新到舊、同一天晚班在前）：
// first＝當天第一列（放日期格，rowspan＝當天幾班）、last＝當天最後一列（下面畫分隔線）、alt＝隔天交替底色
const rows = computed(() => {
    const list = props.entries;
    let day = -1;
    return list.map((entry, i) => {
        const first = i === 0 || list[i - 1].date !== entry.date;
        if (first) day += 1;
        let span = 1;
        while (first && list[i + span]?.date === entry.date) span += 1;
        return { entry, first, span, last: list[i + 1]?.date !== entry.date, alt: day % 2 === 1 };
    });
});

// ---- 被提及的彈窗 ----
const reportOpen = ref(false);
const reportLoading = ref(false);
const reportError = ref(false);
const reportSections = ref([]);
const reportTitle = ref('');

async function openReport(entry) {
    reportTitle.value = `${$dayjs(entry.date).format('YYYY/MM/DD')} ${entry.shift === 'night' ? '晚班' : '早班'} 回報`;
    reportSections.value = [];
    reportError.value = false;
    reportOpen.value = true;
    reportLoading.value = true;

    try {
        const res = await $fetch('/api/shift/report', { query: { shiftId: entry.shift_id } });
        reportSections.value = res.sections || [];
    } catch (e) {
        console.error('load shift report error:', e);
        reportError.value = true;
    } finally {
        reportLoading.value = false;
    }
}

// 值班：那一班的值班志工，沒人排班寫「無人值班」（跟行事曆、LINE 發送同一個說法）；
// 那一班沒人打開過（missing）寫「沒有紀錄」
function volunteersCell(entry) {
    if (entry.missing) return { text: '沒有紀錄', cls: 'hr-none' };
    const names = entry.volunteers || [];
    return { text: names.length ? names.join('、') : '無人值班', cls: names.length ? 'hr-names' : 'hr-none' };
}

const OK = new Set(['有', '正常']);
const NO = new Set(['沒有']);

function rowCells(entry) {
    // 整班沒人登記（上一班就把貓放出來的話值班表不用登記，所以常常是這樣）
    const cells = isIntakeTouched(entry.intake) ? intakeCells(entry.intake) : null;
    const byLabel = Object.fromEntries((cells || []).map((c) => [c.label, c]));

    return visibleCols.value.map((col) => {
        if (col.key === 'volunteers') return { key: col.key, mark: null, ...volunteersCell(entry) };

        // 被提及：那一班的值班回報裡有寫到這隻貓的名字或暱稱（後端算好的）
        if (col.key === 'mentioned') {
            return { key: col.key, mark: entry.mentioned ? 'note' : null, text: '', cls: null };
        }

        // 放風跟飲食如廁是分開的一件事，沒登記飲食也可能有放風。
        // 本班＝這班走的時候放出來；前班＝到班時貓已經在外面（上一班放的），
        // 前班放風時值班表的飲食如廁不用登記，所以那幾列常常整排是 —
        if (col.key === 'released' || col.key === 'prev_released') {
            return { key: col.key, mark: entry[col.key] ? 'ok' : 'no', text: '', cls: null };
        }

        if (!cells) return { key: col.key, mark: null, text: '—', cls: 'hr-none' };

        const c = byLabel[col.from];
        if (OK.has(c.value)) return { key: col.key, mark: 'ok', text: '', cls: null };
        if (NO.has(c.value)) return { key: col.key, mark: 'no', text: '', cls: null };

        // empty＝那一班沒放這種食物（值班表沒勾）。日常的卡片有「乾乾」標籤
        // 所以寫「沒勾」看得懂，這裡欄位已經叫「乾」了，用 — 比較不會被誤讀成「沒吃」
        if (c.empty) return { key: col.key, mark: null, text: '—', cls: 'hr-empty' };

        return { key: col.key, mark: null, text: c.value, cls: c.warn ? 'hr-warn' : null };
    });
}
</script>

<style lang="scss" scoped>
// 欄位可以自選，開滿時手機放不下，所以整張表可以左右捲；限制高度時也上下捲（表頭固定）
.hr-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;

    &.limited {
        overflow-y: auto;
    }
}

.hr-table {
    width: 100%;
    // 欄位全開時至少要這麼寬（班別 92 ＋ 四個 52 ＋ 兩個放風 80 ＋ 被提及 68 ＋ 值班 120），
    // 不夠就讓它捲，不要把欄位擠扁
    min-width: 650px;
    // ⚠️ 一定要 separate 不能 collapse。collapse 時邊框由表格統一畫，
    // 黏住的格子（position: sticky）底色與 box-shadow 都會失效 ——
    // 捲動時右邊的內容會透到班別欄裡。代價是邊框要自己畫（見下面）
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
    // fixed：班別欄給固定寬，剩下的欄位自動平均分 —— 不然欄寬會跟著
    // 內容長短跑（「吃光」比「—」寬），每一列的欄位對不齊
    table-layout: fixed;

    // separate 的邊框自己畫：每格只畫右與下，最左、最上那排補回來，
    // 這樣線不會疊成兩條
    th,
    td {
        border-right: 1px solid #eceae8;
        border-bottom: 1px solid #eceae8;
    }

    th {
        border-top: 1px solid #e4e2e0;
        border-right-color: #e4e2e0;
        border-bottom-color: #e4e2e0;
    }

    // 最左邊補框線：表頭第一格與日期格（沒有日期格的列，左邊被上一列的日期格蓋住）
    th:first-child,
    td.hr-date {
        border-left: 1px solid #e4e2e0;
    }

    // 表頭：照分組上色（飲食橘、排泄藍、放風綠，其他灰），往右捲也認得出在看哪一組。
    // 限制高度時固定在框的頂端（sticky top），左上角的「班別」同時黏左、黏上，要壓在最上層
    th {
        position: sticky;
        top: 0;
        z-index: 2;
        padding: 8px 4px;
        // 表頭底下一條深一點、粗一點的線，跟內容分開（固定在上面時也跟著）
        border-bottom: 2px solid #b8b1ab;
        background: #f0eeec;
        color: #4a4542;
        font-weight: 600;
        // 表頭不折行 —— 放不下就左右捲，折行會讓表頭高度跟著欄位數跳動
        white-space: nowrap;
        // 全站的 body 是 text-align: center，但表格這邊會被其他規則蓋掉，寫明確一點
        text-align: center;

        &.hr-g-food {
            background: #fbeedc;
            color: #8a5a12;
        }

        &.hr-g-excretion {
            background: #e3eef6;
            color: #2f5f80;
        }

        &.hr-g-release {
            background: #e6f2e8;
            color: #3f7a50;
        }
    }

    td {
        height: 40px;
        padding: 6px 4px;
        color: #303133;
        text-align: center;
        vertical-align: middle;
    }

    // 隔天交替底色（一天的兩班同一個底色，看得出是一組）
    tbody tr.alt td {
        background: #fafafa;
    }

    // 天與天之間：深一點的線（日期格跨到當天最後一列，底線也一起）
    tbody tr.day-end td,
    tbody td.hr-date {
        border-bottom-color: #d8d4d1;
    }

    // 只指定班別兩欄（固定像素，不用 %，才不會隨欄位數縮水），其餘平分剩下的
    .hr-date-w {
        width: 58px;
    }

    .hr-shift-w {
        width: 34px;
    }

    // 左右捲的時候班別要黏在左邊，不然捲到右邊就不知道在看哪一班。
    // sticky 的格子一定要有底色，否則會透出捲過去的內容
    .hr-date {
        position: sticky;
        left: 0;
        z-index: 1;
    }

    // 左上角：黏左也黏上；底色比其他灰色欄深一點，一眼看得出是班別
    th.hr-shift-col {
        left: 0;
        z-index: 3;
        background: #ddd6cf;
        color: #3f3a37;
    }

    .hr-shift {
        position: sticky;
        left: 58px;
        z-index: 1;
    }

    // 捲動時才加陰影，標出班別欄是黏住的（陰影在早晚那欄的右邊）。
    // 用右側的 box-shadow（負的擴散值把上下收掉），看起來像一道邊界而不是整欄浮起來
    .hr-scroll.stuck & {
        .hr-shift-col,
        .hr-shift {
            box-shadow: 4px 0 6px -3px rgb(0 0 0 / 20%);
        }
    }

    .hr-date {
        background: #fff;
        white-space: nowrap;
        font-weight: 600;
        line-height: 1.3;
    }

    .hr-weekday {
        display: block;
        color: #8e8783;
        font-size: 11px;
        font-weight: 400;
    }

    .hr-shift {
        background: #fff;
        white-space: nowrap;
        color: #606266;
        font-weight: 500;

        // 早班太陽、晚班月亮，顏色同貓咪檔案日常卡片的班別標籤
        :deep(.hr-shift-icon) {
            display: flex;
            align-items: center;
            justify-content: center;

            &.morning {
                color: #c98a1e;
            }

            &.night {
                color: #4a5687;
            }
        }

        :deep(a),
        :deep(span) {
            margin: 0;
            color: inherit;
            text-decoration: none;
        }
    }

    // 要注意的（沒吃、軟便、拉稀）：紅字、不加底色，沿用舊版 /weekly 的做法。
    // 這裡跟值班表不一樣 —— 值班表的紅是在催你去做事，所以改成橘；
    // 這張是健康紀錄，紅字純粹是「這筆要注意」，資訊性的
    td.hr-warn {
        color: #b7282e;
    }

    // 那一班沒放這種食物
    td.hr-empty {
        color: #c0bcb8;
    }

    // 整班沒人登記
    td.hr-none {
        color: #dcdad8;
    }

    // 值班志工：人名多的時候換行，字小一點
    td.hr-names {
        font-size: 12px;
        line-height: 1.4;
        overflow-wrap: anywhere;
    }

    // 勾勾叉叉沿用 /weekly 原本的顏色。
    // display: block 是必要的 —— inline 的 SVG 會貼著文字基線，
    // 看起來偏下；變成區塊才吃得到 td 的 vertical-align: middle
    .hr-ok,
    .hr-no {
        display: block;
        margin: 0 auto;
    }

    .hr-ok {
        color: #0071b0;
    }

    .hr-no {
        color: #740a00;
    }

    // 被提及：跟「要注意」同一個紅 —— 這張表只有兩種訊號色，
    // 藍色是正常、紅色是要看一下
    .hr-note {
        display: block;
        width: 100%;
        padding: 0;
        border: 0;
        background: none;
        color: #b7282e;
        cursor: pointer;

        .iconify {
            display: block;
            margin: 0 auto;
        }
    }
}
</style>

<style lang="scss">
/* el-dialog 會 teleport 到 body，scoped 選不到 */
.hr-report-dialog {
    max-width: 420px;

    .el-dialog__body {
        padding-top: 4px;
    }

    .hr-report-state {
        margin: 0;
        padding: 24px 0;
        color: #c0c4cc;
        font-size: 14px;
        text-align: center;
    }

    .hr-report-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    /* 白底細框：灰底會把文字壓在小盒子裡，白底讀起來輕 */
    .hr-report-sec {
        padding: 14px;
        border: 1px solid #e8e6e4;
        border-radius: 10px;
        background: #fff;
    }

    /* 分頁名稱做成膠囊靠左、寫的人靠右 */
    .hr-report-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
    }

    .hr-report-tab {
        padding: 2px 10px;
        border-radius: 12px;
        background: #eef2f5;
        color: #5a6a78;
        font-size: 12px;
        font-weight: 600;
    }

    .hr-report-name {
        color: #a8a29e;
        font-size: 12px;
    }

    /* 回報是自由輸入，換行要保留；長字串要能斷。
       字級與行高刻意放大 —— 真正影響閱讀的是這兩個，不是框線 */
    .hr-report-text {
        margin: 0;
        color: #303133;
        font-size: 15px;
        line-height: 1.9;
        text-align: left;
        white-space: pre-wrap;
        word-break: break-word;
    }
}
</style>
