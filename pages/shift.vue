<template>
    <ClientOnly>
        <div v-loading="loading" id="shift">
            <h1>值班記錄表</h1>
            <form @submit.prevent="Submit">
                <div class="d_flex">
                    <div class="W50">
                        <el-date-picker
                            v-model="formData.date"
                            :disabled-date="disabledDate"
                            type="date"
                            :clearable="false"
                            @change="dateHandler"
                            placeholder="請選擇日期"
                        />
                    </div>
                    <div class="W50 arrow">
                        <el-select
                            v-model="formData.shift"
                            placeholder="請選擇班別"
                            @change="dateHandler"
                        >
                            <el-option
                                v-for="item in shiftList"
                                :key="item.value"
                                :label="item.label"
                                :value="item.value"
                                :disabled="disableShift(item.value)"
                            />
                        </el-select>
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
                    <!-- 上一班：各分頁的回報、沒勾完的收尾（跟以前的前班備註同一個位置） -->
                    <div
                        v-for="r in prevReports"
                        :key="r.tab"
                        class="W100 ps f_grey prev-note"
                    >
                        <b>*前班{{ r.label }}回報：</b>
                        <span style="white-space: pre-line">{{ r.text }}</span>
                    </div>
                    <div v-if="prev.unfinished.length" class="W100 ps f_grey prev-note">
                        <b>*前班收尾未完成：</b>
                        <span>{{ prev.unfinished.join('、') }}</span>
                    </div>

                    <div
                        v-for="cat in formData.cats"
                        :key="cat.cat_id"
                        class="d_flex record_item intake-card"
                    >
                        <div class="name-wrap">
                            <div class="name">{{ cat.name }}</div>
                            <!-- 這個分頁、這隻貓的留言。橘點：上一班有交代 -->
                            <button
                                type="button"
                                class="comment-btn"
                                :class="{ has: commentCount(cat.cat_id) }"
                                :aria-label="`${cat.name}的留言`"
                                @click="openComments(cat)"
                            >
                                💬<span v-if="commentCount(cat.cat_id)">{{
                                    commentCount(cat.cat_id)
                                }}</span>
                                <i v-if="hasHandover(cat.cat_id)" class="handover-dot"></i>
                            </button>
                        </div>
                        <el-tag
                            v-if="prev.released.includes(cat.cat_id)"
                            class="released-badge"
                            type="warning"
                            size="small"
                            >上一班放風</el-tag
                        >
                        <div class="detail intake">
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
                                    <el-slider
                                        v-model="cat.intake.feed_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.intake.feed"
                                        @change="saveIntake(cat)"
                                    />
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
                                    <el-slider
                                        v-model="cat.intake.can_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.intake.can"
                                        @change="saveIntake(cat)"
                                    />
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

                <!-- ========== 醫療、吃藥：醫療管理的項目，依類別分兩個分頁（只列有事項的貓） ========== -->
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
                                <div class="name">{{ entry.cat.name }}</div>
                                <!-- 這個分頁、這隻貓的留言。橘點：上一班有交代 -->
                                <button
                                    type="button"
                                    class="comment-btn"
                                    :class="{ has: commentCount(entry.cat.cat_id) }"
                                    :aria-label="`${entry.cat.name}的留言`"
                                    @click="openComments(entry.cat)"
                                >
                                    💬<span v-if="commentCount(entry.cat.cat_id)">{{
                                        commentCount(entry.cat.cat_id)
                                    }}</span>
                                    <i v-if="hasHandover(entry.cat.cat_id)" class="handover-dot"></i>
                                </button>
                            </div>
                            <div class="detail">
                                <div
                                    v-for="(item, index) in entry.items"
                                    :key="item.id"
                                    class="d_flex item-row"
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
                                            <font v-if="item.done && item.done_by" class="done-by"
                                                >✓ {{ doneLabel(item) }}</font
                                            >
                                        </div>
                                        <div class="done">
                                            <el-checkbox
                                                v-model="item.done"
                                                :disabled="isDisabled"
                                                @change="
                                                    stampDone(item);
                                                    saveCatItem(entry.cat, 'medical', item);
                                                "
                                                >完成</el-checkbox
                                            >
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
                                    class="d_flex item-row"
                                    :class="{ divided: index > 0 }"
                                >
                                    <p class="f_blue">{{ item.category || '事項' }}</p>
                                    <div class="d_flex">
                                        <div class="txt">
                                            <font class="treatment">{{ item.treatment }}</font>
                                            <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                            <font v-if="item.done && item.done_by" class="done-by"
                                                >✓ {{ doneLabel(item) }}</font
                                            >
                                        </div>
                                        <div class="done">
                                            <el-checkbox
                                                v-model="item.done"
                                                :disabled="isDisabled"
                                                @change="
                                                    stampDone(item);
                                                    saveTask(item);
                                                "
                                                >完成</el-checkbox
                                            >
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

                <!-- ========== 備餐：乾乾、罐罐、補充、其他（只看）、放風 ========== -->
                <div v-show="tab === 'leave'" class="W100">
                    <div v-if="leaveCats.length && leaveTaskGroups.length" class="section-title">
                        貓咪
                    </div>
                    <div
                        v-for="entry in leaveCats"
                        :key="entry.cat.cat_id"
                        class="d_flex record_item"
                    >
                        <div class="name-wrap">
                            <div class="name">{{ entry.cat.name }}</div>
                            <!-- 這個分頁、這隻貓的留言。橘點：上一班有交代 -->
                            <button
                                type="button"
                                class="comment-btn"
                                :class="{ has: commentCount(entry.cat.cat_id) }"
                                :aria-label="`${entry.cat.name}的留言`"
                                @click="openComments(entry.cat)"
                            >
                                💬<span v-if="commentCount(entry.cat.cat_id)">{{
                                    commentCount(entry.cat.cat_id)
                                }}</span>
                                <i v-if="hasHandover(entry.cat.cat_id)" class="handover-dot"></i>
                            </button>
                        </div>
                        <!-- 放風：離開時沒有關籠，下一班在觀察分頁會看到。貓名同一列最右邊的膠囊按鈕 -->
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
                        <div class="detail">
                            <!-- 乾乾、罐罐、補充、其他：只看不打勾。同類別併成一列，全員／位置的標出來源 -->
                            <div
                                v-for="(row, index) in entry.dietRows"
                                :key="row.category"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">{{ row.category }}</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <!-- 文字一律齊左；全員／位置的來源標籤靠右成一欄 -->
                                        <div v-for="item in row.items" :key="item.key" class="diet-item">
                                            <div class="diet-line">
                                                <span class="diet-text">{{ item.content }}</span>
                                                <span v-if="item.source" class="source-chip">{{
                                                    item.source
                                                }}</span>
                                            </div>
                                            <div v-if="item.end_date" class="diet-note">
                                                至 {{ $dayjs(item.end_date).format('MM/DD') }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="entry.dietRows.length === 0" class="d_flex item-row">
                                <p class="f_blue">飲食</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <font class="f_grey">尚未設定飲食</font>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 貓後面：沒有任何貓適用的飲食項目（例如那個位置還沒有貓），只看 -->
                    <div v-if="leaveCats.length && leaveTaskGroups.length" class="section-title later">
                        全員與位置
                    </div>
                    <div
                        v-for="group in leaveTaskGroups"
                        :key="group.name"
                        class="d_flex record_item"
                    >
                        <div class="name">{{ group.name }}</div>
                        <div class="detail">
                            <div
                                v-for="(item, index) in group.items"
                                :key="item.key"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">{{ item.category }}</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <font class="treatment">{{ item.content }}</font>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 收尾：這一班離開前一定要勾完的清單，不分貓（備餐右邊） ========== -->
                <div v-show="tab === 'required'" class="W100">
                    <div v-if="requiredItems.length" class="d_flex record_item required-card">
                        <div class="name">收尾</div>
                        <div class="detail">
                            <div
                                v-for="(item, index) in requiredItems"
                                :key="item.key"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{ item.content }}</font>
                                        <font v-if="item.done && item.done_by" class="done-by"
                                            >✓ {{ doneLabel(item) }}</font
                                        >
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="item.done"
                                            :disabled="isDisabled"
                                            @change="
                                                stampDone(item);
                                                saveTask(item);
                                            "
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <el-empty v-else description="這一班沒有收尾項目" />
                </div>

                <!-- ========== 回報：每個分頁各自一段，下一班在觀察分頁上方看得到；填表志工只在觀察分頁 ========== -->
                <div class="W100 mb20 report">
                    <el-input
                        type="textarea"
                        v-model="formData.reports[tab]"
                        :disabled="isDisabled"
                        :placeholder="`${tabLabel}回報（下一班會在觀察分頁看到）`"
                        @input="saveReport(tab)"
                    />
                </div>

                <div v-show="tab === 'arrive'" class="W100 mb20">
                    <div class="member-row">
                        <!-- 不開搜尋：手機點了不會跳出鍵盤 -->
                        <el-select
                            v-model="formData.member"
                            :disabled="isDisabled"
                            placeholder="請選擇填表志工"
                            class="member-select"
                            @change="saveMember"
                        >
                            <el-option
                                v-for="member in memberList"
                                :key="member.value"
                                :label="member.label"
                                :value="member.value"
                            />
                        </el-select>
                        <el-button
                            :disabled="isDisabled || !nickname"
                            @click="selectMe"
                        >
                            選自己
                        </el-button>
                    </div>
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

                    <!-- 每一格改完都會自動儲存；觀察分頁留著按鈕，儲存失敗時每個分頁都會出現，讓人能重試 -->
                    <button
                        type="submit"
                        class="btn"
                        v-show="!isDisabled && (tab === 'arrive' || saveStatus === 'error')"
                    >
                        <template v-if="saveStatus === 'saving'">儲存中...</template>
                        <template v-else-if="saveStatus === 'error'"
                            >儲存失敗，請手動重試</template
                        >
                        <template v-else>儲存表單</template>
                    </button>

                    <!-- 把值班回報手動推到 LINE 群組（同 /regular、/medicine），只在觀察分頁 -->
                    <button
                        type="button"
                        class="btn line-green"
                        v-show="tab === 'arrive' && !isDisabled"
                        @click="ManualNotifyLine"
                    >
                        {{ loadingNotify ? '通知中...' : 'LINE 手動發送' }}
                    </button>

                    <NuxtLink class="f_red" :to="prevLink">看前班紀錄</NuxtLink>
                    <NuxtLink class="f_red" to="/shift">回到現在這一班</NuxtLink>
                </div>
            </form>

            <!-- 留言面板：從下方滑出，這個分頁、這隻貓的留言 -->
            <el-drawer
                v-model="drawerOpen"
                direction="btt"
                size="72%"
                :with-header="false"
                class="comment-drawer"
            >
                <div class="cd-head">
                    <span class="cd-title">{{ drawerCat?.name }}</span>
                    <span class="cd-tab">{{ tabLabel }}留言</span>
                    <button type="button" class="cd-close" aria-label="關閉" @click="drawerOpen = false">
                        ✕
                    </button>
                </div>

                <div class="cd-list">
                    <template v-if="drawerHandover.length">
                        <div class="cd-section">上一班交代</div>
                        <div v-for="c in drawerHandover" :key="c.id" class="cd-item handover">
                            <div class="cd-meta">{{ c.author_name || '未命名' }} · {{ formatTime(c.created_at) }}</div>
                            <div class="cd-body">{{ c.body }}</div>
                        </div>
                        <div class="cd-section">這一班</div>
                    </template>
                    <div v-for="c in drawerComments" :key="c.id" class="cd-item">
                        <div class="cd-meta">
                            {{ c.author_name || '未命名' }} · {{ formatTime(c.created_at) }}
                            <span v-if="c.for_next" class="cd-next">給下一班</span>
                        </div>
                        <div class="cd-body">{{ c.body }}</div>
                    </div>
                    <div v-if="!drawerComments.length" class="cd-empty">這一班還沒有留言</div>
                </div>

                <div class="cd-input">
                    <el-input
                        v-model="draft"
                        type="textarea"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        :disabled="isDisabled"
                        placeholder="寫下這隻貓的狀況…"
                    />
                    <div class="cd-actions">
                        <el-checkbox v-model="draftForNext" :disabled="isDisabled" class="cd-for-next"
                            >給下一班</el-checkbox
                        >
                        <button
                            type="button"
                            class="cd-send"
                            :disabled="isDisabled || sending || !draft.trim()"
                            @click="sendComment"
                        >
                            {{ sending ? '送出中' : '送出' }}
                        </button>
                    </div>
                </div>
            </el-drawer>
        </div>

        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
// 新版值班記錄表：一個班一筆 shifts，合併觀察、醫療、吃藥、備餐、收尾五個分頁。
// 資料來自新版的 cat_profiles 與飲食／醫療／待辦管理；/regular、/medicine 維持原樣，兩邊不互通。
// 存檔是「局部更新」：每改一格只送那一格（saveIntake、saveCatItem…），
// 兩個人同時改不同的貓或項目不會互相覆蓋
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash-es';
import Swal from 'sweetalert2';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '值班記錄表',
});

const { $dayjs } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const supabase = useSupabaseClient();
const { nickname, getUserId } = useProfile();

// State
const loading = ref(true);
const loadingNotify = ref(false);
const saveStatus = ref('success');
const lastUpdatedAt = ref(null);
const lastSavedAt = ref(null);
const realtimeChannel = ref(null);
const commentsChannel = ref(null);
const tab = ref('arrive');
const prev = ref({ reports: {}, released: [], unfinished: [] });

const shiftList = [
    { value: 'morning', label: '早班' },
    { value: 'night', label: '晚班' },
];

const marks = {
    0: '沒吃',
    25: '吃1/3',
    50: '吃1/2',
    75: '吃2/3',
    100: '吃光',
};

const memberList = ref([]);

const formData = ref({
    recordId: '',
    date: new Date(),
    shift: '',
    cats: [], // [{ cat_id, name, location, sort, intake, released, medical: [], diet: [] }]
    tasks: [], // [{ key, kind, id, location, ... }]，kind：medical / diet / required（收尾）
    reports: {}, // { arrive, care, meds, leave, required }：每個分頁的回報
    member: '',
});

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
            medical: sortedValues(c.medical),
            diet: sortedValues(c.diet),
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
        await $fetch('/api/shift/update', {
            method: 'POST',
            body: { recordId: formData.value.recordId, ops: entries.map(([, op]) => op) },
        });
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

// 打勾時記下誰（登入者的暱稱）、幾點；取消就清掉
function stampDone(item) {
    item.done_by = item.done ? nickname.value || '未命名' : null;
    item.done_at = item.done ? new Date().toISOString() : null;
}

function doneLabel(item) {
    return `${item.done_by} ${$dayjs(item.done_at).format('HH:mm')}`;
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

const saveReport = (key) =>
    queue([{ column: 'reports', path: [key], value: formData.value.reports[key] || '' }]);
const saveMember = () => queue([{ column: 'member', value: formData.value.member || null }]);

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
        for (const ri of rc.medical) {
            if (busy('cats', [id, 'medical', String(ri.id)])) continue;
            const li = lc.medical.find((i) => i.id === ri.id);
            if (li) Object.assign(li, pickDone(ri));
            else lc.medical.push(ri);
        }
    }
    local.cats.sort(bySort);

    for (const rt of remote.tasks) {
        if (busy('tasks', [rt.key])) continue;
        const lt = local.tasks.find((t) => t.key === rt.key);
        if (lt) Object.assign(lt, pickDone(rt));
        else local.tasks.push(rt);
    }

    for (const [key, text] of Object.entries(row.reports || {})) {
        if (!busy('reports', [key])) local.reports[key] = text;
    }
    if (!busy('member', [])) local.member = row.member;
}

const pickDone = ({ done, done_by, done_at }) => ({
    done: !!done,
    done_by: done_by ?? null,
    done_at: done_at ?? null,
});

// ---- 留言：每隻貓、每個分頁各自一串，跟著這一班。勾「給下一班」的會在下一班同一分頁出現 ----
const comments = ref([]); // 這一班的留言
const handovers = ref([]); // 上一班勾了「給下一班」的留言
const drawerOpen = ref(false);
const drawerCat = ref(null);
const draft = ref('');
const draftForNext = ref(false);
const sending = ref(false);

const TABS = ['arrive', 'care', 'meds', 'leave', 'required'];
const TAB_LABELS = { arrive: '觀察', care: '醫療', meds: '吃藥', leave: '備餐', required: '收尾' };
const tabLabel = computed(() => TAB_LABELS[tab.value]);

const inThisTab = (list, catId) =>
    list.filter((c) => c.cat_id === catId && c.tab === tab.value);
const commentCount = (catId) => inThisTab(comments.value, catId).length;
const hasHandover = (catId) => inThisTab(handovers.value, catId).length > 0;
const drawerComments = computed(() =>
    drawerCat.value ? inThisTab(comments.value, drawerCat.value.cat_id) : []
);
const drawerHandover = computed(() =>
    drawerCat.value ? inThisTab(handovers.value, drawerCat.value.cat_id) : []
);

function formatTime(iso) {
    return $dayjs(iso).format('MM/DD HH:mm');
}

function openComments(cat) {
    drawerCat.value = cat;
    draft.value = '';
    draftForNext.value = false;
    drawerOpen.value = true;
}

function addComment(row) {
    if (!comments.value.some((c) => c.id === row.id)) comments.value.push(row);
}

async function sendComment() {
    const body = draft.value.trim();
    if (!body || !drawerCat.value) return;
    sending.value = true;
    try {
        const row = await $fetch('/api/shift/comments', {
            method: 'POST',
            body: {
                shiftId: formData.value.recordId,
                catId: drawerCat.value.cat_id,
                tab: tab.value,
                body,
                forNext: draftForNext.value,
            },
        });
        addComment(row);
        draft.value = '';
        draftForNext.value = false;
    } catch (e) {
        console.error('sendComment error:', e);
        ElMessage.error('留言送出失敗，請再試一次');
    } finally {
        sending.value = false;
    }
}

async function loadComments(params) {
    try {
        const data = await $fetch('/api/shift/comments', { params, cache: 'no-store' });
        comments.value = data.current;
        handovers.value = data.previous;
    } catch (e) {
        console.error('loadComments error:', e);
    }
}

// 別人新增的留言即時出現（自己送出的已經 addComment 過，靠 id 去重）
function subscribeToComments(recordId) {
    if (commentsChannel.value) supabase.removeChannel(commentsChannel.value);
    commentsChannel.value = supabase
        .channel(`shift-comments-${recordId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'shift_comments',
                filter: `shift_id=eq.${recordId}`,
            },
            (payload) => payload.new && addComment(payload.new)
        )
        .subscribe();
}

// ---- 分頁內容 ----

// 不屬於單一貓咪的項目照位置分組，排序是全員 → 位置（placeRank，跟後台一致）
function groupTasks(filter) {
    const map = new Map();
    for (const task of formData.value.tasks.filter(filter)) {
        const name = placeName(task.location);
        if (!map.has(name)) map.set(name, { name, location: task.location, items: [] });
        map.get(name).items.push(task);
    }
    return [...map.values()].sort((a, b) => placeRank(a.location) - placeRank(b.location));
}

// 醫療分頁與吃藥分頁：都是醫療管理的項目，依類別分開（吃藥一頁，醫療、其他一頁）
const isMeds = (item) => item.category === '吃藥';
const medicalSections = computed(() =>
    [
        { tab: 'care', match: (i) => !isMeds(i), empty: '這一班沒有醫療事項' },
        { tab: 'meds', match: isMeds, empty: '這一班沒有要吃的藥' },
    ].map(({ tab, match, empty }) => ({
        tab,
        empty,
        cats: formData.value.cats
            .map((cat) => ({ cat, items: cat.medical.filter(match) }))
            .filter((entry) => entry.items.length > 0),
        taskGroups: groupTasks((t) => t.kind === 'medical' && match(t)),
    }))
);

// 備餐：全員的飲食併進每隻貓，位置的併進那個位置的貓。全部只看、不打勾。
// 同類別排在一起：乾乾 → 罐罐 → 補充 → 其他；同類別裡自己的在前、全員／位置的在後（sort 是穩定的）
const DIET_ORDER = { 乾乾: 0, 罐罐: 1, 補充: 2, 其他: 3 };
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

const leaveCats = computed(() => {
    const dietTasks = formData.value.tasks.filter((t) => t.kind === 'diet');
    return formData.value.cats.map((cat) => {
        const items = [
            ...cat.diet.map((d) => ({ ...d, key: `diet-${d.id}` })),
            ...dietTasks
                .filter((t) => appliesTo(t, cat))
                .map((t) => ({ ...t, source: placeName(t.location) })),
        ].sort(byDietOrder);
        return { cat, dietRows: groupByCategory(items) };
    });
});

// 備餐分頁貓後面那一區：沒有任何貓適用的飲食（例如那個位置還沒有貓），不然會看不到
const leaveTaskGroups = computed(() =>
    groupTasks(
        (t) => t.kind === 'diet' && !formData.value.cats.some((cat) => appliesTo(t, cat))
    )
);

// 收尾分頁：整班一張清單
const requiredItems = computed(() => formData.value.tasks.filter((t) => t.kind === 'required'));

// 觀察分頁上方：上一班有寫的回報，照分頁順序
const prevReports = computed(() =>
    TABS.map((key) => ({ tab: key, label: TAB_LABELS[key], text: prev.value.reports[key] }))
        .filter((r) => r.text?.trim())
);

// 分頁上的數字：還沒打勾的項目數
const tabList = computed(() => {
    const undone = (list) => list.filter((i) => !i.done).length;
    const sectionUndone = (tab) => {
        const section = medicalSections.value.find((s) => s.tab === tab);
        return (
            section.cats.reduce((sum, e) => sum + undone(e.items), 0) +
            section.taskGroups.reduce((sum, g) => sum + undone(g.items), 0)
        );
    };
    return [
        { value: 'arrive', label: '觀察', remaining: 0 },
        { value: 'care', label: '醫療', remaining: sectionUndone('care') },
        { value: 'meds', label: '吃藥', remaining: sectionUndone('meds') },
        // 備餐只是參考，沒有要打勾的
        { value: 'leave', label: '備餐', remaining: 0 },
        { value: 'required', label: '收尾', remaining: undone(requiredItems.value) },
    ];
});

const prevLink = computed(() => {
    let date = $dayjs(formData.value.date);
    if (formData.value.shift === 'morning') date = date.subtract(1, 'day');
    return {
        name: 'shift',
        query: {
            date: date.format('YYYY-MM-DD'),
            shift: formData.value.shift === 'morning' ? 'night' : 'morning',
        },
    };
});

const isDisabled = computed(() => {
    const day = $dayjs(formData.value.date);
    const disabled = $dayjs().subtract(config.public.disabledDays || 2, 'day');
    return day < disabled;
});

// Date picker disabled date
const disabledDate = (time) => {
    const dateFrom = new Date(config.public.releaseDate || '2024-01-01');
    dateFrom.setDate(dateFrom.getDate() - 1);
    return time.getTime() > Date.now() || time.getTime() < dateFrom;
};

// 今天 18:00 前不能選晚班（跟 /medicine 一樣，避免提早建立晚班的記錄）
function disableShift(fromShift) {
    const { date } = formData.value;
    return (
        date &&
        $dayjs(date).isSame($dayjs(), 'day') &&
        new Date().getHours() < 18 &&
        fromShift === 'night'
    );
}

// Methods
function setTab(value) {
    tab.value = value;
    router.replace({ query: { ...route.query, tab: value } });
}

function selectMe() {
    if (nickname.value) {
        formData.value.member = nickname.value;
        saveMember();
    }
}

function foodHandler(cat, type) {
    cat.intake[type === 'can' ? 'can_detail' : 'feed_detail'] = 0;
}

function fecesHandler(cat) {
    cat.intake.feces_warning = cat.intake.feces ? '正常' : null;
}

function dateHandler() {
    const { date, shift } = formData.value;
    if (disableShift(shift)) {
        ElMessage.error('錯誤，請重新選擇日期');
        return;
    }
    router.push({
        name: 'shift',
        query: { date: $dayjs(date).format('YYYY-MM-DD'), shift, tab: tab.value },
    });
}

function InitFromQuery() {
    const { date, shift, tab: queryTab } = route.query;

    formData.value.date = date ? new Date(date) : new Date();
    formData.value.shift = ['morning', 'night'].includes(shift)
        ? shift
        : new Date().getHours() < 18
        ? 'morning'
        : 'night';
    if (TABS.includes(queryTab)) tab.value = queryTab;
}

async function InitMemberList() {
    try {
        const data = await $fetch('/api/volunteer/list');
        memberList.value = data.map((v) => ({ label: v.name, value: v.name }));
    } catch (e) {
        console.error('InitMemberList error:', e);
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
    formData.value.member = data.member;
    prev.value = {
        reports: prevData?.reports || {},
        released: prevData?.released || [],
        unfinished: prevData?.unfinished || [],
    };

    subscribeToRealtime(data.recordId);

    // 留言要等這一班建立好才查得到，所以放在後面
    await loadComments(params);
    subscribeToComments(data.recordId);
}

function subscribeToRealtime(recordId) {
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }

    realtimeChannel.value = supabase
        .channel(`shift-${recordId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'shifts',
                filter: `id=eq.${recordId}`,
            },
            (payload) => {
                if (!payload.new) return;
                // 是自己的更新就忽略
                if (payload.new.updated_by === getUserId()) return;
                mergeRemote(payload.new);
                lastUpdatedAt.value = new Date();
            }
        )
        .subscribe();
}

async function Submit() {
    // 填表志工只在觀察分頁出現；其他分頁的按鈕只用來重試失敗的儲存
    if (tab.value === 'arrive' && !formData.value.member) {
        ElMessage.error('請選擇填表志工');
        return;
    }
    flushSoon.cancel();
    if (queued.size === 0) {
        saveStatus.value = 'success';
        lastSavedAt.value = lastSavedAt.value || new Date();
        return;
    }
    await flush();
}

// 跟 /regular、/medicine 一樣：先跳確認視窗，按「是的」才推到 LINE 群組
async function ManualNotifyLine() {
    const ShiftMap = { morning: '早班', night: '晚班' };

    try {
        loadingNotify.value = true;
        const textDate = $dayjs(formData.value.date).format('YYYY/MM/DD');
        const textShift = ShiftMap[formData.value.shift];
        const member = formData.value.member || '';
        // 有寫的分頁回報都帶上，各自標分頁名稱
        const reports = TABS.map((key) => [TAB_LABELS[key], (formData.value.reports[key] || '').trim()])
            .filter(([, text]) => text);
        const reportText = reports.map(([label, text]) => `【${label}】\n${text}`).join('\n');
        const textPush = `值班記錄\n---------------\n日期： ${textDate}\n班別： ${textShift}\n志工： ${member}\n回報：\n${reportText}`;
        const textSite =
            config.public.deploySite === 'feliformia'
                ? ''
                : `[${config.public.deploySite || 'Local'}]\n`;
        const textManual = '[大哥通知]\n';

        // 確認視窗是 HTML：先跳脫，再把換行轉成 <br>，看到的才跟實際送出的一樣
        const toHtml = (text) =>
            text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        const htmlPush = `<div style="text-align: left;"><b><h3>將以下訊息通知大哥</h3></b>值班記錄<br>---------------<br>日期： ${textDate}<br>班別： ${textShift}<br>志工： ${toHtml(member)}<br>回報：<br>${toHtml(reportText)}</div>`;

        const { isConfirmed } = await Swal.fire({
            html: htmlPush,
            showCancelButton: true,
            cancelButtonText: '取消',
            confirmButtonColor: '#b33a39',
            confirmButtonText: '是的',
        });

        if (isConfirmed) {
            try {
                await $fetch('/api/line/message/push', {
                    method: 'POST',
                    body: { text: textSite + textManual + textPush },
                });
                Swal.fire({ text: '手動發送成功', confirmButtonColor: '#b33a39' });
            } catch {
                Swal.fire({
                    html: '手動發送失敗。<br>請確認網路狀態後重試。',
                    confirmButtonColor: '#b33a39',
                });
            }
        }
    } finally {
        loadingNotify.value = false;
    }
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
            confirmButtonColor: '#b33a39',
        });
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    InitMemberList();
    load();
});

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (realtimeChannel.value) {
        supabase.removeChannel(realtimeChannel.value);
    }
    if (commentsChannel.value) {
        supabase.removeChannel(commentsChannel.value);
    }
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

    .member-row {
        display: flex;
        gap: 8px;
        align-items: center;

        .member-select {
            flex: 1;
        }

        .el-button {
            width: auto !important;
            flex-shrink: 0;
            height: 45px;
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
            .el-slider {
                width: calc(100% - 60px);
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
        border-radius: 8px;
        background: #b33a39;
        color: #fff;
        font-size: 11px;
        line-height: 16px;
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

.prev-note {
    padding-top: 0;
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

    // 貓名 14px，行高經實測補償，見 pages/medicine.vue
    padding-top: 35px;

    // 不用 overflow: hidden 裁圓角：觀察分頁的滑桿標籤（吃光）會超出右邊被切掉。
    // 改成標籤自己配合卡片的圓角（6px 減掉 1px 邊框）
    .name {
        height: 26px;
        font-size: 14px;
        line-height: 25px;
        border-top-left-radius: 5px;
        border-bottom-right-radius: 6px;
    }

    // 觀察分頁滑桿最右邊的「吃光」會超出滑桿半個字寬，右邊留跟 /regular 一樣的 25px
    &.intake-card {
        padding-right: 25px;
    }


    // 誰、幾點勾的
    .detail .txt font.done-by {
        padding-top: 0;
        font-size: 12px;
        color: #6da2c2;
    }

    // 收尾清單沒有左邊的類別欄，文字從頭開始
    &.required-card .detail > .item-row > .d_flex {
        width: 100%;
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
    .release-pill {
        position: absolute;
        top: 7px;
        right: 10px;
        width: auto;
        height: 26px;
        padding: 0 12px;
        border: 1px solid #c9c4c0;
        border-radius: 13px;
        background: #fff;
        color: #657181;
        font-size: 13px;
        line-height: 24px;
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
                .done {
                    width: 40px;
                    > label {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        gap: 6px;
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

// ---- 留言 ----
// 貓名標籤原本是 absolute 定位在卡片左上角；包一層讓 💬 能接在名字後面
.record_item .name-wrap {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;

    .name {
        position: static;
    }
}

// 不要外框：只有 💬 和數字。全域 button 樣式（width 100%、邊框、底色、padding）每一項都要蓋回來
.comment-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    width: auto;
    height: 22px;
    padding: 0 2px;
    border: none;
    background: none;
    color: #999;
    font-size: 13px;
    line-height: 22px;
    cursor: pointer;

    &.has {
        color: #6da2c2;
        font-weight: 500;
    }

    // 上一班有交代
    .handover-dot {
        position: absolute;
        top: 0;
        right: -4px;
        width: 8px;
        height: 8px;
        border: 1.5px solid #fff;
        border-radius: 50%;
        background: #e6a23c;
    }
}

:deep(.comment-drawer) {
    border-radius: 14px 14px 0 0;

    .el-drawer__body {
        display: flex;
        flex-direction: column;
        padding: 0;
    }
}

.cd-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #eee;

    .cd-title {
        font-size: 16px;
        font-weight: 500;
    }

    .cd-tab {
        font-size: 13px;
        color: #6da2c2;
    }

    .cd-close {
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

.cd-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 16px 8px;
    text-align: left;
}

.cd-section {
    margin-top: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #8e8783;
}

.cd-item {
    padding: 8px 0;
    border-bottom: 1px solid #f2f0ee;

    &.handover {
        margin: 4px 0;
        padding: 8px 10px;
        border: none;
        border-radius: 6px;
        background: #fdf6ec;
    }
}

.cd-meta {
    font-size: 12px;
    color: #999;

    .cd-next {
        margin-left: 6px;
        padding: 0 5px;
        border-radius: 3px;
        background: #fdf6ec;
        color: #b36b00;
    }
}

.cd-body {
    font-size: 15px;
    line-height: 1.5;
    color: #222;
    white-space: pre-line;
}

.cd-empty {
    padding: 14px 0;
    font-size: 14px;
    color: #aaa;
}

.cd-input {
    padding: 10px 16px 16px;
    border-top: 1px solid #eee;

    // 全域把 textarea 設成至少 100px，這裡一行起跳
    :deep(.el-textarea__inner) {
        min-height: 40px !important;
    }

    .cd-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
    }

    // 頁面把 el-checkbox 排成上下兩層，這裡改回左右並排
    .cd-for-next {
        flex-direction: row;
        gap: 6px;
        width: auto;

        :deep(.el-checkbox__label) {
            padding: 0;
            font-size: 14px;
        }
    }

    .cd-send {
        width: auto;
        height: 36px;
        padding: 0 18px;
        border: none;
        border-radius: 8px;
        background: #6da2c2;
        color: #fff;
        font-size: 14px;
        cursor: pointer;

        &:disabled {
            cursor: default;
            opacity: 0.4;
        }
    }
}
</style>
