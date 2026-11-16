<template>
    <ClientOnly>
        <div v-loading="loading" id="shift">
            <form @submit.prevent="saveNow">
                <!-- 標題靠左；右邊是「‹ 10/19 週日 早班 ›」：箭頭跳前後一班，點中間從下方滑出選擇面板 -->
                <div class="shift-header">
                    <h1>值班記錄表</h1>
                    <div class="shift-nav">
                        <button
                            type="button"
                            class="nav-btn"
                            aria-label="上一班"
                            :disabled="!canGo(prevOf(viewing))"
                            @click="goTo(prevOf(viewing))"
                        >
                            ‹
                        </button>
                        <button type="button" class="current-btn" @click="openPicker">
                            {{ shiftTitle(viewing) }}
                        </button>
                        <button
                            type="button"
                            class="nav-btn"
                            aria-label="下一班"
                            :disabled="!canGo(nextOf(viewing))"
                            @click="goTo(nextOf(viewing))"
                        >
                            ›
                        </button>
                    </div>
                </div>

                <!-- 分頁：依值班的時間順序 -->
                <div class="tabs" role="tablist">
                    <button
                        v-for="t in tabList"
                        :key="t.value"
                        type="button"
                        role="tab"
                        :aria-selected="tab === t.value"
                        :class="{ active: tab === t.value }"
                        @click="setTab(t.value)"
                    >
                        {{ t.label }}
                        <span v-if="t.remaining" class="remaining">{{
                            t.remaining
                        }}</span>
                    </button>
                </div>

                <!-- ========== 觀察：上一班放的飯吃了多少、排泄 ========== -->
                <div v-show="tab === 'arrive'" class="W100">
                    <div
                        v-for="cat in formData.cats"
                        :key="cat.cat_id"
                        class="d_flex record_item intake-card"
                        :class="{ compact: !showIntake(cat) }"
                    >
                        <div class="name-wrap">
                            <NuxtLink :to="`/cats/${cat.cat_id}`" class="name">{{ cat.name }}</NuxtLink>
                            <!-- 觀察管理：剛到班要拍的照片，接在貓名後面。上一班放風的卡片右邊有放風標籤，手機上只擠得下一個膠囊，
                                 兩個以上改放下一行（同備餐分頁）。
                                 點了就打勾（變藍 ✓、記誰幾點），再點取消。2026-11-12 起拿掉照片，改成打勾（以前的班照舊看那一班有沒有拍對應的照片） -->
                            <button
                                v-for="row in observeInline(cat) ? observeRowsOf(cat) : []"
                                :key="row.key"
                                type="button"
                                class="observe-chip"
                                :class="{ done: row.done }"
                                :aria-pressed="row.done"
                                :disabled="isDisabled"
                                @click="toggleObserve(cat, row, !row.done)"
                            >
                                <Icon :icon="row.done ? 'mdi:check' : 'mdi:camera-outline'" width="14" />{{ row.label }}
                            </button>
                        </div>
                        <!-- 上一班放風：貓沒關籠，吃多少、排泄看不出來，預設不登記，卡片只剩一行；
                             有看到的話按「仍要登記」展開。已經填過的會自動展開 -->
                        <div v-if="cat.prev_released" class="released-row">
                            <el-tag type="warning" size="small">上一班放風</el-tag>
                            <!-- 收起時：沒填過寫「仍要登記」，填過寫「已登記」；展開時都可以「收起」 -->
                            <button
                                type="button"
                                class="released-toggle"
                                @click="toggleIntake(cat)"
                            >
                                {{
                                    showIntake(cat)
                                        ? '收起'
                                        : intakeTouched(cat)
                                          ? '已登記 ›'
                                          : '仍要登記 ›'
                                }}
                            </button>
                        </div>
                        <!-- 名字那列下面：上一班放風、要拍兩個以上的膠囊（後台寫的說明不顯示） -->
                        <div v-if="!observeInline(cat) && observeRowsOf(cat).length" class="observe-row">
                            <div class="observe-chips">
                                <button
                                    v-for="row in observeRowsOf(cat)"
                                    :key="row.key"
                                    type="button"
                                    class="observe-chip"
                                    :class="{ done: row.done }"
                                    :aria-pressed="row.done"
                                    :disabled="isDisabled"
                                    @click="toggleObserve(cat, row, !row.done)"
                                >
                                    <Icon :icon="row.done ? 'mdi:check' : 'mdi:camera-outline'" width="14" />{{ row.label }}
                                </button>
                            </div>
                        </div>
                        <div v-if="showIntake(cat)" class="detail intake">
                            <!-- 食物 - 乾 -->
                            <div class="feed food d_flex">
                                <p class="f_blue">食物</p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.intake.feed"
                                        :disabled="isDisabled"
                                        @change="
                                            foodHandler(cat, 'feed');
                                            saveIntake(cat);
                                        "
                                        >乾</el-checkbox
                                    >
                                    <!-- 沒勾也可以直接點、拖拉，會自動勾起來 -->
                                    <div
                                        class="intake-slider"
                                        :class="{ off: !cat.intake.feed }"
                                        @pointerdown.capture="checkFoodBySlider(cat, 'feed')"
                                    >
                                        <el-slider
                                            v-model="cat.intake.feed_detail"
                                            :step="25"
                                            :marks="marks"
                                            :show-tooltip="false"
                                            :disabled="isDisabled"
                                            @change="saveIntake(cat)"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- 食物 - 罐 -->
                            <div class="can food d_flex">
                                <p class="f_blue"></p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.intake.can"
                                        :disabled="isDisabled"
                                        @change="
                                            foodHandler(cat, 'can');
                                            saveIntake(cat);
                                        "
                                        >罐</el-checkbox
                                    >
                                    <!-- 沒勾也可以直接點、拖拉，會自動勾起來 -->
                                    <div
                                        class="intake-slider"
                                        :class="{ off: !cat.intake.can }"
                                        @pointerdown.capture="checkFoodBySlider(cat, 'can')"
                                    >
                                        <el-slider
                                            v-model="cat.intake.can_detail"
                                            :step="25"
                                            :marks="marks"
                                            :show-tooltip="false"
                                            :disabled="isDisabled"
                                            @change="saveIntake(cat)"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- 排泄 -->
                            <div class="excretion d_flex">
                                <p class="f_blue">排泄</p>
                                <div class="d_flex">
                                    <div class="W40 d_flex">
                                        <el-checkbox
                                            v-model="cat.intake.urine"
                                            :disabled="isDisabled"
                                            @change="saveIntake(cat)"
                                            >尿</el-checkbox
                                        >
                                        <el-checkbox
                                            v-model="cat.intake.feces"
                                            :disabled="isDisabled"
                                            @change="
                                                fecesHandler(cat);
                                                saveIntake(cat);
                                            "
                                            >便</el-checkbox
                                        >
                                    </div>
                                    <div class="W60 d_flex">
                                        <el-radio-group
                                            v-model="cat.intake.feces_warning"
                                            :disabled="isDisabled || !cat.intake.feces"
                                            @change="saveIntake(cat)"
                                        >
                                            <el-radio value="正常">正常</el-radio>
                                            <el-radio value="軟便">軟便</el-radio>
                                            <el-radio value="拉稀">拉稀</el-radio>
                                        </el-radio-group>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 醫療：醫療管理的項目（醫療、餵藥、外用），只列有事項的貓 ========== -->
                <template v-for="section in medicalSections" :key="section.tab">
                    <div v-show="tab === section.tab" class="W100">
                        <!-- 兩區都有時各加小標題：貓咪／全員與位置（同後台） -->
                        <div v-if="section.cats.length && section.taskGroups.length" class="section-title">
                            貓咪
                        </div>
                        <div
                            v-for="entry in section.cats"
                            :key="entry.cat.cat_id"
                            class="d_flex record_item"
                        >
                            <div class="name-wrap">
                                <NuxtLink :to="`/cats/${entry.cat.cat_id}`" class="name">{{ entry.cat.name }}</NuxtLink>
                            </div>
                            <div class="detail">
                                <div
                                    v-for="(item, index) in entry.items"
                                    :key="item.id"
                                    class="d_flex item-row med-row"
                                    :class="{ divided: index > 0 }"
                                >
                                    <p class="f_blue">{{ item.category || '事項' }}</p>
                                    <div class="d_flex">
                                        <div class="txt">
                                            <font class="treatment">{{ item.treatment }}</font>
                                            <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                            <font v-if="item.end_date" class="f_grey"
                                                >療程至 {{ $dayjs(item.end_date).format('MM/DD') }}</font
                                            >
                                            <CareItemPhotos :paths="itemPhotos('medical', item)" :label="item.treatment" />
                                        </div>
                                        <div class="done">
                                            <el-checkbox
                                                v-if="showCheckHint"
                                                class="task-check"
                                                v-model="item.done"
                                                :disabled="isDisabled"
                                                @change="
                                                    stampDone(item);
                                                    saveCatItem(entry.cat, 'medical', item);
                                                "
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="section.cats.length && section.taskGroups.length" class="section-title later">
                            全員與位置
                        </div>

                        <!-- 不屬於單一貓咪的項目（全員、某個位置） -->
                        <div
                            v-for="group in section.taskGroups"
                            :key="group.name"
                            class="d_flex record_item"
                        >
                            <div class="name">{{ group.name }}</div>
                            <div class="detail">
                                <div
                                    v-for="(item, index) in group.items"
                                    :key="item.key"
                                    class="d_flex item-row med-row"
                                    :class="{ divided: index > 0 }"
                                >
                                    <p class="f_blue">{{ item.category || '事項' }}</p>
                                    <div class="d_flex">
                                        <div class="txt">
                                            <font class="treatment">{{ item.treatment }}</font>
                                            <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                            <CareItemPhotos :paths="itemPhotos('medical', item)" :label="item.treatment" />
                                        </div>
                                        <div class="done">
                                            <el-checkbox
                                                v-if="showCheckHint"
                                                class="task-check"
                                                v-model="item.done"
                                                :disabled="isDisabled"
                                                @change="
                                                    stampDone(item);
                                                    saveTask(item);
                                                "
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <el-empty
                            v-if="section.cats.length === 0 && section.taskGroups.length === 0"
                            :description="section.empty"
                        />
                    </div>
                </template>

                <!-- ========== 備餐：乾乾、罐罐、隨餐藥、補充品、放風、其他，放風按鈕。全員／位置的飲食併進適用的貓 ========== -->
                <div v-show="tab === 'meal'" class="W100">
                    <div
                        v-for="entry in leaveCats"
                        :key="entry.cat.cat_id"
                        class="d_flex record_item"
                    >
                        <div class="name-wrap">
                            <NuxtLink :to="`/cats/${entry.cat.cat_id}`" class="name">{{ entry.cat.name }}</NuxtLink>
                            <!-- 觀察管理的「離開要拍」（拍留餐…）：只有一個就接在貓名後面；兩個以上放下一行（右邊有放風鈕） -->
                            <template v-if="observeRowsOf(entry.cat, 'meal').length === 1">
                                <button
                                    v-for="row in observeRowsOf(entry.cat, 'meal')"
                                    :key="row.key"
                                    type="button"
                                    class="observe-chip"
                                    :class="{ done: row.done }"
                                    :aria-pressed="row.done"
                                    :disabled="isDisabled"
                                    @click="toggleObserve(entry.cat, row, !row.done)"
                                >
                                    <Icon :icon="row.done ? 'mdi:check' : 'mdi:camera-outline'" width="14" />{{ row.label }}
                                </button>
                            </template>
                        </div>
                        <!-- 放風：離開時沒有關籠，下一班在飲食如廁分頁會看到。貓名同一列最右邊的膠囊按鈕 -->
                        <button
                            type="button"
                            class="release-pill"
                            :class="{ on: entry.cat.released }"
                            :aria-pressed="entry.cat.released"
                            :disabled="isDisabled"
                            @click="toggleReleased(entry.cat)"
                        >
                            {{ entry.cat.released ? '✓ 放風' : '放風' }}
                        </button>
                        <!-- 名字那列下面：離開要拍兩個以上的膠囊（後台寫的說明不顯示） -->
                        <div v-if="observeRowsOf(entry.cat, 'meal').length > 1" class="observe-row">
                            <div class="observe-chips">
                                <button
                                    v-for="row in observeRowsOf(entry.cat, 'meal')"
                                    :key="row.key"
                                    type="button"
                                    class="observe-chip"
                                    :class="{ done: row.done }"
                                    :aria-pressed="row.done"
                                    :disabled="isDisabled"
                                    @click="toggleObserve(entry.cat, row, !row.done)"
                                >
                                    <Icon :icon="row.done ? 'mdi:check' : 'mdi:camera-outline'" width="14" />{{ row.label }}
                                </button>
                            </div>
                        </div>
                        <div class="detail">
                            <!-- 乾乾、罐罐、補充品、放風、其他：只看不打勾；隨餐藥（拌進飯裡）要打勾。
                                 同類別併成一列，全員／位置的標出來源 -->
                            <div
                                v-for="(row, index) in entry.dietRows"
                                :key="row.category"
                                class="d_flex item-row diet-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">{{ row.category }}</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <!-- 文字一律齊左；全員／位置的來源標籤靠右成一欄 -->
                                        <!-- 同一類別有兩項以上時加序號，才分得出是兩項還是一項換行 -->
                                        <div v-for="(it, n) in row.items" :key="it.key" class="diet-item">
                                            <div class="diet-line">
                                                <span v-if="row.items.length > 1" class="diet-no">{{ n + 1 }}.</span>
                                                <span class="diet-text">{{ it.text }}</span>
                                                <span v-if="it.source" class="source-chip">{{
                                                    it.source
                                                }}</span>
                                                <el-checkbox
                                                    v-if="showCheckHint && isMealMed(it.item)"
                                                    v-model="it.item.done"
                                                    class="task-check diet-done"
                                                    :disabled="isDisabled"
                                                    @change="
                                                        stampDone(it.item);
                                                        saveDietItem(entry.cat, it);
                                                    "
                                                />
                                            </div>
                                            <CareItemPhotos :paths="itemPhotos(it.kind, it.item)" :label="it.text" />
                                            <div v-if="it.item.end_date" class="diet-note">
                                                至 {{ $dayjs(it.item.end_date).format('MM/DD') }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="entry.dietRows.length === 0" class="d_flex item-row diet-row">
                                <p class="f_blue">飲食</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <font class="f_grey">尚未設定飲食</font>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ========== 回報：每個分頁一段大家共編，下一班在同一個分頁的這裡看得到。
                     備餐沒有回報（2026-11-12 起，連 LINE 發送一起拿掉；以前的備餐回報資料留著） ========== -->
                <div v-if="REPORT_TABS.includes(tab)" class="W100 mb20 report">
                    <!-- 跟上面的貓咪、項目分開：小標題＋細線 -->
                    <div class="section-title report-title">回報</div>
                    <!-- 前一班同一個分頁的回報，放在寫自己的回報之前（2026-11-12 起分頁最上面不再放前班區塊與未完成） -->
                    <ShiftReportBlock v-bind="prevBlock(tab)" />
                    <!-- 這一班、這個分頁的回報：大家共編一段（2026-11-12 起，以前是一人一段）。後存的蓋過先存的，
                         所以別人正在打字時上面提示「○○ 正在編輯…」。輸入框、儲存列收在同一張卡片 -->
                    <div class="my-report">
                        <div v-if="editingNames.length" class="mr-editing">
                            <span class="mr-editing-dot"></span>{{ editingNames.join('、') }} 正在編輯…
                        </div>
                        <el-input
                            type="textarea"
                            v-model="drafts[tab]"
                            :disabled="isDisabled"
                            :autosize="{ minRows: 3, maxRows: 12 }"
                            placeholder="寫給下一班…"
                            @input="saveReport(tab)"
                            @blur="stopTyping(tab)"
                        />
                        <!-- 改完會自動儲存；按鈕讓人確定有存到，失敗時也在這裡重試 -->
                        <div class="mr-foot">
                            <span class="save-hint" :class="[saveStatus, { saved: saveHint.startsWith('✓') }]">{{
                                saveHint
                            }}</span>
                            <button
                                type="submit"
                                class="save-btn"
                                :disabled="isDisabled || saveStatus === 'saving'"
                            >
                                {{ saveStatus === 'saving' ? '儲存中…' : '儲存' }}
                            </button>
                        </div>
                    </div>

                    <!-- 把這個分頁的回報推到 LINE 群組（每個分頁各發各的，不合在一起） -->
                    <button
                        type="button"
                        class="btn line-green"
                        v-show="!isDisabled"
                        @click="sendTabToLine"
                    >
                        {{ loadingNotify ? '發送中…' : 'LINE 發送至群組' }}
                    </button>
                </div>

                <!-- ========== 每個分頁共用：儲存狀態、連結 ========== -->
                <div class="W100">
                    <div class="d_flex space-between">
                        <p class="last-update">
                            即時更新：{{
                                lastUpdatedAt
                                    ? $dayjs(lastUpdatedAt).format('HH:mm:ss')
                                    : ''
                            }}
                        </p>
                        <p class="last-saved">
                            成功儲存：{{
                                lastSavedAt
                                    ? $dayjs(lastSavedAt).format('HH:mm:ss')
                                    : '尚無變更'
                            }}
                        </p>
                    </div>

                    <NuxtLink class="f_red" :to="tabPath(tab)">回到現在這一班</NuxtLink>
                </div>
            </form>

            <!-- 選擇要看的班：從下方滑出。快速前往一鍵就到；其他日期用手機內建的日期選擇器（不會跳鍵盤） -->
            <el-drawer
                v-model="pickerOpen"
                direction="btt"
                size="auto"
                :with-header="false"
                class="shift-picker-drawer"
            >
                <div class="sp-head">
                    <span class="sp-title">選擇要看的班</span>
                    <button type="button" class="sp-close" aria-label="關閉" @click="pickerOpen = false">
                        ✕
                    </button>
                </div>

                <div class="sp-label">快速前往</div>
                <div class="sp-chips">
                    <button
                        v-for="item in quickShifts"
                        :key="`${item.date}-${item.shift}`"
                        type="button"
                        class="sp-chip"
                        :class="{ on: sameShift(item, viewing) }"
                        @click="goTo(item)"
                    >
                        {{ item.label }}
                    </button>
                </div>

                <div class="sp-label">日期</div>
                <input
                    v-model="pick.date"
                    type="date"
                    class="sp-date"
                    :min="minDate"
                    :max="todayStr()"
                    @change="onPickDate"
                />

                <div class="sp-label">班別</div>
                <div class="sp-seg">
                    <button
                        type="button"
                        :class="{ on: pick.shift === 'morning' }"
                        @click="pick.shift = 'morning'"
                    >
                        早班
                    </button>
                    <button
                        type="button"
                        :class="{ on: pick.shift === 'night' }"
                        :disabled="nightLocked(pick.date)"
                        @click="pick.shift = 'night'"
                    >
                        {{ nightLocked(pick.date) ? '晚班（18:00 後）' : '晚班' }}
                    </button>
                </div>

                <button
                    type="button"
                    class="sp-go"
                    :disabled="!canGo(pick)"
                    @click="goTo(pick)"
                >
                    前往
                </button>
            </el-drawer>

            <!-- LINE 發送前的確認：要發的文字（這個分頁的回報）。超過 LINE 一則 5000 字會自動分成幾則 -->
            <el-dialog
                :model-value="!!linePush"
                title="發送至 LINE 群組"
                width="90%"
                class="line-push-dialog"
                align-center
                append-to-body
                @update:model-value="(v) => !v && closeLinePush(false)"
            >
                <template v-if="linePush">
                    <div v-if="linePush.chunks > 1" class="lp-warn">
                        內容有 {{ linePush.text.length }} 字，超過 LINE 一則 {{ LINE_TEXT_MAX }} 字，會分成
                        {{ linePush.chunks }} 則發送。
                    </div>
                    <div class="lp-text">{{ linePush.text }}</div>
                </template>
                <template #footer>
                    <div class="pd-confirm">
                        <button type="button" class="pd-cancel" @click="closeLinePush(false)">取消</button>
                        <button type="button" class="pd-add" @click="closeLinePush(true)">發送</button>
                    </div>
                </template>
            </el-dialog>
        </div>

        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
// 新版值班記錄表：一個班一筆 shifts，合併飲食如廁、醫療照護、備餐三個分頁（收尾、留言、照片 2026-11-12 拿掉了）。
// 資料來自新版的 cat_profiles 與飲食／醫療／待辦管理；/regular、/medicine 維持原樣，兩邊不互通。
// 存檔是「局部更新」：每改一格只送那一格（saveIntake、saveCatItem…），
// 兩個人同時改不同的貓或項目不會互相覆蓋
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { debounce, throttle } from 'lodash-es';
import Swal from 'sweetalert2';

// 網址：分頁在路徑（飲食如廁 /shift、醫療照護 /shift/care、備餐 /shift/meal；收尾 /shift/required 已拿掉，會導回 /shift），
// 哪一班在 query（?date=&shift=）。key 固定：換分頁、換班都是同一個頁面，不重新掛載
definePageMeta({
    middleware: 'auth',
    key: 'shift',
});

useHead({
    title: '值班記錄表',
});

const { $dayjs } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const supabase = useSupabaseClient();
const { nickname, getUserId, isAdmin, showCheckHint, showTodoBadge } = useProfile();

// State
const loading = ref(true);
const loadingNotify = ref(false);
const saveStatus = ref('success');
const lastUpdatedAt = ref(null);
const lastSavedAt = ref(null);
const tab = ref('arrive');
const prev = ref({ date: null, shift: null, reports: {}, released: [], unfinished: {} });

const marks = INTAKE_MARKS; // composables/intake.js（貓咪檔案的時間軸也用）

const formData = ref({
    recordId: '',
    date: new Date(),
    shift: '',
    cats: [], // [{ cat_id, name, location, sort, intake, released, medical: [], diet: [], observe: [] }]
    tasks: [], // [{ key, kind, id, location, ... }]，kind：medical / diet / observe（以前的班可能還有 required 收尾，不顯示）
    reports: {}, // { 分頁: { _shared: { name, text, at } } }：每個分頁一段共編（以前的班是 { user_id: { name, text, at } } 一人一段）
});

// 每個分頁的回報（輸入框綁這份，大家共編同一段）
const drafts = ref({});
const me = computed(() => getUserId() || null);

// 回報 2026-11-12 起每個分頁一段大家共編，存在 reports.<分頁>._shared（server/api/shift/update.post.js）
const SHARED_REPORT = '_shared';

// 一個分頁的回報文字：有共編的那段就用它；還沒有的（以前一人一段），照時間合併成一段，
// 兩段以上每段前面寫名字（舊格式沒有名字的寫「舊資料」），大家再自己整理
function reportTextOf(reports, key) {
    const byKey = reports?.[key] || {};
    if (byKey[SHARED_REPORT]) return byKey[SHARED_REPORT].text || '';
    const entries = Object.entries(byKey)
        .map(([, r]) => ({ name: r?.name, text: (r?.text || '').trim(), at: r?.at || '' }))
        .filter((r) => r.text)
        .sort((a, b) => a.at.localeCompare(b.at));
    if (entries.length <= 1) return entries[0]?.text || '';
    return entries.map((e) => `${e.name || '舊資料'}：\n${e.text}`).join('\n\n');
}

// ---- 資料轉換：資料庫存的是以 id 為 key 的物件，畫面用排好順序的陣列 ----
const MAX = Number.MAX_SAFE_INTEGER;
const bySort = (a, b) => (a.sort ?? MAX) - (b.sort ?? MAX);
const sortedValues = (obj) => Object.values(obj || {}).sort(bySort);

function defaultIntake() {
    return {
        feed: true,
        feed_detail: 0,
        can: false,
        can_detail: 0,
        urine: false,
        feces: false,
        feces_warning: null,
    };
}

function normalize(rawCats, rawTasks) {
    const cats = Object.values(rawCats || {})
        .filter((c) => c.name)
        .map((c) => ({
            cat_id: c.cat_id,
            name: c.name,
            location: c.location ?? null,
            sort: c.sort ?? MAX,
            intake: { ...defaultIntake(), ...(c.intake || {}) },
            released: !!c.released,
            prev_released: !!c.prev_released,
            medical: sortedValues(c.medical),
            diet: sortedValues(c.diet),
            observe: sortedValues(c.observe),
            // 觀察管理的打勾 { 項目 id: { done_by, done_at } | null }
            observe_done: { ...(c.observe_done || {}) },
        }))
        .sort(bySort);
    const tasks = Object.entries(rawTasks || {})
        .map(([key, t]) => ({ ...t, key }))
        .sort(bySort);
    return { cats, tasks };
}

// ---- 局部更新：改動先排進佇列，0.5 秒內的合併成一次送出 ----
// key 是「欄位|路徑」，同一格連續改只送最後一次
const queued = new Map();
const inflight = new Set();
const isPending = ref(false);

const opKey = (op) => `${op.column}|${(op.path || []).join('/')}${op.if_missing ? '?' : ''}`;
const busy = (column, path) => {
    const key = `${column}|${path.join('/')}`;
    return queued.has(key) || inflight.has(key);
};

function queue(ops) {
    if (isDisabled.value) return;
    for (const op of ops) queued.set(opKey(op), op);
    isPending.value = true;
    flushSoon();
}

const flushSoon = debounce(flush, 500);

async function flush() {
    if (!formData.value.recordId || queued.size === 0) return;
    const entries = [...queued.entries()];
    queued.clear();
    entries.forEach(([key]) => inflight.add(key));
    try {
        saveStatus.value = 'saving';
        const res = await $fetch('/api/shift/update', {
            method: 'POST',
            body: { recordId: formData.value.recordId, ops: entries.map(([, op]) => op) },
        });
        // 存好了：記進自己這份原始資料，再廣播給其他開著這一班的人（他們照路徑套上）
        applyOpsToRaw(res.ops || []);
        broadcastShift('ops', { ops: res.ops || [] });
        notifyCatsOfOps(formData.value.recordId, res.ops || []);
        saveStatus.value = 'success';
        lastSavedAt.value = new Date();
    } catch (e) {
        console.error('flush error:', e);
        saveStatus.value = 'error';
        // 失敗的放回佇列等重試；期間又改過的以新的為準
        for (const [key, op] of entries) if (!queued.has(key)) queued.set(key, op);
    } finally {
        entries.forEach(([key]) => inflight.delete(key));
        isPending.value = queued.size > 0;
    }
}

// 貓還不在這班的記錄裡（例如今天才新增的貓）時先補上基本資料，已經有就不動
const catBase = (cat) => ({
    column: 'cats',
    path: [String(cat.cat_id)],
    value: { cat_id: cat.cat_id, name: cat.name, location: cat.location, sort: cat.sort },
    if_missing: true,
});

function saveIntake(cat) {
    queue([
        catBase(cat),
        { column: 'cats', path: [String(cat.cat_id), 'intake'], value: { ...cat.intake } },
    ]);
}

function toggleReleased(cat) {
    cat.released = !cat.released;
    queue([
        catBase(cat),
        { column: 'cats', path: [String(cat.cat_id), 'released'], value: cat.released },
    ]);
}

// 打勾時記下誰（登入者的暱稱）、幾點；取消就清掉。2026-11-12 起畫面不顯示，只存著
function stampDone(item) {
    item.done_by = item.done ? nickname.value || '未命名' : null;
    item.done_at = item.done ? new Date().toISOString() : null;
}

function saveCatItem(cat, list, item) {
    queue([
        catBase(cat),
        { column: 'cats', path: [String(cat.cat_id), list, String(item.id)], value: { ...item } },
    ]);
}

function saveTask(task) {
    const { key, ...value } = task;
    queue([{ column: 'tasks', path: [key], value }]);
}

// 回報只送內容；最後編輯者與時間由 server 填。整段送出，後存的蓋過先存的。
// 本地也先更新，發送到 LINE 才拿得到最新的；同時告訴開著這一班的人「我正在編輯」
function saveReport(key) {
    if (!me.value) return;
    const text = drafts.value[key] || '';
    const reports = formData.value.reports;
    reports[key] = { ...(reports[key] || {}), [SHARED_REPORT]: { name: nickname.value, text, at: new Date().toISOString() } };
    queue([{ column: 'reports', path: [key, SHARED_REPORT], value: { text } }]);
    sendTyping(key);
}

// 儲存按鈕：馬上送出還沒送的改動
async function saveNow() {
    flushSoon.cancel();
    if (queued.size === 0) {
        if (saveStatus.value !== 'error') lastSavedAt.value = new Date();
        return;
    }
    await flush();
}

const saveHint = computed(() => {
    if (saveStatus.value === 'error') return '儲存失敗，請再按一次儲存';
    if (saveStatus.value === 'saving') return '';
    if (isPending.value) return '有變更尚未儲存';
    return lastSavedAt.value ? `✓ 已儲存 ${$dayjs(lastSavedAt.value).format('HH:mm')}` : '';
});

// 別人存檔：把對方改的值套進畫面，自己還沒送出的格子不動
function mergeRemote(row) {
    const remote = normalize(row.cats, row.tasks);
    const local = formData.value;

    for (const rc of remote.cats) {
        const id = String(rc.cat_id);
        const lc = local.cats.find((c) => c.cat_id === rc.cat_id);
        if (!lc) {
            local.cats.push(rc);
            continue;
        }
        const raw = row.cats[id] || {};
        if (raw.intake && !busy('cats', [id, 'intake'])) lc.intake = rc.intake;
        if ('released' in raw && !busy('cats', [id, 'released'])) lc.released = rc.released;
        if ('prev_released' in raw) lc.prev_released = rc.prev_released;
        for (const [itemId, value] of Object.entries(raw.observe_done || {})) {
            if (busy('cats', [id, 'observe_done', itemId])) continue;
            lc.observe_done = { ...lc.observe_done, [itemId]: value };
        }
        for (const list of ['medical', 'diet']) {
            for (const ri of rc[list]) {
                if (busy('cats', [id, list, String(ri.id)])) continue;
                const li = lc[list].find((i) => i.id === ri.id);
                if (!li) lc[list].push(ri);
                else if ('done' in ri) Object.assign(li, pickDone(ri));
            }
        }
    }
    local.cats.sort(bySort);

    for (const rt of remote.tasks) {
        if (busy('tasks', [rt.key])) continue;
        const lt = local.tasks.find((t) => t.key === rt.key);
        if (!lt) local.tasks.push(rt);
        else if ('done' in rt) Object.assign(lt, pickDone(rt));
    }

    // 共編的回報：自己還沒送出的改動優先（busy），其他時候別人存的直接換上
    for (const [key, byKey] of Object.entries(row.reports || {})) {
        const entry = byKey?.[SHARED_REPORT];
        if (!entry || busy('reports', [key, SHARED_REPORT])) continue;
        local.reports[key] = { ...(local.reports[key] || {}), [SHARED_REPORT]: entry };
        drafts.value[key] = entry.text || '';
    }
}

const pickDone = ({ done, done_by, done_at }) => ({
    done: !!done,
    done_by: done_by ?? null,
    done_at: done_at ?? null,
});

const TABS = ['arrive', 'care', 'meal'];
// 有回報的分頁：備餐 2026-11-12 起不用回報
const REPORT_TABS = ['arrive', 'care'];
const SHIFT_LABELS = { morning: '早班', night: '晚班' };
const TAB_LABELS = { arrive: '飲食如廁', care: '醫療照護', meal: '備餐' };

// 以前的班（2026-11-12 之前）沒有觀察的打勾，照舊看那一班飲食如廁、備餐分頁有沒有拍對應的照片。
// 值班表的留言、照片 2026-11-12 拿掉了，這裡只讀判斷要的欄位
const legacyPhotos = ref([]);
const photosOf = (catId, key) => legacyPhotos.value.filter((p) => p.cat_id === catId && p.tab === key);

async function loadLegacyPhotos(recordId) {
    const { data, error } = await supabase
        .from('shift_photos')
        .select('cat_id, tab, kinds')
        .eq('shift_id', recordId)
        .in('tab', ['arrive', 'meal']);
    if (error) console.error('load legacy photos error:', error);
    else if (recordId === formData.value.recordId) legacyPhotos.value = data;
}

// ---- 分頁內容 ----

// 不屬於單一貓咪的項目照位置分組，排序是全員 → 貓屋 → 位置（placeRank，跟後台一致）
function groupTasks(filter) {
    const map = new Map();
    for (const task of formData.value.tasks.filter(filter)) {
        const name = placeName(task.location);
        if (!map.has(name)) map.set(name, { name, location: task.location, items: [] });
        map.get(name).items.push(task);
    }
    return [...map.values()].sort((a, b) => placeRank(a.location) - placeRank(b.location));
}

// 醫療照護分頁：醫療管理的所有項目（醫療、餵藥、外用、隨餐藥），每一項左邊標類別。
// 隨餐藥（拌進飯裡）備餐分頁也列，兩邊是同一個物件，勾哪邊都一樣
const medicalSections = computed(() =>
    [{ tab: 'care', match: () => true, empty: '這一班沒有醫療事項' }].map(({ tab, match, empty }) => ({
        tab,
        empty,
        cats: formData.value.cats
            .map((cat) => ({ cat, items: cat.medical.filter(match) }))
            .filter((entry) => entry.items.length > 0),
        taskGroups: groupTasks((t) => t.kind === 'medical' && match(t)),
    }))
);

// 備餐：全員的飲食併進每隻貓，位置的併進那個位置的貓。只有隨餐藥要打勾，其他只看。
// 隨餐藥 2026-11-12 起是醫療管理的項目（kind: medical，跟醫療照護分頁共用同一個物件，打勾連動）；
// 以前的班快照裡還有飲食的隨餐藥（kind: diet），照舊列
// 同類別排在一起：乾乾 → 罐罐 → 隨餐藥 → 補充品 → 放風 → 其他；同類別裡自己的在前、全員／位置的在後（sort 是穩定的）
const DIET_ORDER = { 乾乾: 0, 罐罐: 1, 隨餐藥: 2, 補充品: 3, 放風: 4, 其他: 5 };
const isMealMed = (item) => item.category === '隨餐藥';
const byDietOrder = (a, b) => (DIET_ORDER[a.category] ?? 9) - (DIET_ORDER[b.category] ?? 9);

// 已照類別排好的清單，相鄰同類別的併成 { category, items }
function groupByCategory(list) {
    const rows = [];
    for (const item of list) {
        const last = rows[rows.length - 1];
        if (last && last.category === item.category) last.items.push(item);
        else rows.push({ category: item.category, items: [item] });
    }
    return rows;
}

const appliesTo = (task, cat) => !task.location || task.location === cat.location;

// 觀察管理：值班時要做的事。剛到的（拍剩食、拍貓砂）在飲食如廁分頁，離開的（拍留餐）在備餐分頁。
// 貓自己的＋全員／位置的；打勾記在這隻貓的 observe_done（以前的班沒有勾，看那一班的照片）
// label 是膠囊上的字（拍剩食→剩食，前面有相機圖示；以前的「其他」是說明）。後台寫的說明值班表不顯示
const observeRows = computed(() => {
    const tasks = formData.value.tasks.filter((t) => t.kind === 'observe');
    const map = new Map();
    for (const cat of formData.value.cats) {
        const items = [
            ...cat.observe.map((i) => ({ key: `observe-${i.id}`, item: i })),
            ...tasks.filter((t) => appliesTo(t, cat)).map((t) => ({ key: t.key, item: t })),
        ];
        map.set(
            cat.cat_id,
            items.map(({ key, item }) => {
                const tab = observeTabOf(item.category);
                const other = isObserveOther(item.category);
                return {
                    key,
                    tab,
                    category: item.category,
                    id: item.id,
                    label: other ? item.content || '其他' : item.category.replace(/^拍/, ''),
                    done: isObserveDone(item.category, photosOf(cat.cat_id, tab), cat.observe_done[item.id]),
                };
            })
        );
    }
    return map;
});
// 關掉「檢核提示」就回空陣列。膠囊的 v-for 與外層 v-if 的判斷都走這個函式，
// 所以一個地方關掉，飲食如廁與備餐兩個分頁、接在貓名後與另起一列的四種情況全都不顯示。
const observeRowsOf = (cat, tab = 'arrive') =>
    showCheckHint.value ? (observeRows.value.get(cat.cat_id) || []).filter((r) => r.tab === tab) : [];
// 飲食如廁分頁：膠囊接在貓名後面；上一班放風的卡片右邊有放風標籤，只有一個膠囊才擠得下
const observeInline = (cat) => !cat.prev_released || observeRowsOf(cat).length <= 1;
// ---- 照護項目的附圖（後台飲食、醫療管理加的）：值班表的快照只記項目 id，附圖直接讀項目表，
// 後台換了照片這裡馬上看得到。key 是「種類:id」，例如 medical:12 ----
const ITEM_PHOTO_TABLES = { diet: 'diet_items', medical: 'medical_items' };
const careItemPhotos = ref({});
const itemPhotos = (kind, item) => careItemPhotos.value[`${kind}:${item.id}`] || [];

async function loadItemPhotos() {
    try {
        const results = await Promise.all(
            Object.entries(ITEM_PHOTO_TABLES).map(async ([kind, table]) => {
                const { data, error } = await supabase.from(table).select('id, photos').neq('photos', '{}');
                if (error) throw error;
                return data.map((row) => [`${kind}:${row.id}`, row.photos]);
            })
        );
        careItemPhotos.value = Object.fromEntries(results.flat());
    } catch (e) {
        // 讀不到附圖不影響值班表本身
        console.error('load care item photos error:', e);
    }
}

// 觀察管理打勾（點膠囊）：記在這隻貓底下的 observe_done[項目 id]，誰、幾點只存不顯示（全員／位置的項目也是每隻貓各勾各的）；取消就存 null
function toggleObserve(cat, row, checked) {
    const value = checked ? { done_by: nickname.value || '未命名', done_at: new Date().toISOString() } : null;
    cat.observe_done = { ...cat.observe_done, [row.id]: value };
    queue([
        catBase(cat),
        { column: 'cats', path: [String(cat.cat_id), 'observe_done', String(row.id)], value },
    ]);
}

// 每一項包成 { key, kind, source, item, text }：item 是原本的物件（隨餐藥打勾要改到它），kind 是 diet／medical，
// source 是全員／位置的來源標籤，text 是顯示的字（飲食的內容、醫療的事項）
const leaveCats = computed(() => {
    const dietTasks = formData.value.tasks.filter((t) => t.kind === 'diet');
    const medTasks = formData.value.tasks.filter((t) => t.kind === 'medical' && isMealMed(t));
    const wrap = (kind, item, source, key) => ({
        key,
        kind,
        source,
        item,
        category: item.category,
        text: kind === 'medical' ? item.treatment : item.content,
    });
    return formData.value.cats.map((cat) => {
        const items = [
            ...cat.diet.map((d) => wrap('diet', d, null, `diet-${d.id}`)),
            ...cat.medical.filter(isMealMed).map((m) => wrap('medical', m, null, `medical-${m.id}`)),
            ...dietTasks.filter((t) => appliesTo(t, cat)).map((t) => wrap('diet', t, placeName(t.location), t.key)),
            ...medTasks.filter((t) => appliesTo(t, cat)).map((t) => wrap('medical', t, placeName(t.location), t.key)),
        ].sort(byDietOrder);
        return { cat, dietRows: groupByCategory(items) };
    });
});

// 隨餐藥打勾：貓自己的存在那隻貓底下（醫療的在 medical、以前的在 diet）；全員／位置的是整班一份
function saveDietItem(cat, { kind, source, item }) {
    if (source) saveTask(item);
    else saveCatItem(cat, kind, item);
}

// 全員／位置的飲食只併進適用的貓；那個位置現在沒有貓的就不顯示，也不算未完成

// 回報區最上面：上一班同一個分頁的回報（上一班沒勾完的項目不再列）
function prevBlock(key) {
    const { date, shift, reports } = prev.value;
    return {
        // 標題「前班回報（10/20 晚）」；不顯示幾則
        title: date ? `前班回報（${$dayjs(date).format('MM/DD')} ${SHIFT_LABELS[shift].slice(0, 1)}）` : '前班回報',
        countLabel: '',
        // 共編的一段（以前的班一人一段的合併成一段），不寫名字與時間
        entries: reportTextOf(reports, key).trim() ? [{ key: 'shared', text: reportTextOf(reports, key) }] : [],
        // 前班每次打開頁面都收起，展開不記住（不給 storageKey）
        defaultCollapsed: true,
    };
}

// 分頁上的紅色數字：只有醫療分頁顯示（醫療一定要做完），其他分頁不顯示。
// 關掉「待辦提示」就不給 remaining，template 的 v-if 自然不渲染（2026-11-16）
const tabList = computed(() => {
    const undone = (list) => list.filter((i) => !i.done).length;
    const care = medicalSections.value.find((s) => s.tab === 'care');
    return [
        { value: 'arrive', label: TAB_LABELS.arrive },
        {
            value: 'care',
            label: TAB_LABELS.care,
            remaining: showTodoBadge.value
                ? care.cats.reduce((sum, e) => sum + undone(e.items), 0) +
                  care.taskGroups.reduce((sum, g) => sum + undone(g.items), 0)
                : 0,
        },
        { value: 'meal', label: TAB_LABELS.meal },
    ];
});

// ---- 選班：標題列的前後箭頭與下方的選擇面板。班用 { date: 'YYYY-MM-DD', shift } 表示 ----
const WEEKDAYS = '日一二三四五六';
const todayStr = () => $dayjs().format('YYYY-MM-DD');
const minDate = $dayjs(config.public.releaseDate || '2024-01-01').format('YYYY-MM-DD');

const viewing = computed(() => ({
    date: $dayjs(formData.value.date).format('YYYY-MM-DD'),
    shift: formData.value.shift || 'morning',
}));

function shiftTitle({ date, shift }) {
    const d = $dayjs(date);
    return `${d.format('MM/DD')} 週${WEEKDAYS[d.day()]} ${SHIFT_LABELS[shift]}`;
}

// 早班的上一班是前一天晚班；晚班的上一班是同一天早班
function prevOf({ date, shift }) {
    return shift === 'night'
        ? { date, shift: 'morning' }
        : { date: $dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'), shift: 'night' };
}

function nextOf({ date, shift }) {
    return shift === 'morning'
        ? { date, shift: 'night' }
        : { date: $dayjs(date).add(1, 'day').format('YYYY-MM-DD'), shift: 'morning' };
}

const sameShift = (a, b) => a.date === b.date && a.shift === b.shift;

// 今天 18:00 前不能看晚班（跟 /medicine 一樣，避免提早建立晚班的記錄）
const nightLocked = (date) => date === todayStr() && new Date().getHours() < 18;

function canGo({ date, shift }) {
    if (!date || date > todayStr() || date < minDate) return false;
    return !(shift === 'night' && nightLocked(date));
}

function nowShift() {
    return { date: todayStr(), shift: new Date().getHours() < 18 ? 'morning' : 'night' };
}

// 快速前往：現在這一班往前數四班
const quickShifts = computed(() => {
    const dayName = (date) =>
        ({ 0: '今天', 1: '昨天', 2: '前天' })[$dayjs().startOf('day').diff($dayjs(date), 'day')] ||
        $dayjs(date).format('MM/DD');
    const list = [];
    let item = nowShift();
    for (let i = 0; i < 4; i++) {
        list.push({
            ...item,
            label: i === 0 ? '現在這一班' : `${dayName(item.date)}${SHIFT_LABELS[item.shift]}`,
        });
        item = prevOf(item);
    }
    return list;
});

const pickerOpen = ref(false);
const pick = ref({ date: '', shift: 'morning' });

function openPicker() {
    pick.value = { ...viewing.value };
    pickerOpen.value = true;
}

// 換到今天、又還沒 18:00 時，晚班選不了，自動改回早班
function onPickDate() {
    if (pick.value.shift === 'night' && nightLocked(pick.value.date)) pick.value.shift = 'morning';
}

function goTo({ date, shift }) {
    if (!canGo({ date, shift })) return;
    pickerOpen.value = false;
    router.push({ path: tabPath(tab.value), query: { date, shift } });
}

// 編輯期限：照「日期」算，今天加前 N 天（DISABLED_DAYS，預設 2）的早晚班都能改。
// 例如今天 10/22：10/20、10/21、10/22 的早晚班都可以，10/19 以前不行
function isEditableDate(date) {
    const earliest = $dayjs().startOf('day').subtract(config.public.disabledDays || 2, 'day');
    return !$dayjs(date).startOf('day').isBefore(earliest);
}

const isDisabled = computed(() => !isEditableDate(formData.value.date));

// Methods
// 分頁 → 網址路徑：觀察是 /shift，其他是 /shift/<分頁>
const tabPath = (value) => (value === 'arrive' ? '/shift' : `/shift/${value}`);
// 路徑上的分頁（不認得的當成觀察）
const tabOfPath = (value) => (TABS.includes(value) ? value : 'arrive');

function setTab(value) {
    tab.value = value;
    router.replace({ path: tabPath(value), query: route.query });
}

// 上一頁、下一頁或點連結換了路徑上的分頁
watch(
    () => route.params.tab,
    (value) => (tab.value = tabOfPath(value))
);

// 上一班放風的貓：預設收起觀察欄位，已經填過的預設展開；兩種都可以自己展開或收起。
// intakeToggled 記使用者按過的狀態（cat_id → 要不要展開），沒按過就照預設
const intakeToggled = ref({});
function intakeTouched(cat) {
    const defaults = defaultIntake();
    return Object.keys(defaults).some((key) => (cat.intake[key] ?? null) !== defaults[key]);
}
const showIntake = (cat) =>
    !cat.prev_released || (intakeToggled.value[cat.cat_id] ?? intakeTouched(cat));
function toggleIntake(cat) {
    intakeToggled.value = { ...intakeToggled.value, [cat.cat_id]: !showIntake(cat) };
}

function foodHandler(cat, type) {
    cat.intake[type === 'can' ? 'can_detail' : 'feed_detail'] = 0;
}

// 乾、罐沒勾時點了拖拉條：自動勾起來（點在「沒吃」上值不會變，所以這裡先存一次）
function checkFoodBySlider(cat, type) {
    if (isDisabled.value || cat.intake[type]) return;
    cat.intake[type] = true;
    saveIntake(cat);
}

function fecesHandler(cat) {
    cat.intake.feces_warning = cat.intake.feces ? '正常' : null;
}

function InitFromQuery() {
    const { date, shift, tab: queryTab } = route.query;

    formData.value.date = date ? new Date(date) : new Date();
    formData.value.shift = ['morning', 'night'].includes(shift)
        ? shift
        : new Date().getHours() < 18
        ? 'morning'
        : 'night';
    tab.value = tabOfPath(route.params.tab);
    // 收尾分頁拿掉了：舊網址 /shift/required 換成飲食如廁
    if (route.params.tab === 'required') router.replace({ path: tabPath('arrive'), query: route.query });
    // 舊連結把分頁放在 ?tab=（還有更舊的 meds：吃藥分頁已併進醫療；leave：備餐改叫 meal）：換成路徑
    if (queryTab) {
        const wanted = { meds: 'care', leave: 'meal' }[queryTab] || queryTab;
        if (TABS.includes(wanted)) tab.value = wanted;
        const query = { ...route.query };
        delete query.tab;
        router.replace({ path: tabPath(tab.value), query });
    }
}

async function InitShift() {
    const { date, shift } = formData.value;
    const params = { date: $dayjs(date).format('YYYY-MM-DD'), shift };
    // cache: 'no-store'：同一個網址同時被請求兩次時（開兩個分頁、或直接打開過 API 網址），
    // Chrome 會讓後到的等前一個寫完快取，最多卡 20 秒。這兩支每次都要最新資料，不用快取
    const [data, prevData] = await Promise.all([
        $fetch('/api/shift', { params, cache: 'no-store' }),
        // 前一班唯讀：沒有記錄就回空的，不會建立
        $fetch('/api/shift/previous', { params, cache: 'no-store' }).catch((e) => {
            console.error('InitPrevShift error:', e);
            return null;
        }),
    ]);

    const { cats, tasks } = normalize(data.cats, data.tasks);
    formData.value.recordId = data.recordId;
    formData.value.date = new Date(data.date);
    formData.value.shift = data.shift;
    formData.value.cats = cats;
    formData.value.tasks = tasks;
    formData.value.reports = { ...data.reports };
    drafts.value = Object.fromEntries(REPORT_TABS.map((key) => [key, reportTextOf(data.reports, key)]));
    typingOthers.value = {};
    prev.value = {
        date: prevData?.date || null,
        shift: prevData?.shift || null,
        reports: prevData?.reports || {},
        released: prevData?.released || [],
        unfinished: prevData?.unfinished || {},
    };

    setRaw(data);
    subscribeToShift(data.recordId);

    legacyPhotos.value = [];
    loadLegacyPhotos(data.recordId);
}

// ---- 即時同步（Broadcast，見 composables/useBroadcast.js）----
// 一班一個私人頻道 shift:<id>：
//   ops：別人存好的格子（跟 /api/shift/update 一樣的 { column, path, value }），照路徑套上
//   （留言 comment、照片 photo 兩種訊息 2026-11-12 跟著值班表的留言、照片拿掉了）
const { join: joinBroadcast, send: sendBroadcast } = useBroadcast();
const shiftChannel = ref(null);
const shiftTopic = (id) => `shift:${id}`;

// 這一班在資料庫裡的原始樣子（cats、tasks 以 id 為 key 的物件、reports）。
// 收到別人的 ops 時先套在這份上，再只拿改到的那幾隻貓、那幾項去合併進畫面（mergeRemote）
let remoteRaw = { cats: {}, tasks: {}, reports: {} };
const cloneJson = (v) => JSON.parse(JSON.stringify(v ?? {}));

function setRaw(data) {
    remoteRaw = { cats: cloneJson(data.cats), tasks: cloneJson(data.tasks), reports: cloneJson(data.reports) };
}

// 跟資料庫的 shift_apply 一樣：照路徑設值，中間缺的層補成 {}；if_missing 的只在還沒有時才設
function applyOpsToRaw(ops) {
    for (const op of ops) {
        let node = (remoteRaw[op.column] ||= {});
        const path = op.path || [];
        for (const key of path.slice(0, -1)) {
            if (!node[key] || typeof node[key] !== 'object') node[key] = {};
            node = node[key];
        }
        const last = path[path.length - 1];
        if (op.if_missing && node[last] !== undefined) continue;
        node[last] = cloneJson(op.value);
    }
}

// 只合併 ops 改到的貓、事項、回報
function mergeOps(ops) {
    const row = { cats: {}, tasks: {}, reports: {} };
    for (const op of ops) {
        const [first, second] = op.path || [];
        if (op.column === 'cats' && remoteRaw.cats[first]) row.cats[first] = remoteRaw.cats[first];
        if (op.column === 'tasks' && remoteRaw.tasks[first]) row.tasks[first] = remoteRaw.tasks[first];
        if (op.column === 'reports' && remoteRaw.reports[first]?.[second]) {
            row.reports[first] = { ...(row.reports[first] || {}), [second]: remoteRaw.reports[first][second] };
        }
    }
    mergeRemote(row);
}

const broadcastShift = (event, payload, shiftId = formData.value.recordId) =>
    sendBroadcast(shiftTopic(shiftId), event, payload, shiftChannel.value);

// 貓咪檔案（/cats/[id]）的頻道 cat:<貓>：改到這隻貓的格子就通知一聲（過去的班也是），那邊重抓那一班的日子。
// next：改了放風，下一班的「前班放風」也跟著變（server 已經同步），那邊連下一班一起重抓
function notifyCats(shiftId, catIds, next = false) {
    for (const id of new Set(catIds.filter(Boolean).map(String))) {
        sendBroadcast(`cat:${id}`, 'changed', { shiftId, next });
    }
}

// ---- 回報「正在編輯」：共編的回報後存的會蓋過先存的，所以打字時在這一班的頻道發 typing
// （最多 2 秒一次），別人收到就在輸入框上面顯示「○○ 正在編輯…」；離開輸入框發 stop，
// 漏收 stop（關掉分頁、斷線）的話 6 秒沒再收到就自己消失。只是提示，不鎖住輸入框 ----
const TYPING_TTL_MS = 6000;
const typingOthers = ref({}); // { 分頁: { user_id: { name, until } } }

const editingNames = computed(() =>
    Object.values(typingOthers.value[tab.value] || {}).map((t) => t.name || '有人')
);

const sendTyping = throttle(
    (key) => broadcastShift('typing', { tab: key, uid: me.value, name: nickname.value || '' }),
    2000,
    { trailing: false }
);

function stopTyping(key) {
    sendTyping.cancel();
    broadcastShift('typing', { tab: key, uid: me.value, stop: true });
}

function onRemoteTyping({ tab: key, uid, name, stop }) {
    if (!key || !uid || uid === me.value) return;
    const byTab = { ...(typingOthers.value[key] || {}) };
    if (stop) delete byTab[uid];
    else byTab[uid] = { name, until: Date.now() + TYPING_TTL_MS };
    typingOthers.value = { ...typingOthers.value, [key]: byTab };
    if (!stop) setTimeout(pruneTyping, TYPING_TTL_MS + 100);
}

function pruneTyping() {
    const now = Date.now();
    typingOthers.value = Object.fromEntries(
        Object.entries(typingOthers.value).map(([key, byTab]) => [
            key,
            Object.fromEntries(Object.entries(byTab).filter(([, t]) => t.until > now)),
        ])
    );
}

// 存好的格子是哪幾隻貓的：貓的格子看路徑第一段；事項看那一項記的是哪隻貓（全員、位置的不用）
function notifyCatsOfOps(shiftId, ops) {
    const catIds = ops.map((op) =>
        op.column === 'cats' ? op.path?.[0] : op.column === 'tasks' ? remoteRaw.tasks[op.path?.[0]]?.cat_id : null
    );
    const released = ops.some((op) => op.column === 'cats' && op.path?.[1] === 'released');
    notifyCats(shiftId, catIds, released);
}

// 斷線重連、從背景回來：重新抓這一班（合併進畫面，不打斷正在編輯的格子）
async function resyncShift() {
    const params = { date: $dayjs(formData.value.date).format('YYYY-MM-DD'), shift: formData.value.shift };
    try {
        const data = await $fetch('/api/shift', { params, cache: 'no-store' });
        if (data.recordId !== formData.value.recordId) return;
        setRaw(data);
        mergeRemote(data);
        lastUpdatedAt.value = new Date();
    } catch (e) {
        console.error('resync shift error:', e);
    }
}

function subscribeToShift(recordId) {
    shiftChannel.value?.leave();
    shiftChannel.value = joinBroadcast(
        shiftTopic(recordId),
        {
            ops: ({ ops = [] }) => {
                applyOpsToRaw(ops);
                mergeOps(ops);
                lastUpdatedAt.value = new Date();
            },
            typing: onRemoteTyping,
        },
        { onResync: resyncShift }
    );
}

// 「LINE 發送至群組」：這一班、這個分頁的回報（共編的一段）。
// 跟 /regular、/medicine 一樣先跳確認視窗，按「發送」才送。沒有回報就擋下
// （留言、照片 2026-11-12 拿掉了，不再一起發）
async function sendTabToLine() {
    const key = tab.value;
    const label = TAB_LABELS[key];

    try {
        loadingNotify.value = true;
        // 先把還沒存的回報存掉，發出去的才跟資料庫一致
        await saveNow();

        const report = reportTextOf(formData.value.reports, key).trim();
        if (!report) {
            ElMessage.warning(`這一班還沒有${label}回報`);
            return;
        }

        // 值班志工（排班投票）查不到也照樣發，那一行寫「無人值班」
        const { names = [] } = await $fetch('/api/shift/roster', {
            params: { date: $dayjs(formData.value.date).format('YYYY-MM-DD'), shift: formData.value.shift },
            cache: 'no-store',
        }).catch((e) => {
            console.error('load roster error:', e);
            return {};
        });

        const textSite =
            config.public.deploySite === 'feliformia' ? '' : `[${config.public.deploySite || 'Local'}]\n`;
        const text = textSite + buildLineText(label, report, names);
        if (!(await confirmLinePush(text))) return;

        try {
            await $fetch('/api/shift/line/push', {
                method: 'POST',
                body: { shiftId: formData.value.recordId, tab: key, text, photoIds: [] },
            });
            // 成功、失敗都用畫面上方的小提示，不用再按 OK
            ElMessage.success('已發送至群組');
        } catch {
            ElMessage.error({ message: '發送失敗，請確認網路狀態後重試', duration: 5000 });
        }
    } catch (e) {
        console.error('sendTabToLine error:', e);
        ElMessage.error({ message: '讀取內容失敗，請再試一次', duration: 5000 });
    } finally {
        loadingNotify.value = false;
    }
}

// LINE 訊息的分隔線：短線（5 個字），比長虛線省字數，分區還是看得出來
const LINE_DIVIDER = '─────';

// 發到 LINE 的文字：標題、日期、「班別・值班志工」，再來回報內容（共編的那一段，不寫名字與時間，也不寫【回報】）
function buildLineText(label, report, names = []) {
    const d = $dayjs(formData.value.date);
    const shiftLabel = SHIFT_LABELS[formData.value.shift];
    const lines = [
        `值班記錄｜${label}`,
        LINE_DIVIDER,
        `${d.format('YYYY/MM/DD')}（${WEEKDAYS[d.day()]}）`,
        // 沒人排班寫「無人值班」（跟行事曆同一個說法）
        `${shiftLabel}・${names.length ? names.join('、') : '無人值班'}`,
        LINE_DIVIDER,
        report,
    ];
    return lines.join('\n');
}

// 確認視窗：顯示實際要發的文字；超過 LINE 一則 5000 字時提醒會分成幾則。按發送回傳 true、取消回傳 false
const linePush = ref(null); // { text, chunks, resolve }

function confirmLinePush(text) {
    return new Promise((resolve) => {
        linePush.value = { text, chunks: splitText(text).length, resolve };
    });
}

function closeLinePush(ok) {
    linePush.value?.resolve(ok);
    linePush.value = null;
}

// 頁面離開前警告
function handleBeforeUnload(e) {
    if (isPending.value) {
        e.preventDefault();
        e.returnValue = '你有未儲存的變更，確定要離開嗎？';
        return e.returnValue;
    }
}

// Vue Router 導航離開前警告（手機滑動返回）
onBeforeRouteLeave((to, from, next) => {
    if (isPending.value) {
        const answer = window.confirm('你有未儲存的變更，確定要離開嗎？');
        if (!answer) {
            next(false);
            return;
        }
    }
    next();
});

async function load() {
    loading.value = true;
    try {
        InitFromQuery();
        await InitShift();
    } catch (error) {
        Swal.fire({
            html: `網路連線異常<br>請確認連線後重試。<br><br>錯誤：${error.message}`,
        });
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    load();
    loadItemPhotos();
});

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    shiftChannel.value?.leave();
});

// 換日期或班別才重新載入；只換分頁不用。換班前先把還沒送出的存掉
watch(
    () => [route.query.date, route.query.shift],
    async ([date, shift], [oldDate, oldShift]) => {
        if (date !== oldDate || shift !== oldShift) {
            flushSoon.cancel();
            await flush();
            load();
        }
    }
);
</script>

<style lang="scss" scoped>
#shift {
    a {
        display: block;
    }

    .last-update,
    .last-saved {
        margin: 0 0 5px 0;
        color: #ccc;
        font-size: 11px;
    }

    .line-green {
        background-color: #03c100;
        color: white;
    }

    // 回報卡片下面的 LINE 按鈕：跟卡片拉開，不要黏在一起
    .report .line-green {
        margin-top: 14px;
    }

    // ---- 回報：跟上面的項目分開；我的回報收成一張卡片（標題／輸入框／儲存列） ----
    .report-title {
        margin-top: 24px;
        margin-bottom: 10px;
    }

    .my-report {
        overflow: hidden;
        border: 1px solid #d8d4d1;
        border-radius: 6px;
        background: #fff;
        text-align: left;

        // 別人正在打字：輸入框上面一條淡橘提示（共編後存的會蓋過先存的，看到就先等一下）
        .mr-editing {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-bottom: 1px solid #f3e3cf;
            background: #fdf6ec;
            color: #b36b00;
            font-size: 13px;
            line-height: 1.4;
        }

        .mr-editing-dot {
            flex-shrink: 0;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #e6a23c;
            animation: mr-pulse 1.2s ease-in-out infinite;
        }

        // 輸入框在卡片裡不要自己的框線；全域把 textarea 設成至少 100px，這裡交給 autosize
        :deep(.el-textarea__inner) {
            min-height: 76px !important;
            padding: 9px 10px;
            border: none;
            border-radius: 0;
            box-shadow: none !important;
            font-size: 15px;
        }

        .mr-foot {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 7px 8px 8px 10px;
            border-top: 1px solid #eee;
        }

        .save-hint {
            font-size: 12px;
            color: #8e8783;

            &.saved {
                color: #529b2e;
            }

            &.error {
                color: #b33a39;
            }
        }

        // 全域 button 有 width: 100%，這裡蓋回來
        .save-btn {
            flex-shrink: 0;
            width: auto;
            height: 32px;
            margin: 0;
            padding: 0 18px;
            border: none;
            border-radius: 6px;
            background: #6da2c2;
            color: #fff;
            font-size: 14px;
            cursor: pointer;

            &:disabled {
                cursor: default;
                opacity: 0.5;
            }
        }
    }

    // ---- 觀察：跟 /regular 相同的吃喝排泄樣式 ----
    .el-slider {
        &.is-disabled {
            opacity: 0.5;
            :deep(.el-slider__marks-text) {
                color: #bbb;
            }
        }
    }

    .intake {
        .food {
            .intake-slider {
                width: calc(100% - 60px);

                // 沒勾（沒放）：看起來跟停用一樣淡，但點了、拖了會自動勾起來
                &.off .el-slider {
                    opacity: 0.5;
                    :deep(.el-slider__marks-text) {
                        color: #bbb;
                    }
                }
            }
            .el-slider {
                width: 100%;
                transform: translate(0, -6px);
            }
            .el-checkbox {
                width: 40px;
                margin-top: 4px;
            }
        }

        .excretion {
            > .d_flex {
                justify-content: start;
                flex-wrap: nowrap;
            }
            .W40 {
                display: flex;
                flex-wrap: nowrap;
                justify-content: start;
                padding-top: 12px;
                width: 80px;
            }
            .W60 {
                padding-left: 24px;
                width: calc(100% - 80px);
                :deep(.el-radio-group) {
                    display: flex;
                    flex-wrap: nowrap;
                    justify-content: start;
                    width: 100%;
                    label {
                        margin-right: 10px;
                    }
                }
            }
        }
    }
}

// ---- 標題列：標題靠左，「‹ 10/19 週日 早班 ›」靠右 ----
.shift-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;

    h1 {
        // 全域 h1 有 margin-bottom: 10px !important（element-variables.css），不蓋掉會跟右邊錯開
        margin: 0 !important;
        flex-shrink: 0;
        font-size: 20px;
        text-align: left;
        // 光學補償：Noto Sans TC 中文墨水比行框中心低，22px 約 1.7px（見 /admin 各頁），20px 等比約 1.5px
        transform: translateY(-1.5px);
    }
}

// 全域 button 有 width: 100%、邊框、底色、padding，這裡每一項都要蓋回來
.shift-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;

    button {
        height: 40px;
        margin: 0;
        border: 1px solid #d8d4d1;
        border-radius: 6px;
        background: #fff;
        color: #4a4542;
        cursor: pointer;
    }

    .nav-btn {
        width: 32px;
        flex-shrink: 0;
        padding: 0;
        font-size: 20px;
        line-height: 1;
        color: #657181;

        &:disabled {
            cursor: default;
            color: #ccc;
            border-color: #eee;
        }
    }

    .current-btn {
        width: auto;
        min-width: 0;
        padding: 0 10px;
        font-size: 14px;
        white-space: nowrap;
        border-color: #6da2c2;
    }
}

// ---- 分頁 ----
.tabs {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    gap: 6px;
    margin: 0 0 14px;
    padding: 8px 0;
    background: #fff;

    // 五個分頁在手機上每個只有 64px：蓋掉全域 button 的左右 10px padding，
    // 字和數字縮一點、不換行，「醫療 5」才放得下一行
    button {
        flex: 1;
        min-width: 0;
        height: 40px;
        padding: 0 2px;
        white-space: nowrap;
        border: 1px solid #d8d4d1;
        border-radius: 6px;
        background: #fff;
        color: #657181;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;

        &.active {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }
    }

    .remaining {
        display: inline-block;
        min-width: 16px;
        height: 16px;
        margin-left: 3px;
        padding: 0 4px;
        border: 1px solid #edbb85;
        border-radius: 8px;
        box-sizing: border-box;
        // 跟膠囊、打勾框完全同一組色（淡橘底、深橘字、淡橘框）。
        // 2026-11-16 從全站紅 #b33a39 改橘 —— 紅色的強制感太重。
        background: #fdf4e9;
        color: #a8682d;
        font-size: 11px;
        // 外框佔掉 2px，扣掉才跟原本一樣高
        line-height: 14px;
        vertical-align: 1px;
    }
}

// 分區小標題：貓咪／全員與區域（同後台）。卡片本身有 14px 下邊距，第二個標題上方再補一點
.section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
    font-size: 15px;
    font-weight: 500;
    color: #4a4542;
    text-align: left;

    // 標題後面拉一條細線到右邊，讀起來像段落分隔
    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #d8d4d1;
    }

    &.later {
        margin-top: 14px;
    }
}

.report {
    margin-top: 6px;
}

// ---- 卡片：跟 /medicine 相同 ----
.record_item {
    padding-right: 10px;
    border: 1px solid #d8d4d1;
    border-radius: 6px;
    margin-bottom: 14px;

    &:nth-child(even) {
        background-color: transparent;
    }

    &:first-child {
        border-top-color: #d8d4d1;
    }

    // 標題列：貓名是貼頂的分頁標籤（高 34px），右邊的放風跟它垂直置中；下面留 10px 再接內容
    padding-top: 44px;

    // 貓名 14px，行高經實測補償，見 pages/medicine.vue。
    // 不用 overflow: hidden 裁圓角（飲食如廁分頁的滑桿標籤會超出右邊被切掉），改成標籤自己配合卡片的圓角（6px 減掉 1px 邊框）
    // 點貓名到貓咪檔案（/cats/[id]）：蓋掉全域 a 的底線、紅字、下邊距
    .name {
        height: 34px;
        margin-bottom: 0;
        color: #fff;
        font-size: 14px;
        line-height: 33px;
        text-decoration: none;
        border-top-left-radius: 5px;
        border-bottom-right-radius: 8px;
    }

    // 飲食如廁分頁滑桿最右邊的「吃光」會超出滑桿半個字寬，右邊留跟 /regular 一樣的 25px
    &.intake-card {
        padding-right: 25px;
    }


    // 打勾的事項（醫療、隨餐藥）：沒勾的框淡橘色（還沒做）。誰、幾點勾的只存不顯示（2026-11-12 起）
    // 框在卡片最右邊，字比框寬：跟框靠右對齊，才不會超出卡片
    .task-check {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        height: auto;

        // 全域與打勾欄的樣式會把字放大、加粗，這裡蓋回補充資訊的小字
        :deep(.el-checkbox__label) {
            padding-left: 0 !important;
            font-size: 11px !important;
            font-weight: 400 !important;
            line-height: 1.2;
            color: #a8a29e !important;
            white-space: nowrap;
        }

        &:not(.is-checked) :deep(.el-checkbox__inner) {
            border-color: #edbb85;
            background: #fdf4e9;
        }
    }

    // 上一班放風：標籤與「仍要登記」在卡片右上角，跟貓名標籤垂直置中（34px 高的標籤裡，26px 往下 4px）
    .released-row {
        position: absolute;
        top: 4px;
        height: 26px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    // 全域 button 有 width: 100%、邊框、底色、padding，這裡蓋回來
    .released-toggle {
        width: auto;
        height: 24px;
        margin: 0;
        padding: 0 2px;
        border: none;
        background: none;
        color: #3f7ea3;
        font-size: 13px;
        cursor: pointer;
    }

    // 收起時只剩標題列那一行（貓名標籤的高度）
    // 卡片高 = 標籤 34px ＋ 上下外框 2px，標籤才不會凸出下框；只有一行時標籤左下角跟著卡片的圓角
    &.compact {
        min-height: 36px;
        padding-top: 0;

        &:not(:has(.observe-row)) .name {
            border-bottom-left-radius: 5px;
        }
    }

    .released-badge {
        position: absolute;
        top: 4px;
        right: 8px;
    }

    // 同一列（同類別）裡的多個項目：文字齊左、來源標籤齊右成一欄，
    // 項目之間間距一致，備註緊貼在自己的項目下面
    .diet-item + .diet-item {
        margin-top: 8px;
    }

    .diet-line {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 5px;
    }

    .diet-text {
        flex: 1;
        min-width: 0;
        font-size: 15px;
        color: #222;
    }

    // 備餐、醫療照護的類別有三個字（隨餐藥、補充品），左邊的類別欄從 40px 放寬，不然會斷行
    .detail > .d_flex.diet-row,
    .detail > .d_flex.med-row {
        > p {
            width: 50px;
            white-space: nowrap;
        }

        > div {
            width: calc(100% - 55px);
        }
    }

    // 同一類別多項時的序號
    .diet-no {
        flex-shrink: 0;
        min-width: 16px;
        font-size: 14px;
        color: #8e8783;
    }

    // 隨餐藥的「完成」在同一列最右邊
    .diet-done {
        flex-shrink: 0;
        margin-left: 4px;
    }

    .diet-note {
        padding: 0 5px 2px;
        font-size: 14px;
        line-height: 1.4;
        color: #767676;
    }

    // 全員／房間併進來的項目，標出來源（在 .diet-line 裡靠右）
    .source-chip {
        flex-shrink: 0;
        display: inline-block;
        padding: 0 6px;
        border-radius: 3px;
        background: #f0eeec;
        color: #767676;
        font-size: 12px;
        line-height: 20px;
        vertical-align: 1px;
    }

    // 放風：膠囊按鈕，沒勾是外框、勾了變實心。離上緣、右緣留白，不擠著卡片邊框。
    // 全域有 button { width: 100%; border; padding } 的樣式，這裡每一項都要蓋回來
    // 跟貓名標籤（34px）垂直置中
    // 跟貓名旁的膠囊（留餐）同高 24px、同一條中線（標籤高 34px → top 5px），上下緣才對齊
    .release-pill {
        position: absolute;
        top: 5px;
        right: 10px;
        width: auto;
        height: 24px;
        padding: 0 12px;
        border: 1px solid #c9c4c0;
        border-radius: 12px;
        background: #fff;
        box-sizing: border-box;
        color: #657181;
        font-size: 13px;
        line-height: 22px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }

        &:disabled {
            cursor: default;
            opacity: 0.6;
        }
    }

    .detail {
        > .d_flex.divided {
            border-top: 1px dashed #ccc;
            padding-top: 10px;
        }

        > .item-row {
            align-items: baseline;

            > div {
                // 打勾欄：勾了之後下面寫誰、幾點，寬度跟著字（至少 40px）
                .done {
                    flex-shrink: 0;
                    min-width: 40px;
                    > label {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: flex-end;
                        gap: 4px;
                        :deep(.el-checkbox__label) {
                            padding-left: 0 !important;
                            font-size: 12px;
                        }
                    }
                }

                .txt {
                    text-align: left;
                    width: calc(100% - 60px);

                    &.full {
                        width: 100%;
                    }

                    font {
                        display: block;
                        padding: 5px;

                        &.f_grey {
                            opacity: 0.9;
                            font-size: 14px;
                        }
                    }
                }
            }
        }
    }
}

// ---- 表單元件：跟 /regular 相同 ----
:deep(.el-slider__stop) {
    background-color: var(--el-color-primary);
}

:deep(.el-slider__marks-text) {
    color: #657181;
    font-size: 12px;
}

:deep(.el-radio__label) {
    font-weight: 400;
}

:deep(.el-checkbox),
:deep(.el-radio) {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 40px;
    margin-right: 0;

    span {
        padding: 4px 0 0;
        color: #657181;
        font-size: 12px;
        line-height: 14px;
    }

    .el-checkbox__input {
        width: 18px;
        height: 18px;
        padding-top: 0;
    }
}

:deep(.el-input) {
    max-width: 100%;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
    height: 45px;
}

// ---- 選班面板 ----
:deep(.shift-picker-drawer) {
    border-radius: 14px 14px 0 0;

    .el-drawer__body {
        padding: 14px 16px 20px;
        text-align: left;
    }
}

.sp-head {
    display: flex;
    align-items: center;
    margin-bottom: 4px;

    .sp-title {
        font-size: 16px;
        font-weight: 500;
    }

    .sp-close {
        width: auto;
        margin-left: auto;
        padding: 0 4px;
        border: none;
        background: none;
        color: #999;
        font-size: 16px;
        cursor: pointer;
    }
}

.sp-label {
    margin: 14px 0 6px;
    font-size: 13px;
    color: #8e8783;
}

.sp-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .sp-chip {
        width: auto;
        height: 34px;
        margin: 0;
        padding: 0 14px;
        border: 1px solid #d8d4d1;
        border-radius: 17px;
        background: #fff;
        color: #4a4542;
        font-size: 14px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #eaf3f8;
            color: #3f7ea3;
        }
    }
}

// 手機內建的日期選擇器（iPhone 滾輪、Android 日曆）
.sp-date {
    box-sizing: border-box;
    width: 100%;
    height: 42px;
    padding: 0 10px;
    border: 1px solid #d8d4d1;
    border-radius: 6px;
    background: #fff;
    color: #222;
    font-size: 16px; // 小於 16px，iPhone 點下去會自動放大頁面
}

.sp-seg {
    display: flex;
    overflow: hidden;
    border: 1px solid #d8d4d1;
    border-radius: 6px;

    button {
        flex: 1;
        height: 40px;
        margin: 0;
        border: none;
        border-radius: 0;
        background: #fff;
        color: #657181;
        font-size: 14px;
        cursor: pointer;

        & + button {
            border-left: 1px solid #d8d4d1;
        }

        &.on {
            background: #6da2c2;
            color: #fff;
        }

        &:disabled {
            cursor: default;
            color: #bbb;
        }
    }
}

.sp-go {
    width: 100%;
    height: 44px;
    margin: 18px 0 0;
    border: none;
    border-radius: 8px;
    background: #6da2c2;
    color: #fff;
    font-size: 15px;
    cursor: pointer;

    &:disabled {
        cursor: default;
        opacity: 0.5;
    }
}

// ---- 觀察管理（拍剩食、拍貓砂、拍留餐）----
// 觀察管理的膠囊（剛到要拍、離開要拍）：前面一個圖示（沒拍是相機、拍了是勾），
// 沒拍的淡橘色（還沒做，跟沒勾的框同一個顏色）、拍了藍色。
// 橘色是從照片類型膠囊的暖橘 #e08a3c 壓暗來的，同一件事兩個地方同色系。
// 2026-11-16 從紅色改橘 —— 紅色的強制感太重，志工反映不舒服。
// 點了就打勾、再點取消（2026-11-12 起拿掉照片）。在貓名那列時跟貓名標籤垂直置中（標題列 align-items: center）
.observe-chip {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 3px;
    width: auto;
    height: 24px;
    margin: 0 0 0 2px;
    padding: 0 10px 0 8px;
    border: 1px solid #edbb85;
    border-radius: 12px;
    background: #fdf4e9;
    box-sizing: border-box;
    color: #a8682d;
    font-size: 13px;
    line-height: 22px;
    white-space: nowrap;
    cursor: pointer;

    &.done {
        border-color: #9cc3d9;
        background: #eef5f9;
        color: #4a85a8;
    }

    // 超過編輯期限的班：看得到勾了沒，不能改
    &:disabled {
        cursor: default;
    }
}

// 名字那列放不下的膠囊，改放下一行
.observe-row {
    width: 100%;
    margin: 0 0 8px 10px;

    // 收起的卡片（上一班放風）沒有上方留白，自己避開貓名那一列（標籤高 34px，下面留 10px，跟一般卡片一樣）；
    // 下面接卡片的 10px 內距，上下留白才對稱
    .compact > & {
        margin-top: 44px;
        margin-bottom: 0;
    }

    .observe-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
}

// 標題列：貓名標籤貼左上角
.record_item .name-wrap {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 4px;

    .name {
        position: static;
    }
}

// ---- LINE 發送確認視窗 ----
.lp-text {
    max-height: 50vh;
    overflow-y: auto;
    padding: 10px 12px;
    border-radius: 8px;
    background: #f7f6f5;
    color: #333;
    font-size: 14px;
    line-height: 1.55;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.lp-warn {
    margin-bottom: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: #fdf6ec;
    color: #b36b00;
    font-size: 13px;
    line-height: 1.5;
    text-align: left;
}

.pd-confirm {
    display: flex;
    gap: 8px;

    .pd-cancel {
        width: 90px;
        flex-shrink: 0;
        height: 42px;
        border: 1px solid #d8d4d1;
        border-radius: 8px;
        background: #fff;
        color: #657181;
        font-size: 15px;
        cursor: pointer;
    }

    .pd-add {
        flex: 1;
        height: 42px;
        border: none;
        border-radius: 8px;
        background: #6da2c2;
        color: #fff;
        font-size: 15px;
        cursor: pointer;
    }
}

@keyframes mr-pulse {
    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.3;
    }
}
</style>

<style lang="scss">
/* LINE 發送確認：內容長時視窗裡面捲動 */
.line-push-dialog {
    max-width: 480px;
    border-radius: 12px;

    .el-dialog__body {
        max-height: 70vh;
        overflow-y: auto;
    }
}
</style>
