<template>
    <ClientOnly>
        <div id="cat-profile">
            <NuxtLink to="/cats" class="back-link">← 貓咪檔案</NuxtLink>

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

                <!-- ========== 時間軸：一班一段，新的在前，往下滑載入更早的 ========== -->
                <div v-show="view === 'timeline'">
                    <div class="tl-filters">
                        <div class="tl-range">
                            <el-date-picker
                                v-model="range.from"
                                type="date"
                                value-format="YYYY-MM-DD"
                                placeholder="開始日期"
                                :editable="false"
                                :disabled-date="(d) => isFuture(d) || (range.to && dayOf(d) > range.to)"
                            />
                            <span class="tl-range-sep">–</span>
                            <el-date-picker
                                v-model="range.to"
                                type="date"
                                value-format="YYYY-MM-DD"
                                placeholder="結束日期"
                                :editable="false"
                                :disabled-date="(d) => isFuture(d) || (range.from && dayOf(d) < range.from)"
                            />
                        </div>
                        <div class="tl-kinds">
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

                    <section v-for="entry in visibleEntries" :key="entry.shift_id" class="tl-entry">
                        <div class="tl-shift">
                            <span class="tl-date">{{ dateLabel(entry.date) }}</span>
                            <span class="tl-shift-tag" :class="entry.shift">{{ SHIFT_LABELS[entry.shift] }}</span>
                        </div>
                        <div class="tl-card">
                            <!-- 觀察（觀察分頁的飲食如廁）。上一班放風的不用登記 -->
                            <div v-if="entry.showIntake" class="tl-intake">
                                <Icon icon="mdi:silverware-fork-knife" width="15" class="tl-icon" />
                                <span v-if="entry.prev_released" class="tl-muted">
                                    <span class="tl-released">前班放風</span>不用登記
                                </span>
                                <span v-else-if="!isIntakeTouched(entry.intake)" class="tl-muted">沒有登記</span>
                                <span v-else class="tl-intake-text">
                                    <template v-for="(part, i) in intakeParts(entry.intake)" :key="i">
                                        <span v-if="i" class="tl-dot">・</span>
                                        <span :class="{ warn: part.warn }">{{ part.text }}</span>
                                    </template>
                                </span>
                            </div>

                            <!-- 四個分頁的留言，標是哪個分頁 -->
                            <div v-for="message in entry.comments" :key="message.id" class="tl-comment">
                                <span class="tl-author-avatar">
                                    <img v-if="message.author_avatar" :src="avatarUrl(message.author_avatar)" alt="" />
                                    <template v-else>{{ (message.author_name || '？').charAt(0) }}</template>
                                </span>
                                <div class="tl-comment-main">
                                    <div class="tl-comment-meta">
                                        <span class="tl-author">{{ message.author_name || '未命名' }}</span>
                                        <span class="tl-tab" :class="message.tab">{{ TAB_LABELS[message.tab] }}</span>
                                        <span class="tl-time">{{ timeOf(message.created_at, entry.date) }}</span>
                                        <span v-if="message.for_next" class="tl-important">重要</span>
                                    </div>
                                    <div v-if="message.body" class="tl-body">{{ message.body }}</div>
                                    <button
                                        v-if="message.photos.length"
                                        type="button"
                                        class="tl-attach"
                                        @click="openViewer(entry, message.photos[0].id)"
                                    >
                                        <Icon icon="mdi:image-outline" width="14" />附 {{ message.photos.length }} 張照片
                                    </button>
                                </div>
                            </div>

                            <!-- 照片（照片庫的：直接上傳的與留言附的） -->
                            <div v-if="entry.photos.length" class="tl-photos">
                                <button
                                    v-for="photo in entry.photos"
                                    :key="photo.id"
                                    type="button"
                                    class="tl-thumb"
                                    @click="openViewer(entry, photo.id)"
                                >
                                    <img :src="photo.thumb_url" alt="" loading="lazy" />
                                    <span v-if="photo.kinds?.length" class="tl-thumb-kind" :class="{ observe: isObserveKind(photo.kinds[0]) }">
                                        {{ photo.kinds[0] }}<template v-if="photo.kinds.length > 1"> +{{ photo.kinds.length - 1 }}</template>
                                    </span>
                                </button>
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
        </div>
    </ClientOnly>
</template>

<script setup>
// 新版貓咪檔案（cat_profiles）：頁首＋時間軸（每一班的飲食如廁、四個分頁的留言與照片）＋小檔案。
// 志工都能看；管理員的「編輯」到 /admin/cat-profiles 打開這隻貓
import { Icon } from '@iconify/vue';
import { catAgeText, stayText } from '~/composables/catTraits';
import { intakeParts, isIntakeTouched } from '~/composables/intake';
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
    { key: 'timeline', label: '時間軸' },
    { key: 'profile', label: '小檔案' },
];
const SHIFT_LABELS = { morning: '早班', night: '晚班' };
const TAB_LABELS = { arrive: '觀察', care: '醫療', meal: '備餐', required: '收尾' };
const SHOW_KINDS = [
    { key: 'intake', label: '觀察', icon: 'mdi:silverware-fork-knife' },
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

function editCat() {
    navigateTo(`/admin/cat-profiles?edit=${cat.value.id}`);
}

// ---- 時間軸 ----
const entries = ref([]);
const cursor = ref(null);
const hasMore = ref(true);
const loadingMore = ref(false);
const loadError = ref(false);
const range = reactive({ from: null, to: null });
const dayOf = (d) => $dayjs(d).format('YYYY-MM-DD');
const isFuture = (d) => $dayjs(d).isAfter($dayjs(), 'day');
const show = reactive({ intake: true, comments: true, photos: true });
const sentinel = ref(null);
let generation = 0; // 改了日期就重來，舊的請求回來不要用

// 至少留一種
function toggleShow(key) {
    if (show[key] && Object.values(show).filter(Boolean).length === 1) return;
    show[key] = !show[key];
}

// 照篩選留下要顯示的；什麼都沒剩的班不顯示
const visibleEntries = computed(() =>
    entries.value
        .map((e) => ({
            ...e,
            showIntake: show.intake && e.in_shift,
            comments: show.comments ? e.comments : [],
            photos: show.photos ? e.photos : [],
        }))
        .filter((e) => e.showIntake || e.comments.length || e.photos.length)
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
watch(show, () => nextTick(fillViewport));
watch(view, () => nextTick(fillViewport));

let observer = null;
watch(sentinel, (el) => {
    observer?.disconnect();
    if (!el) return;
    observer = new IntersectionObserver((list) => list[0].isIntersecting && loadMore(), { rootMargin: '200px' });
    observer.observe(el);
});
onBeforeUnmount(() => observer?.disconnect());

// ---- 看大圖：這一班的照片（篩選後看得到的）左右換 ----
const viewerEntry = ref(null);
const viewerIndex = ref(null);
const viewerPhotos = computed(() => {
    const entry = viewerEntry.value;
    if (!entry) return [];
    return entry.photos.map((p) => ({
        url: p.url,
        label: `${$dayjs(entry.date).format('MM/DD')} ${SHIFT_LABELS[entry.shift]}・${TAB_LABELS[p.tab]}`,
        meta: `${p.author_name || '未命名'} ${timeOf(p.created_at, entry.date)}${p.comment?.edited_at ? '（已編輯）' : ''}`,
        kinds: p.kinds,
        text: p.comment_id ? p.comment?.body : p.note,
        textKind: p.comment_id ? 'comment' : 'note',
    }));
});

function openViewer(entry, photoId) {
    // 留言附的照片：只看留言時照片區被篩掉了，就用完整的那一班
    const full = entries.value.find((e) => e.shift_id === entry.shift_id);
    viewerEntry.value = full;
    viewerIndex.value = Math.max(0, full.photos.findIndex((p) => p.id === photoId));
}

onMounted(async () => {
    const { data } = await supabase.from('cat_profiles').select('*').eq('id', catId.value).maybeSingle();
    cat.value = data;
    loadingCat.value = false;
    if (data) loadMore();
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

// ---- 時間軸 ----
.tl-filters {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 8px;
}

.tl-range {
    display: flex;
    align-items: center;
    gap: 6px;

    :deep(.el-date-editor) {
        flex: 1;
        width: auto;
    }
}

.tl-range-sep {
    color: #a8a29e;
}

.tl-kinds {
    display: flex;
    gap: 6px;
}

.tl-kind {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: auto;
    padding: 4px 12px;
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

.tl-entry {
    margin-top: 16px;
}

.tl-shift {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
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

.tl-intake {
    display: flex;
    gap: 8px;
    font-size: 14px;
    line-height: 1.5;
}

.tl-icon {
    flex-shrink: 0;
    margin-top: 3px;
    color: #8a7f78;
}

.tl-intake-text .warn {
    color: #c0504d;
    font-weight: 600;
}

.tl-dot {
    color: #c9c3be;
}

.tl-muted {
    color: #a8a29e;
}

.tl-released {
    margin-right: 6px;
    padding: 1px 8px;
    border-radius: 999px;
    background: #e9f3ec;
    color: #4f8a5e;
    font-size: 12px;
}

.tl-comment {
    display: flex;
    gap: 8px;
}

.tl-author-avatar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    background: #f0eeec;
    color: #8a7f78;
    font-size: 12px;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.tl-comment-main {
    min-width: 0;
    flex: 1;
}

.tl-comment-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    line-height: 20px;
}

.tl-author {
    color: #3d3936;
    font-weight: 600;
}

.tl-time {
    color: #a8a29e;
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

    &.care {
        background: #fbeaea;
        color: #b33a39;
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

.tl-important {
    padding: 0 6px;
    border-radius: 4px;
    background: #fde9cc;
    color: #a3620a;
    font-size: 11px;
    line-height: 18px;
}

.tl-body {
    margin-top: 2px;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-line;
    overflow-wrap: anywhere;
}

.tl-attach {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    width: auto;
    margin-top: 4px;
    padding: 0;
    border: none;
    background: none;
    color: #657181;
    font-size: 12px;
}

.tl-photos {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
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
