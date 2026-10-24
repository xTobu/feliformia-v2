<template>
    <ClientOnly>
        <div id="cat-profile">
            <NuxtLink to="/cats" class="back-link">← 貓咪列表</NuxtLink>

            <div v-if="!cat" class="state">{{ loadingCat ? '載入中...' : '找不到這隻貓' }}</div>
            <template v-else>
                <!-- 頁首：頭像、名字、位置，備註一行一點（紅色圖釘） -->
                <header class="cp-head">
                    <span class="cp-avatar">
                        <img v-if="cat.avatar_path" :src="avatarUrl(cat.avatar_path)" alt="" />
                        <template v-else>{{ cat.name.charAt(0) }}</template>
                    </span>
                    <div class="cp-title">
                        <div class="cp-name-row">
                            <h1 class="cp-name">{{ cat.name }}</h1>
                            <button v-if="isAdmin" type="button" class="cp-edit" aria-label="編輯" @click="editCat">
                                <Icon icon="fa6-regular:pen-to-square" width="16" />
                            </button>
                        </div>
                        <div v-if="cat.nicknames?.length" class="cp-nicknames">{{ cat.nicknames.join('、') }}</div>
                        <div class="cp-tags">
                            <span v-if="cat.location" class="cp-tag location">
                                <Icon icon="mdi:map-marker" width="13" />{{ cat.location }}
                            </span>
                            <span v-if="cat.adopted" class="cp-tag adopted">已領養</span>
                        </div>
                    </div>
                </header>
                <ul v-if="noteLines.length" class="cp-notes">
                    <li v-for="(line, i) in noteLines" :key="i">
                        <Icon icon="mdi:pin" width="15" class="pin" />
                        <span>{{ line }}</span>
                    </li>
                </ul>

                <div class="cp-tabs" role="tablist">
                    <button
                        v-for="t in VIEW_TABS"
                        :key="t.key"
                        type="button"
                        role="tab"
                        :class="{ on: view === t.key }"
                        :aria-selected="view === t.key"
                        @click="view = t.key"
                    >
                        {{ t.label }}
                    </button>
                </div>

                <!-- ========== 日常：一班一段，新的在前，往下滑載入更早的 ========== -->
                <div v-show="view === 'timeline'">
                    <!-- 別人新留言進來、但那一班不在畫面上：頂端提示，點了捲過去 -->
                    <button v-if="newComments.length" type="button" class="tl-new-pill" @click="goToNewComment">
                        <Icon icon="mdi:arrow-up" width="15" />{{ newComments.length }} 則新留言
                    </button>
                    <!-- 篩選：左邊日期鈕（點開有快選與自訂日期），右邊篩選鈕（點開列出內容，與留言、照片要看哪些分頁，可複選） -->
                    <div class="tl-filters">
                        <div class="tl-filter-row">
                            <span class="tl-date-btn" :class="{ on: hasRange, open: dateOpen }">
                                <button type="button" class="tl-date-main" @click="togglePanel('date')">
                                    <Icon v-if="!hasRange" icon="mdi:calendar-blank-outline" width="14" />{{ rangeLabel }}
                                </button>
                                <button
                                    v-if="hasRange"
                                    type="button"
                                    class="tl-date-clear"
                                    aria-label="清除日期"
                                    @click="clearRange"
                                >
                                    <Icon icon="mdi:close" width="13" />
                                </button>
                            </span>
                            <button
                                type="button"
                                class="tl-filter-btn"
                                :class="{ on: filtered, open: filterOpen }"
                                @click="togglePanel('filter')"
                            >
                                <Icon icon="mdi:tune-variant" width="14" />篩選
                                <span v-if="filtered" class="tl-filter-dot" aria-label="有篩選"></span>
                            </button>
                        </div>
                        <div v-if="filterOpen" class="tl-date-panel">
                            <div>
                                <div class="tl-panel-label">內容</div>
                                <div class="tl-quick">
                                    <button
                                        v-for="k in SHOW_KINDS"
                                        :key="k.key"
                                        type="button"
                                        class="tl-kind"
                                        :class="{ on: show[k.key] }"
                                        @click="toggleShow(k.key)"
                                    >
                                        <Icon :icon="k.icon" width="14" />{{ k.label }}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <div class="tl-panel-label">留言與照片</div>
                                <div class="tl-quick">
                                    <button
                                        v-for="key in FILTER_TABS"
                                        :key="key"
                                        type="button"
                                        class="tl-tab-chip"
                                        :class="[key, { on: tabsOn[key] }]"
                                        @click="toggleTab(key)"
                                    >
                                        {{ TAB_LABELS[key] }}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div v-if="dateOpen" class="tl-date-panel">
                            <div class="tl-quick">
                                <button
                                    v-for="q in QUICK_RANGES"
                                    :key="q.days"
                                    type="button"
                                    class="tl-kind"
                                    :class="{ on: quickActive(q.days) }"
                                    @click="pickQuick(q.days)"
                                >
                                    {{ q.label }}
                                </button>
                            </div>
                            <div class="tl-range">
                                <el-date-picker
                                    v-model="range.from"
                                    type="date"
                                    value-format="YYYY-MM-DD"
                                    format="MM/DD"
                                    placeholder="開始"
                                    :editable="false"
                                    :clearable="false"
                                    :disabled-date="(d) => isFuture(d) || (range.to && dayOf(d) > range.to)"
                                />
                                <span class="tl-range-sep">–</span>
                                <el-date-picker
                                    v-model="range.to"
                                    type="date"
                                    value-format="YYYY-MM-DD"
                                    format="MM/DD"
                                    placeholder="結束"
                                    :editable="false"
                                    :clearable="false"
                                    :disabled-date="(d) => isFuture(d) || (range.from && dayOf(d) < range.from)"
                                />
                            </div>
                        </div>
                    </div>

                    <section v-for="entry in visibleEntries" :key="entry.shift_id" class="tl-entry">
                        <!-- 點日期列到值班記錄表的那一班 -->
                        <NuxtLink :to="`/shift?date=${entry.date}&shift=${entry.shift}`" class="tl-shift">
                            <span class="tl-date">{{ dateLabel(entry.date) }}</span>
                            <span class="tl-shift-tag" :class="entry.shift">{{ SHIFT_LABELS[entry.shift] }}</span>
                            <span v-if="entry.ongoing" class="tl-ongoing">進行中</span>
                            <Icon icon="mdi:chevron-right" width="18" class="tl-shift-go" />
                        </NuxtLink>
                        <!-- 一班分三區，各有小標：值班、留言、照片。留言、照片沒有也顯示小標（留言 0），篩選關掉的才不出現 -->
                        <div class="tl-card">
                            <!-- 值班：觀察分頁的飲食如廁（上一班放風的不用登記）、這班放風、各分頁的未完成 -->
                            <div v-if="entry.showDuty" class="tl-sec">
                                <div class="tl-sec-title">
                                    <Icon icon="mdi:clipboard-check-outline" width="15" />值班
                                    <!-- 前班放風：剛到時貓已經在外面（上一班離開時放的）；本班放風：這班走的時候放出來。
                                         開著「值班」就兩個都顯示：有放綠底、沒放灰色虛線框 -->
                                    <template v-if="entry.showIntake">
                                        <span class="tl-flag" :class="{ off: !entry.prev_released }">前班放風</span>
                                        <span class="tl-flag" :class="{ off: !entry.released }">本班放風</span>
                                    </template>
                                </div>
                                <template v-if="entry.showIntake">
                                    <div v-if="entry.prev_released" class="tl-intake tl-muted">不用登記</div>
                                    <div v-else-if="!isIntakeTouched(entry.intake)" class="tl-intake tl-muted">沒有登記</div>
                                    <!-- 飲食如廁四格：乾乾、罐罐、尿、便，位置固定 -->
                                    <div v-else class="tl-cells">
                                        <div
                                            v-for="c in intakeCells(entry.intake)"
                                            :key="c.label"
                                            class="tl-cell"
                                            :class="{ warn: c.warn }"
                                        >
                                            <span class="tl-cell-label">{{ c.label }}</span>
                                            <span class="tl-cell-value" :class="{ empty: c.value === null }">{{ c.value ?? '—' }}</span>
                                        </div>
                                    </div>
                                </template>
                                <div v-if="entry.unfinished.length" class="tl-missing">
                                    <div class="tl-missing-title">未完成 {{ entry.unfinished.length }} 項</div>
                                    <div v-for="row in entry.unfinished" :key="row.key" class="tl-missing-row">
                                        <span class="tl-tab" :class="row.tab">{{ TAB_LABELS[row.tab] }}</span>
                                        <span>
                                            <!-- 類別跟分頁同名（醫療）就不重複寫 -->
                                            <span v-if="row.tag && row.tag !== TAB_LABELS[row.tab]" class="tl-missing-tag">{{
                                                row.tag
                                            }}</span>{{ row.content }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- 留言：照分頁分組（觀察、醫療、備餐、收尾），左邊是分頁標籤 -->
                            <div v-if="show.comments" class="tl-sec">
                                <div class="tl-sec-title">
                                    <Icon icon="mdi:message-text-outline" width="15" />留言 {{ entry.comments.length }}
                                </div>
                                <div v-for="group in byTab(entry.comments)" :key="group.tab" class="tl-group">
                                    <div class="tl-group-head">
                                        <span class="tl-tab" :class="group.tab">{{ TAB_LABELS[group.tab] }}</span>
                                    </div>
                                    <div class="tl-group-body">
                                        <!-- 跟留言頻道一樣：頭像、名字、時間，下面是有尾巴的氣泡；勾了「重要」的是橘色氣泡 -->
                                        <div
                                            v-for="message in group.items"
                                            :key="message.id"
                                            class="tl-comment"
                                            :class="{ important: message.for_next, flash: flashIds.includes(message.id) }"
                                            :data-comment-id="message.id"
                                        >
                                            <span
                                                class="tl-author-avatar"
                                                :style="message.author_avatar ? null : authorAvatarStyle(message.author_name)"
                                            >
                                                <img v-if="message.author_avatar" :src="avatarUrl(message.author_avatar)" alt="" />
                                                <template v-else>{{ authorInitial(message.author_name) }}</template>
                                            </span>
                                            <div class="tl-comment-main">
                                                <div class="tl-comment-meta">
                                                    <b>{{ message.author_name || '未命名' }}</b>
                                                    <span>{{ timeOf(message.created_at, entry.date) }}</span>
                                                    <span v-if="message.for_next" class="tl-important">重要</span>
                                                    <span v-if="message.edited_at && !message.body">已編輯</span>
                                                </div>
                                                <div v-if="message.body" class="tl-line">
                                                    <div class="tl-bubble">{{ message.body }}</div>
                                                    <span v-if="message.edited_at" class="tl-edited">已編輯</span>
                                                </div>
                                                <!-- 附的照片：小縮圖（同留言頻道），點了看大圖 -->
                                                <div v-if="message.photos.length" class="tl-comment-photos">
                                                    <button
                                                        v-for="(photo, i) in message.photos"
                                                        :key="photo.id"
                                                        type="button"
                                                        class="tl-comment-photo"
                                                        aria-label="看大圖"
                                                        @click="openCommentPhotos(entry, message, i)"
                                                    >
                                                        <img :src="photo.thumb_url" alt="" loading="lazy" />
                                                        <span
                                                            v-for="kind in (photo.kinds || []).filter(isObserveKind)"
                                                            :key="kind"
                                                            class="tl-comment-photo-kind"
                                                            >{{ kind }}</span
                                                        >
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 照片：照片庫的（直接上傳的與留言附的），照分頁分組。留言附的右下角一個小泡泡 -->
                            <div v-if="show.photos" class="tl-sec">
                                <div class="tl-sec-title">
                                    <Icon icon="mdi:image-outline" width="15" />照片 {{ entry.photos.length }}
                                </div>
                                <div v-for="group in byTab(entry.photos)" :key="group.tab" class="tl-group">
                                    <div class="tl-group-head">
                                        <span class="tl-tab" :class="group.tab">{{ TAB_LABELS[group.tab] }}</span>
                                    </div>
                                    <div class="tl-group-body tl-photos">
                                        <button
                                            v-for="(photo, i) in group.items"
                                            :key="photo.id"
                                            type="button"
                                            class="tl-thumb"
                                            @click="openPhotos(entry, group.items, i)"
                                        >
                                            <img :src="photo.thumb_url" alt="" loading="lazy" />
                                            <span
                                                v-if="photo.kinds?.length"
                                                class="tl-thumb-kind"
                                                :class="{ observe: isObserveKind(photo.kinds[0]) }"
                                            >
                                                {{ photo.kinds[0]
                                                }}<template v-if="photo.kinds.length > 1"> +{{ photo.kinds.length - 1 }}</template>
                                            </span>
                                            <span v-if="photo.comment_id" class="tl-thumb-comment" aria-label="留言附的照片">
                                                <Icon icon="mdi:message-text" width="11" />
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div ref="sentinel" class="state">
                        <template v-if="loadError">
                            載入失敗<button type="button" class="retry" @click="loadMore">再試一次</button>
                        </template>
                        <template v-else-if="loadingMore">載入中...</template>
                        <template v-else-if="!hasMore">
                            <template v-if="!visibleEntries.length">這段期間沒有紀錄</template>
                            <template v-else-if="range.from">這段期間的紀錄就這些</template>
                            <template v-else>沒有更早的紀錄了</template>
                        </template>
                    </div>
                </div>

                <!-- ========== 小檔案：目前有的資料；驅蟲、預防針、就醫之後再加 ========== -->
                <div v-show="view === 'profile'" class="pf-grid">
                    <div class="pf-card">
                        <div class="pf-label"><Icon icon="mdi:home-heart" width="15" />入住日</div>
                        <template v-if="cat.arrived_on">
                            <div class="pf-value">{{ fullDate(cat.arrived_on) }}</div>
                            <div v-if="stayText(cat.arrived_on)" class="pf-sub">已入住 {{ stayText(cat.arrived_on) }}</div>
                        </template>
                        <div v-else class="pf-empty">未填</div>
                    </div>
                    <div class="pf-card">
                        <div class="pf-label"><Icon icon="mdi:cake-variant-outline" width="15" />估計年齡</div>
                        <template v-if="cat.birth_month">
                            <div class="pf-value">{{ catAgeText(cat.birth_month) || '—' }}</div>
                            <div class="pf-sub">推估生日 {{ monthLabel(cat.birth_month) }}</div>
                        </template>
                        <div v-else class="pf-empty">未填</div>
                    </div>
                    <div class="pf-card">
                        <div class="pf-label"><Icon icon="mdi:paw" width="15" />基本資料</div>
                        <div class="pf-value small">{{ basics }}</div>
                        <div v-if="cat.coats?.length" class="pf-sub">{{ cat.coats.join('、') }}</div>
                    </div>
                    <div class="pf-card">
                        <div class="pf-label"><Icon icon="mdi:content-cut" width="15" />結紮</div>
                        <div v-if="cat.neutered === null" class="pf-empty">不確定</div>
                        <div v-else class="pf-value">{{ cat.neutered ? '已結紮' : '未結紮' }}</div>
                    </div>
                    <div class="pf-card">
                        <div class="pf-label"><Icon icon="mdi:bug-outline" width="15" />驅蟲</div>
                        <div class="pf-empty">尚無紀錄</div>
                    </div>
                    <div class="pf-card">
                        <div class="pf-label"><Icon icon="mdi:needle" width="15" />預防針</div>
                        <div class="pf-empty">尚無紀錄</div>
                    </div>
                    <div class="pf-card wide">
                        <div class="pf-label"><Icon icon="mdi:hospital-box-outline" width="15" />就醫紀錄</div>
                        <div class="pf-empty">尚無紀錄</div>
                    </div>
                </div>
            </template>

            <PhotoViewer v-model:index="viewerIndex" :photos="viewerPhotos" @close="viewerIndex = null" />

            <!-- 管理員編輯（同後台貓咪管理的視窗）：留在這頁，存好重抓頁首與小檔案；刪掉回清單 -->
            <CatProfileDialog
                v-if="isAdmin && cat"
                v-model="editing"
                :cat="cat"
                @saved="loadCat"
                @deleted="onDeleted"
            />
        </div>
    </ClientOnly>
</template>

<script setup>
// 新版貓咪檔案（cat_profiles）：頁首＋日常（每一班分三區：值班〔飲食如廁、放風、未完成〕、四個分頁的留言、照片）＋小檔案。
// 志工都能看；管理員的「編輯」在這頁打開編輯視窗（components/CatProfileDialog.vue）
import { Icon } from '@iconify/vue';
import { catAgeText, stayText } from '~/composables/catTraits';
import { intakeCells, isIntakeTouched } from '~/composables/intake';
import { isObserveKind } from '~/composables/photoKinds';

definePageMeta({
    middleware: 'auth',
    ssr: false,
});

const route = useRoute();
const supabase = useSupabaseClient();
const { $dayjs } = useNuxtApp();
const { avatarUrl } = useAvatar();
const { isAdmin } = useProfile();

const VIEW_TABS = [
    { key: 'timeline', label: '日常' },
    { key: 'profile', label: '小檔案' },
];
const SHIFT_LABELS = { morning: '早班', night: '晚班' };
const TAB_LABELS = { arrive: '觀察', care: '醫療', meal: '備餐', required: '收尾' };
const SHOW_KINDS = [
    { key: 'duty', label: '值班', icon: 'mdi:clipboard-check-outline' },
    { key: 'unfinished', label: '未完成', icon: 'mdi:alert-circle-outline' },
    { key: 'comments', label: '留言', icon: 'mdi:message-text-outline' },
    { key: 'photos', label: '照片', icon: 'mdi:image-outline' },
];
const WEEKDAYS = '日一二三四五六';

const catId = computed(() => Number(route.params.id));
const cat = ref(null);
const loadingCat = ref(true);
const view = ref('timeline');

useHead({ title: computed(() => (cat.value ? `${cat.value.name}｜貓咪檔案` : '貓咪檔案')) });

// 備註一行一點；手打的「-」「・」之類的開頭拿掉，圖釘就是項目符號
const noteLines = computed(() =>
    (cat.value?.notes || '')
        .split('\n')
        .map((line) => line.trim().replace(/^[-–•・*]\s*/, ''))
        .filter(Boolean)
);

const basics = computed(() => {
    const c = cat.value;
    return [c.sex ? `${c.sex}貓` : '性別不確定', c.coat_length].filter(Boolean).join('・');
});

const fullDate = (date) => $dayjs(date).format('YYYY/MM/DD');
const monthLabel = (date) => $dayjs(date).format('YYYY 年 M 月');
const dateLabel = (date) => {
    const d = $dayjs(date);
    const year = d.year() === $dayjs().year() ? '' : `${d.year()}/`;
    return `${year}${d.format('MM/DD')}（${WEEKDAYS[d.day()]}）`;
};
// 當班的只寫時間；之後才補的連日期一起寫
const timeOf = (at, date) => {
    const t = $dayjs(at);
    return t.format(t.format('YYYY-MM-DD') === date ? 'HH:mm' : 'MM/DD HH:mm');
};

const editing = ref(false);
function editCat() {
    editing.value = true;
}

// 刪掉了：回貓咪清單（這頁已經沒東西了，不留在上一頁紀錄裡）
function onDeleted() {
    navigateTo('/cats', { replace: true });
}

async function loadCat() {
    const { data } = await supabase.from('cat_profiles').select('*').eq('id', catId.value).maybeSingle();
    cat.value = data;
}

// ---- 日常 ----
const entries = ref([]);
const cursor = ref(null);
const hasMore = ref(true);
const loadingMore = ref(false);
const loadError = ref(false);
const range = reactive({ from: null, to: null });
const dayOf = (d) => $dayjs(d).format('YYYY-MM-DD');

// 日期鈕：沒選是「全部日期」；選了顯示那一段（只選一頭就寫「10/18 起」「到 10/24」），旁邊 ✕ 清掉
const QUICK_RANGES = [
    { days: 0, label: '全部' },
    { days: 3, label: '近 3 天' },
    { days: 7, label: '近 7 天' },
    { days: 30, label: '近 30 天' },
];
const dateOpen = ref(false);
const hasRange = computed(() => !!(range.from || range.to));
const shortDate = (date) => $dayjs(date).format('M/D');
const rangeLabel = computed(() => {
    if (range.from && range.to) {
        if (range.from === range.to) return shortDate(range.from);
        // 同一個月只寫一次月份：10/18–24
        const sameMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
        return `${shortDate(range.from)}–${sameMonth ? $dayjs(range.to).format('D') : shortDate(range.to)}`;
    }
    if (range.from) return `${shortDate(range.from)} 起`;
    if (range.to) return `到 ${shortDate(range.to)}`;
    return '全部日期';
});
// 近 N 天：含今天往前 N 天，結束不填（一直到今天）
const quickFrom = (days) => $dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD');
const quickActive = (days) => (days ? range.from === quickFrom(days) && !range.to : !hasRange.value);
function pickQuick(days) {
    range.from = days ? quickFrom(days) : null;
    range.to = null;
    dateOpen.value = false;
}
function clearRange() {
    range.from = null;
    range.to = null;
    dateOpen.value = false;
}
const isFuture = (d) => $dayjs(d).isAfter($dayjs(), 'day');
const show = reactive({ duty: true, unfinished: true, comments: true, photos: true });
const sentinel = ref(null);
let generation = 0; // 改了日期就重來，舊的請求回來不要用

// 至少留一種
function toggleShow(key) {
    if (show[key] && Object.values(show).filter(Boolean).length === 1) return;
    show[key] = !show[key];
}

// 留言與照片要看哪些分頁（觀察、醫療、備餐）：一樣至少留一個。
// 收尾不列：只有指定給貓的收尾事項才有留言，很少；有的話一直顯示、不受這裡影響
const FILTER_TABS = ['arrive', 'care', 'meal'];
const tabsOn = reactive(Object.fromEntries(FILTER_TABS.map((tab) => [tab, true])));
const tabShown = (tab) => tabsOn[tab] ?? true;
function toggleTab(key) {
    if (tabsOn[key] && Object.values(tabsOn).filter(Boolean).length === 1) return;
    tabsOn[key] = !tabsOn[key];
}
// 有任何一項關掉：篩選鈕變淡藍底、多一個小點
const filtered = computed(() => [...Object.values(show), ...Object.values(tabsOn)].some((on) => !on));

// 日期與篩選的面板一次只開一個
const filterOpen = ref(false);
function togglePanel(which) {
    const opening = which === 'date' ? !dateOpen.value : !filterOpen.value;
    dateOpen.value = which === 'date' && opening;
    filterOpen.value = which === 'filter' && opening;
}

// 照篩選留下要顯示的
// 一串留言或照片照分頁分組，分頁照值班表的順序；沒有的分頁不出現
const byTab = (list) =>
    Object.keys(TAB_LABELS)
        .map((tab) => ({ tab, items: list.filter((x) => x.tab === tab) }))
        .filter((g) => g.items.length);

// 分頁篩選只管留言與照片；值班區照內容的「值班」「未完成」兩個開關
const visibleEntries = computed(() =>
    entries.value
        .map((e) => {
            // 值班區：「值班」管飲食如廁與放風，「未完成」管未完成那塊，兩個分開開關
            const duty = show.duty && e.in_shift;
            const unfinished = show.unfinished && e.in_shift ? e.unfinished : [];
            return {
                ...e,
                showIntake: duty,
                unfinished,
                showDuty: duty || unfinished.length > 0,
                comments: show.comments ? e.comments.filter((m) => tabShown(m.tab)) : [],
                photos: show.photos ? e.photos.filter((p) => tabShown(p.tab)) : [],
            };
        })
        // 留言、照片的小標沒有也顯示（留言 0），所以班都留著；只有整張卡什麼區都沒有才拿掉
        // （例：只開值班，但這班值班表上沒有這隻貓）
        .filter((e) => e.showDuty || show.comments || show.photos)
);

async function loadMore() {
    if (loadingMore.value || !hasMore.value) return;
    const run = generation;
    loadingMore.value = true;
    loadError.value = false;
    try {
        const res = await $fetch('/api/cats/timeline', {
            query: {
                catId: catId.value,
                before: cursor.value || undefined,
                from: range.from || undefined,
                to: range.to || undefined,
            },
        });
        if (run !== generation) return;
        entries.value = [...entries.value, ...res.entries];
        cursor.value = res.cursor;
        hasMore.value = res.hasMore;
    } catch (e) {
        if (run === generation) loadError.value = true;
    } finally {
        if (run === generation) loadingMore.value = false;
    }
    if (run === generation) {
        await nextTick();
        fillViewport();
    }
}

// 載完畫面還沒滿（或這一批的班都被篩掉了），底部那行還看得到就再往前載
function fillViewport() {
    const el = sentinel.value;
    if (!el || !hasMore.value || loadError.value || view.value !== 'timeline') return;
    if (el.getBoundingClientRect().top < window.innerHeight + 200) loadMore();
}

// ---- 篩選與日期記在這台裝置（localStorage），每隻貓共用 ----
// 快選（近 N 天）記成天數，下次打開照當天重算；自訂的起訖記原本的日期
const storage = useLocalStorage();
const FILTER_KEY = 'cat_profile_filters';

function restoreFilters() {
    const saved = storage.get(FILTER_KEY);
    if (!saved || typeof saved !== 'object') return;
    if (saved.quick && QUICK_RANGES.some((q) => q.days === saved.quick)) range.from = quickFrom(saved.quick);
    else {
        const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
        if (isDay(saved.from)) range.from = saved.from;
        if (isDay(saved.to) && (!range.from || saved.to >= range.from)) range.to = saved.to;
    }
    // 開關：至少留一個開著（存壞了就用預設全開）
    const restore = (target, values) => {
        const keys = Object.keys(target);
        if (!values || !keys.some((k) => values[k] !== false)) return;
        for (const k of keys) target[k] = values[k] !== false;
    };
    restore(show, saved.show);
    restore(tabsOn, saved.tabs);
}

function saveFilters() {
    const quick = QUICK_RANGES.find((q) => q.days && quickActive(q.days))?.days;
    storage.set(FILTER_KEY, {
        ...(quick ? { quick } : { from: range.from, to: range.to }),
        show: { ...show },
        tabs: { ...tabsOn },
    });
}

// 要在下面的 watch 之前還原，才不會多重載一次
restoreFilters();
watch([() => range.from, () => range.to, show, tabsOn], saveFilters, { deep: true });

function resetTimeline() {
    generation += 1;
    entries.value = [];
    cursor.value = null;
    hasMore.value = true;
    loadingMore.value = false;
    loadError.value = false;
    loadMore();
}

watch(() => [range.from, range.to], resetTimeline);
// 篩選變了，畫面可能變短
watch([show, tabsOn], () => nextTick(fillViewport));
watch(view, () => nextTick(fillViewport));

let observer = null;
watch(sentinel, (el) => {
    observer?.disconnect();
    if (!el) return;
    observer = new IntersectionObserver((list) => list[0].isIntersecting && loadMore(), { rootMargin: '200px' });
    observer.observe(el);
});
onBeforeUnmount(() => observer?.disconnect());

// ---- 即時（Broadcast，見 composables/useBroadcast.js）----
// 留言：這隻貓四個分頁的留言頻道 comments:<貓>:<分頁>（留言板新增、編輯、刪除都會發）。
// 值班與照片：進行中的班（今天的，最多兩班）的頻道 shift:<id>（打勾、登記、放風、照片庫）。
// 收到就把那一天重抓（只抓一天，留言、照片、未完成一起對上）；斷線重連、從背景回來超過 30 秒就從頭重載
const { join: joinBroadcast } = useBroadcast();
const commentChannels = [];
const shiftChannels = new Map(); // shift_id → 頻道

const entryOrder = (e) => `${e.date}-${e.shift === 'night' ? 1 : 0}`;

// 重抓某一天：換掉畫面上那天的班。比已載入最舊那天還早的不用管（往下滑到時自然會載）
async function refreshDate(date) {
    if ((range.from && date < range.from) || (range.to && date > range.to)) return;
    const oldest = entries.value.at(-1)?.date;
    if (hasMore.value && oldest && date < oldest) return;
    const run = generation;
    try {
        const res = await $fetch('/api/cats/timeline', { query: { catId: catId.value, from: date, to: date } });
        if (run !== generation) return;
        entries.value = [...entries.value.filter((e) => e.date !== date), ...res.entries].sort((a, b) =>
            entryOrder(b).localeCompare(entryOrder(a))
        );
    } catch (e) {
        console.error('refresh cat timeline error:', e);
    }
}

const dateOfShift = (shiftId) => entries.value.find((e) => e.shift_id === shiftId)?.date;
const hasComment = (id) => entries.value.some((e) => e.comments.some((m) => m.id === id));

async function onRemoteMessage({ action, message, id }) {
    if (action === 'delete') {
        const entry = entries.value.find((e) => e.comments.some((m) => m.id === id));
        if (entry) await refreshDate(entry.date);
        newComments.value = newComments.value.filter((x) => x !== id);
        return;
    }
    if (!message?.date) return;
    const isNew = !hasComment(message.id);
    await refreshDate(message.date);
    if (isNew && hasComment(message.id)) announceComment(message.id);
}

function joinCommentChannels() {
    for (const tab of Object.keys(TAB_LABELS)) {
        commentChannels.push(
            joinBroadcast(`comments:${catId.value}:${tab}`, { message: onRemoteMessage }, { onResync: resetTimeline })
        );
    }
}

// 進行中的班一變（例如晚班開了），頻道跟著換
const ongoingIds = computed(() => entries.value.filter((e) => e.ongoing).map((e) => e.shift_id));
watch(ongoingIds, (ids) => {
    for (const [id, channel] of shiftChannels) {
        if (!ids.includes(id)) {
            channel.leave();
            shiftChannels.delete(id);
        }
    }
    for (const id of ids) {
        if (shiftChannels.has(id)) continue;
        const refresh = () => {
            const date = dateOfShift(id);
            if (date) refreshDate(date);
        };
        shiftChannels.set(id, joinBroadcast(`shift:${id}`, { ops: refresh, comment: refresh, photo: refresh }));
    }
});

onBeforeUnmount(() => {
    commentChannels.forEach((c) => c.leave());
    shiftChannels.forEach((c) => c.leave());
});

// ---- 新留言提示：看得到就閃一下；不在畫面上就累積到頂端的「↑ N 則新留言」 ----
const flashIds = ref([]);
const newComments = ref([]); // 還沒看到的新留言 id，新的在前

const commentEl = (id) => document.querySelector(`[data-comment-id="${id}"]`);
function inView(el) {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
}

function flash(id) {
    flashIds.value = [...flashIds.value, id];
    setTimeout(() => (flashIds.value = flashIds.value.filter((x) => x !== id)), 2000);
}

async function announceComment(id) {
    await nextTick();
    const el = commentEl(id);
    if (!el) return; // 被篩選藏起來了
    if (view.value === 'timeline' && inView(el)) flash(id);
    else newComments.value = [id, ...newComments.value.filter((x) => x !== id)];
}

function goToNewComment() {
    const id = newComments.value[0];
    newComments.value = [];
    const el = id && commentEl(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 等捲得差不多再閃，到的時候才看得到
    setTimeout(() => flash(id), 400);
}

// 自己捲到了：從提示裡拿掉、閃一下
function checkSeen() {
    if (!newComments.value.length) return;
    const seen = newComments.value.filter((id) => {
        const el = commentEl(id);
        return !el || inView(el);
    });
    if (!seen.length) return;
    newComments.value = newComments.value.filter((id) => !seen.includes(id));
    seen.forEach((id) => commentEl(id) && flash(id));
}
onMounted(() => window.addEventListener('scroll', checkSeen, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', checkSeen));

// ---- 看大圖：照片區的照片，或一則留言附的照片，左右換 ----
// viewer：{ entry, photos, comment（從留言打開的才有：那則留言；照片區的留言照片帶在 photo.comment） }
const viewer = ref(null);
const viewerIndex = ref(null);
const viewerPhotos = computed(() => {
    if (!viewer.value) return [];
    const { entry, photos, comment } = viewer.value;
    return photos.map((p) => ({
        url: p.url,
        label: `${$dayjs(entry.date).format('MM/DD')} ${SHIFT_LABELS[entry.shift]}・${TAB_LABELS[p.tab]}`,
        meta: `${p.author_name || '未命名'} ${timeOf(p.created_at, entry.date)}${(comment || p.comment)?.edited_at ? '（已編輯）' : ''}`,
        kinds: p.kinds,
        text: p.comment_id ? (comment || p.comment)?.body : p.note,
        textKind: p.comment_id ? 'comment' : 'note',
    }));
});

// 照片區：同一個分頁的照片左右換。留言附的顯示那則留言
function openPhotos(entry, photos, index) {
    viewer.value = { entry, photos };
    viewerIndex.value = index;
}

function openCommentPhotos(entry, message, index) {
    viewer.value = { entry, photos: message.photos, comment: message };
    viewerIndex.value = index;
}

onMounted(async () => {
    await loadCat();
    loadingCat.value = false;
    if (!cat.value) return;
    loadMore();
    joinCommentChannels();
});
</script>

<style lang="scss" scoped>
#cat-profile {
    max-width: 600px;
    margin: 0 auto;
    padding: 12px 16px 80px;
    color: #3d3936;
    text-align: left;
}

.back-link {
    display: inline-block;
    margin-bottom: 12px;
    color: #657181;
    font-size: 14px;
    text-decoration: none;
}

.state {
    padding: 28px 0;
    color: #a8a29e;
    font-size: 14px;
    text-align: center;
}

.retry {
    width: auto;
    margin-left: 8px;
    padding: 2px 10px;
    border: 1px solid #d8d4d1;
    border-radius: 999px;
    background: #fff;
    color: #657181;
    font-size: 13px;
}

// ---- 頁首 ----
.cp-head {
    display: flex;
    align-items: center;
    gap: 16px;
}

.cp-avatar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    overflow: hidden;
    background: #f0eeec;
    color: #8a7f78;
    font-size: 30px;
    font-weight: 500;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.cp-title {
    min-width: 0;
    flex: 1;
}

.cp-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.cp-name {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    line-height: 1.3;
}

.cp-edit {
    display: inline-flex;
    width: auto;
    padding: 6px;
    border: none;
    background: none;
    color: #8a7f78;
}

.cp-nicknames {
    margin-top: 2px;
    color: #8a7f78;
    font-size: 13px;
}

.cp-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.cp-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 10px 2px 8px;
    border-radius: 999px;
    font-size: 13px;

    &.location {
        background: #eef1f5;
        color: #4f5d70;
    }

    &.adopted {
        background: #f3ede4;
        color: #8a6d3b;
    }
}

.cp-notes {
    margin: 16px 0 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: #faf8f6;
    list-style: none;

    li {
        display: flex;
        gap: 6px;
        font-size: 14px;
        line-height: 1.5;

        & + li {
            margin-top: 6px;
        }
    }

    .pin {
        flex-shrink: 0;
        margin-top: 3px;
        color: #c0504d;
    }
}

.cp-tabs {
    display: flex;
    margin: 20px 0 14px;
    border-bottom: 1px solid #e4e0dd;

    button {
        flex: 1;
        width: auto;
        padding: 10px 0;
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        margin-bottom: -1px;
        background: none;
        color: #8a7f78;
        font-size: 15px;

        &.on {
            border-bottom-color: #b33a39;
            color: #3d3936;
            font-weight: 600;
        }
    }
}

// ---- 日常 ----
.tl-filters {
    margin-bottom: 8px;
}

.tl-filter-row {
    display: flex;
    justify-content: space-between;
    gap: 6px;
}

// 篩選鈕（靠右）：樣子跟日期鈕一樣；有篩選時淡藍底、右上一個小點
.tl-filter-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: auto;
    padding: 4px 10px;
    border: 1px solid #d8d4d1;
    border-radius: 999px;
    background: #fff;
    color: #4a4542;
    font-size: 13px;

    &.on,
    &.open {
        border-color: #657181;
    }

    &.on {
        background: #eef1f5;
    }
}

.tl-filter-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: #e08a3c;
    box-sizing: content-box;
}

.tl-panel-label {
    margin-bottom: 6px;
    color: #8a7f78;
    font-size: 12px;
}

// 分頁按鈕：開著的用分頁自己的顏色（跟下面的分頁標籤一樣），關掉的白底灰字
.tl-tab-chip {
    width: auto;
    padding: 4px 12px;
    border: 1px solid #e4e0dd;
    border-radius: 999px;
    background: #fff;
    color: #b0a9a4;
    font-size: 13px;

    &.on.arrive {
        border-color: #b9d0ea;
        background: #e8f0f8;
        color: #3f6a99;
    }

    &.on.care {
        border-color: #d3c4ea;
        background: #efe9f7;
        color: #6a4a99;
    }

    &.on.meal {
        border-color: #bcdcc5;
        background: #e9f3ec;
        color: #4f8a5e;
    }
}

.tl-kind {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: auto;
    padding: 4px 8px;
    border: 1px solid #d8d4d1;
    border-radius: 999px;
    background: #fff;
    color: #8a7f78;
    font-size: 13px;

    &.on {
        border-color: #657181;
        background: #657181;
        color: #fff;
    }
}

// 日期鈕：外框膠囊；選了日期變淡藍底、拿掉日曆圖示（擠得下一排），右邊多一個 ✕
.tl-date-btn {
    display: inline-flex;
    align-items: center;
    border: 1px solid #d8d4d1;
    border-radius: 999px;
    background: #fff;
    color: #4a4542;

    &.on,
    &.open {
        border-color: #657181;
    }

    &.on {
        background: #eef1f5;
    }

    button {
        display: inline-flex;
        align-items: center;
        width: auto;
        border: none;
        background: none;
        color: inherit;
        font-size: 13px;
    }
}

.tl-date-main {
    gap: 4px;
    padding: 4px 9px;

    .on & {
        padding-right: 2px;
    }
}

.tl-date-clear {
    padding: 4px 8px 4px 4px;
    color: #8a7f78 !important;
}

.tl-date-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
    padding: 10px;
    border: 1px solid #ece8e5;
    border-radius: 10px;
    background: #fff;
}

.tl-quick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.tl-range {
    display: flex;
    align-items: center;
    gap: 6px;

    :deep(.el-date-editor) {
        width: 120px;
    }
}

.tl-range-sep {
    color: #a8a29e;
}

.tl-entry {
    margin-top: 16px;
}

// 日期列是連結（到值班記錄表那一班）：蓋掉全域 a 的底線、紅字、下邊距
.tl-shift {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    color: inherit;
    text-decoration: none;
}

.tl-shift-go {
    margin-left: -4px;
    color: #b8b2ad;
}

.tl-date {
    font-size: 14px;
    font-weight: 600;
}

.tl-shift-tag {
    padding: 0 8px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 20px;

    &.morning {
        background: #fdf3dc;
        color: #9a6b12;
    }

    &.night {
        background: #e8ebf5;
        color: #4a5687;
    }
}

.tl-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border: 1px solid #ece8e5;
    border-radius: 12px;
    background: #fff;
}

// 一區一個小標（值班、留言、照片），區與區之間一條細線
.tl-sec + .tl-sec {
    padding-top: 12px;
    border-top: 1px solid #f0edea;
}

.tl-sec {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.tl-sec-title {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #8a7f78;
    font-size: 12px;

    .tl-flag {
        margin-left: 4px;
    }
}

.tl-ongoing {
    padding: 0 8px;
    border-radius: 4px;
    background: #eef1f5;
    color: #4f5d70;
    font-size: 12px;
    line-height: 20px;
}

.tl-intake {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    line-height: 1.5;
}

.tl-cells {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
}

.tl-cell {
    display: flex;
    flex-direction: column;
    padding: 4px 8px;
    border-radius: 6px;
    background: #f7f6f5;

    &.warn {
        background: #fdf0f0;

        .tl-cell-value {
            color: #c0504d;
        }
    }
}

.tl-cell-label {
    color: #8a7f78;
    font-size: 11px;
}

.tl-cell-value {
    font-size: 14px;
    font-weight: 600;

    &.empty {
        color: #c9c3be;
        font-weight: 400;
    }
}

.tl-muted {
    color: #a8a29e;
}

// 前班放風、本班放風（放在「值班」小標後面）
.tl-flag {
    padding: 0 8px;
    border: 1px solid #e9f3ec;
    border-radius: 999px;
    background: #e9f3ec;
    color: #4f8a5e;
    font-size: 12px;
    line-height: 18px;

    // 沒放風：灰色虛線框
    &.off {
        border: 1px dashed #e4e0dd;
        background: #fff;
        color: #c9c3be;
    }
}

// 未完成：淡橘底（提醒，跟沒便等異常的紅色分開），一項一行，前面標是哪個分頁
.tl-missing {
    padding: 8px 10px;
    border-radius: 8px;
    background: #fdf3e6;
    font-size: 13px;
}

.tl-missing-title {
    margin-bottom: 4px;
    color: #b8650f;
    font-weight: 600;
}

.tl-missing-row {
    display: flex;
    align-items: baseline;
    gap: 6px;

    & + .tl-missing-row {
        margin-top: 3px;
    }
}

.tl-missing-tag {
    margin-right: 4px;
    color: #8a7f78;
}

// 分頁標籤：跟值班表分頁同一套顏色
.tl-tab {
    padding: 0 6px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 18px;

    &.arrive {
        background: #e8f0f8;
        color: #3f6a99;
    }

    // 醫療用紫色：不跟未完成的橘、異常的紅撞色
    &.care {
        background: #efe9f7;
        color: #6a4a99;
    }

    &.meal {
        background: #e9f3ec;
        color: #4f8a5e;
    }

    &.required {
        background: #efedeb;
        color: #6f6762;
    }
}

// 留言：跟留言頻道（components/ShiftCommentDrawer.vue）同一個樣子
.tl-comment {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0 -6px;
    padding: 2px 6px;
    border-radius: 8px;
    transition: background-color 0.4s;

    // 別人剛留的：底色閃一下（同留言頻道跳到留言）
    &.flash {
        background: #e6f0f6;
    }
}

// 頂端的「↑ N 則新留言」：固定在畫面上方中間（header 不是固定的，捲下去就不在了，所以貼著畫面頂）
.tl-new-pill {
    position: fixed;
    top: 12px;
    left: 50%;
    z-index: 20;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: auto;
    padding: 6px 14px;
    border: none;
    border-radius: 999px;
    background: #657181;
    color: #fff;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: translateX(-50%);
}

.tl-author-avatar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    overflow: hidden;
    font-size: 13px;
    font-weight: 500;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.tl-comment-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    flex: 1;
}

.tl-comment-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 2px 4px;
    color: #999;
    font-size: 12px;

    b {
        color: #4a4542;
        font-size: 13px;
        font-weight: 500;
    }
}

.tl-important {
    padding: 0 5px;
    border-radius: 3px;
    background: #fdf0dc;
    color: #b36b00;
}

// 氣泡＋旁邊的「已編輯」（貼著氣泡底部）
.tl-line {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    max-width: 100%;
    padding-left: 6px; // 留給尾巴
}

.tl-edited {
    flex-shrink: 0;
    color: #aaa;
    font-size: 11px;
}

.tl-bubble {
    --bubble-bg: #f0eeec;
    position: relative;
    min-width: 0;
    max-width: 100%;
    padding: 7px 12px;
    border-radius: 16px;
    background: var(--bubble-bg);
    color: #222;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-line;
    overflow-wrap: anywhere;

    .important & {
        --bubble-bg: #fde9cc;
    }

    // 尾巴：氣泡左上方往左上翹的小勾（同留言頻道）
    &::before {
        content: '';
        position: absolute;
        top: 3px;
        left: -8px;
        width: 14px;
        height: 16px;
        background: var(--bubble-bg);
        -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 16'%3E%3Cpath d='M0 0C2.5 3.2 7.5 4.8 14 4.8V16C6.5 16 1.8 9.5 0 0Z'/%3E%3C/svg%3E") no-repeat center / 100% 100%;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 16'%3E%3Cpath d='M0 0C2.5 3.2 7.5 4.8 14 4.8V16C6.5 16 1.8 9.5 0 0Z'/%3E%3C/svg%3E") no-repeat center / 100% 100%;
    }
}

// 留言附的照片：小縮圖排在氣泡下面（同留言頻道，小一點）
.tl-comment-photos {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
    padding-left: 6px; // 跟氣泡對齊

    .tl-comment-meta + & {
        margin-top: 0;
    }
}

.tl-comment-photo {
    position: relative;
    width: 48px;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: #f2f0ee;
    overflow: hidden;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

// 剩食、貓砂、留餐：左上角暖橘膠囊（同留言頻道）
.tl-comment-photo-kind {
    position: absolute;
    top: 2px;
    left: 2px;
    padding: 0 4px;
    border-radius: 8px;
    background: #e08a3c;
    color: #fff;
    font-size: 11px;
    line-height: 16px;
}

// 留言、照片照分頁分組：每組上面一行分頁色標籤，後面拉一條細線；內容全寬
.tl-group {
    & + .tl-group {
        margin-top: 4px;
    }
}

.tl-group-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;

    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #ece8e5;
    }
}

.tl-group-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.tl-photos {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
}

// 留言附的照片：右下角一個小泡泡
.tl-thumb-comment {
    position: absolute;
    right: 4px;
    bottom: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
}

.tl-thumb {
    position: relative;
    width: 100%;
    padding: 0;
    border: none;
    border-radius: 6px;
    overflow: hidden;
    background: #f0eeec;
    aspect-ratio: 1;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

// 縮圖左上角：第一個類型（跟照片庫同色：觀察要拍的暖橘、其他藍）
.tl-thumb-kind {
    position: absolute;
    top: 4px;
    left: 4px;
    max-width: calc(100% - 8px);
    padding: 0 6px;
    border-radius: 999px;
    background: #6da2c2;
    color: #fff;
    font-size: 11px;
    line-height: 18px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.observe {
        background: #e08a3c;
    }
}

// ---- 小檔案 ----
.pf-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.pf-card {
    padding: 12px;
    border: 1px solid #ece8e5;
    border-radius: 12px;
    background: #fff;

    &.wide {
        grid-column: 1 / -1;
    }
}

.pf-label {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    color: #8a7f78;
    font-size: 13px;
}

.pf-value {
    font-size: 17px;
    font-weight: 600;

    &.small {
        font-size: 15px;
    }
}

.pf-sub {
    margin-top: 2px;
    color: #8a7f78;
    font-size: 12px;
}

.pf-empty {
    color: #b8b2ad;
    font-size: 14px;
}
</style>
