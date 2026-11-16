<template>
    <div class="hr-wrap">
        <div ref="scrollEl" class="hr-scroll" :class="{ stuck }" @scroll.passive="onScroll">
            <table class="hr-table">
            <thead>
                <tr>
                    <th class="hr-shift-col">班別</th>
                    <th v-for="col in visibleCols" :key="col.key" :style="{ width: col.width }">
                        {{ col.label }}
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="entry in entries" :key="entry.shift_id">
                    <td class="hr-shift">
                        <component
                            :is="linkShift ? 'NuxtLink' : 'span'"
                            :to="linkShift ? `/shift?date=${entry.date}&shift=${entry.shift}` : undefined"
                        >
                            {{ dateLabel(entry.date) }}{{ entry.shift === 'night' ? '晚' : '早' }}
                        </component>
                    </td>

                    <td v-for="cell in rowCells(entry)" :key="cell.key" :class="cell.cls">
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
                            @click="openReport(entry)"
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

defineProps({
    // /api/cats/timeline 回傳的 entries（已過濾 in_shift）
    entries: { type: Array, default: () => [] },
    // 班別那格要不要連到值班記錄表的那一班
    linkShift: { type: Boolean, default: true },
    // 回報彈窗裡要標藍底的名字（現在看的這隻貓與牠的暱稱）
    highlightNames: { type: Array, default: () => [] },
});

const { $dayjs } = useNuxtApp();

// 左右捲到非最左邊時，班別那欄加陰影 —— 不然黏住的欄位跟捲過去的內容
// 疊在一起，看起來像破圖。只有真的被蓋住時才加，沒捲動時不要多一條線
const scrollEl = ref(null);
const stuck = ref(false);
const onScroll = () => {
    stuck.value = (scrollEl.value?.scrollLeft || 0) > 0;
};

// from：對應 intakeCells() 回傳的 label（表頭用短的，格子裡的 label 是長的）。
// 放風不在 intake 裡，另外從 entry.released 取
// 要顯示哪些欄位：跟選欄位的按鈕（CatHealthColumns.vue）共用同一份狀態
const { visibleCols, restore } = useCatHealthCols();

onMounted(restore);

// 「11/16晚」。不寫星期 —— 這是一列一班的表，橫著比的是數值不是日子，
// 星期只會把班別欄撐寬、擠掉右邊的欄位
const dateLabel = (date) => {
    const d = $dayjs(date);
    const year = d.year() === $dayjs().year() ? '' : `${d.year()}/`;
    return `${year}${d.format('MM/DD')}`;
};

// ---- 被提及的彈窗 ----
const reportOpen = ref(false);
const reportLoading = ref(false);
const reportError = ref(false);
const reportSections = ref([]);
const reportTitle = ref('');

async function openReport(entry) {
    reportTitle.value = `${dateLabel(entry.date)} ${entry.shift === 'night' ? '晚班' : '早班'} 回報`;
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

const OK = new Set(['有', '正常']);
const NO = new Set(['沒有']);

function rowCells(entry) {
    // 整班沒人登記（上一班就把貓放出來的話值班表不用登記，所以常常是這樣）
    const cells = isIntakeTouched(entry.intake) ? intakeCells(entry.intake) : null;
    const byLabel = Object.fromEntries((cells || []).map((c) => [c.label, c]));

    return visibleCols.value.map((col) => {
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
// 欄位可以自選，開滿時手機放不下，所以整張表可以左右捲
.hr-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.hr-table {
    width: 100%;
    // 欄位全開時至少要這麼寬（班別 92 ＋ 四個 52 ＋ 兩個 80 ＋ 68），
    // 不夠就讓它捲，不要把欄位擠扁
    min-width: 530px;
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

    th:first-child,
    td:first-child {
        border-left: 1px solid #e4e2e0;
    }

    th {
        padding: 8px 4px;
        background: #f5f7f8;
        color: #657181;
        font-weight: 600;
        // 表頭不折行 —— 放不下就左右捲，折行會讓表頭高度跟著欄位數跳動
        white-space: nowrap;
        // 全站的 body 是 text-align: center，但表格這邊會被其他規則蓋掉，寫明確一點
        text-align: center;
    }

    td {
        height: 40px;
        padding: 6px 4px;
        color: #303133;
        text-align: center;
        vertical-align: middle;
    }

    tbody tr:nth-child(even) td {
        background: #fafafa;
    }

    // 只指定班別欄（固定像素，不用 %，才不會隨欄位數縮水），其餘平分剩下的
    .hr-shift-col {
        width: 92px;
    }

    // 左右捲的時候班別要黏在左邊，不然捲到右邊就不知道在看哪一班。
    // sticky 的格子一定要有底色，否則會透出捲過去的內容
    .hr-shift-col,
    .hr-shift {
        position: sticky;
        left: 0;
        z-index: 1;
    }

    // 捲動時才加陰影，標出班別欄是黏住的。
    // 用右側的 box-shadow（負的擴散值把上下收掉），看起來像一道邊界而不是整欄浮起來
    .hr-scroll.stuck & {
        .hr-shift-col,
        .hr-shift {
            box-shadow: 4px 0 6px -3px rgb(0 0 0 / 20%);
        }
    }

    .hr-shift {
        background: #fff;
        white-space: nowrap;
        font-weight: 600;

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
