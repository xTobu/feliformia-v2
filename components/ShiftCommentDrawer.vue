<template>
    <!-- 留言頻道：一隻貓、一個分頁一個頻道，跨班一路往上看，班與班之間有分隔線。
         從下方滑出；最新的在最下面，捲到最上面會載入更早的班。標題列可以切到「照片」看留言裡的所有照片 -->
    <el-drawer
        :model-value="modelValue"
        direction="btt"
        size="72%"
        :with-header="false"
        class="channel-drawer"
        @update:model-value="emit('update:modelValue', $event)"
    >
        <div class="ch-head">
            <span class="ch-title">{{ cat?.name }}</span>
            <span class="ch-tab">{{ tabLabel }}留言</span>
            <div class="ch-switch" role="tablist">
                <button
                    type="button"
                    role="tab"
                    :aria-selected="view === 'messages'"
                    :class="{ on: view === 'messages' }"
                    @click="view = 'messages'"
                >
                    留言
                </button>
                <button
                    type="button"
                    role="tab"
                    :aria-selected="view === 'photos'"
                    :class="{ on: view === 'photos' }"
                    @click="view = 'photos'"
                >
                    照片
                </button>
            </div>
            <!-- 🔍 再按一次就收起搜尋，回到原本的留言或照片 -->
            <button
                type="button"
                class="ch-search-btn"
                :class="{ on: view === 'search' }"
                :aria-pressed="view === 'search'"
                aria-label="搜尋留言"
                @click="toggleSearch"
            >
                🔍
            </button>
            <button type="button" class="ch-close" aria-label="關閉" @click="emit('update:modelValue', false)">
                ✕
            </button>
        </div>

        <!-- ===== 搜尋：這個頻道所有的班都找，點結果跳回那則留言 ===== -->
        <template v-if="view === 'search'">
            <div class="ch-searchbar">
                <el-input
                    ref="searchInput"
                    v-model="searchText"
                    clearable
                    placeholder="搜尋這隻貓的留言"
                    @input="searchSoon"
                />
                <button type="button" class="ch-btn" @click="closeSearch">取消</button>
            </div>
            <div class="ch-list">
                <div v-if="searchLoading" class="ch-hint">搜尋中…</div>
                <div v-else-if="searchedText && !searchResults.length" class="ch-empty">
                    找不到「{{ searchedText }}」
                </div>
                <div v-else-if="searchedText" class="ch-hint">找到 {{ searchResults.length }} 則{{ searchResults.length >= 50 ? '（只列最新 50 則）' : '' }}</div>
                <!-- 一則一列；點右邊的按鈕才跳過去（整列點了不會跳，避免捲動時誤觸）。上次跳過的那則標藍底 -->
                <div
                    v-for="r in searchResults"
                    :key="r.id"
                    :data-result-id="r.id"
                    class="ch-result"
                    :class="{ important: r.for_next, last: r.id === lastJumpId, seen: seenIds.includes(r.id) }"
                >
                    <div class="ch-result-text">
                        <span class="ch-result-meta">
                            {{ shiftText(r) }} · {{ r.author_name || '未命名' }} {{ timeText(r) }}
                            <b v-if="r.id === lastJumpId" class="ch-result-last">上次看的</b>
                            <b v-else-if="seenIds.includes(r.id)" class="ch-result-seen">看過</b>
                        </span>
                        <!-- eslint-disable-next-line vue/no-v-html -- 已先跳脫 HTML，只加上 <mark> -->
                        <span class="ch-result-body" v-html="highlight(r.body, searchedText)"></span>
                    </div>
                    <button type="button" class="ch-result-jump" aria-label="跳到這則留言" @click="jumpFromSearch(r)">
                        ›
                    </button>
                </div>
            </div>
        </template>

        <!-- ===== 留言 ===== -->
        <div v-show="view === 'messages'" ref="listEl" class="ch-list" @scroll="onScroll">
            <div v-if="loadingMore" class="ch-hint">載入更早的留言…</div>
            <div v-else-if="hasMore" class="ch-hint">往上滑看更早的班</div>
            <!-- 更早已經沒有任何班的紀錄（新版值班記錄表開始用之前） -->
            <div v-else-if="loadedShifts.length && !loading" class="ch-hint">已經是最早的班了</div>
            <div v-if="loading" class="ch-hint">載入中…</div>
            <!-- 每一班都有分隔線（沒留言的班也是，看得出滑到哪一天） -->
            <template v-for="group in groups" :key="group.key">
                <div class="ch-divider" :class="{ current: group.isCurrent }">
                    {{ shiftText(group) }}
                </div>
                <div v-if="!group.messages.length" class="ch-none">
                    {{ group.isCurrent ? '這一班還沒有留言' : '沒有留言' }}
                </div>
                <!-- 每則留言都是一組：頭像、名字、時間，下面是氣泡（有指向頭像的尾巴）與照片。
                     所有人（含自己）都靠左；勾了「重要」的氣泡是橘色 -->
                <div
                    v-for="m in group.messages"
                    :key="m.id"
                    :data-id="m.id"
                    class="ch-msg"
                    :class="{ important: m.for_next, editing: editingId === m.id, flash: flashId === m.id }"
                >
                    <div class="ch-avatar" :style="m.author_avatar ? null : avatarStyle(m)">
                        <img v-if="m.author_avatar" :src="avatarUrl(m.author_avatar)" alt="" />
                        <template v-else>{{ initial(m) }}</template>
                    </div>
                    <div class="ch-main">
                        <div class="ch-meta">
                            <b>{{ m.author_name || '未命名' }}</b>
                            <span class="ch-time">{{ timeText(m) }}</span>
                            <span v-if="m.for_next" class="ch-important">重要</span>
                            <!-- 已編輯平常放在氣泡旁；只有照片（文字清空了）時放這裡 -->
                            <span v-if="m.edited_at && !m.body" class="ch-edited">已編輯</span>
                            <!-- 自己的留言才有：編輯、刪除 -->
                            <el-dropdown
                                v-if="isMine(m) && editingId !== m.id"
                                trigger="click"
                                class="ch-more"
                                @command="(cmd) => (cmd === 'edit' ? startEdit(m) : removeMessage(m))"
                            >
                                <button type="button" class="ch-more-btn" aria-label="更多">⋯</button>
                                <template #dropdown>
                                    <el-dropdown-menu>
                                        <el-dropdown-item command="edit">編輯</el-dropdown-item>
                                        <el-dropdown-item command="delete">刪除</el-dropdown-item>
                                    </el-dropdown-menu>
                                </template>
                            </el-dropdown>
                        </div>

                        <div v-if="editingId === m.id" class="ch-edit">
                            <el-input
                                v-model="editDraft"
                                type="textarea"
                                :autosize="{ minRows: 1, maxRows: 6 }"
                                :disabled="savingEdit"
                            />
                            <!-- 照片：原本的可以按 ✕ 拿掉，📷 可以再加（按儲存才真的改） -->
                            <div v-if="editKeptPhotos(m).length || editAttachments.length" class="ch-attachments">
                                <div v-for="photo in editKeptPhotos(m)" :key="photo.id" class="ch-attachment">
                                    <img :src="photo.thumb_url" alt="" />
                                    <button
                                        v-if="!savingEdit"
                                        type="button"
                                        class="ch-attachment-remove"
                                        aria-label="拿掉這張"
                                        @click="editRemovedIds.push(photo.id)"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div v-for="a in editAttachments" :key="a.key" class="ch-attachment">
                                    <img :src="a.previewUrl" alt="" />
                                    <button
                                        v-if="!savingEdit"
                                        type="button"
                                        class="ch-attachment-remove"
                                        aria-label="取消這張"
                                        @click="removeEditAttachment(a)"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div v-if="savingEdit && editAttachments.length" class="ch-progress">
                                <div class="ch-progress-text">
                                    <span>上傳中 {{ editUploadDone }}/{{ editAttachments.length }} 張</span>
                                    <b>{{ editUploadPercent }}%</b>
                                </div>
                                <div class="ch-progress-bar"><i :style="{ width: `${editUploadPercent}%` }"></i></div>
                            </div>
                            <div class="ch-edit-actions">
                                <el-checkbox v-model="editForNext" :disabled="savingEdit" class="ch-for-next">重要</el-checkbox>
                                <button
                                    type="button"
                                    class="ch-attach"
                                    :disabled="savingEdit || editPhotoCount(m) >= MAX_PHOTOS"
                                    aria-label="加照片"
                                    @click="editFileInput?.click()"
                                >
                                    📷
                                </button>
                                <button type="button" class="ch-btn" :disabled="savingEdit" @click="cancelEdit">取消</button>
                                <button type="button" class="ch-btn primary" :disabled="savingEdit" @click="saveEdit(m)">
                                    {{ savingEdit ? '儲存中' : '儲存' }}
                                </button>
                            </div>
                        </div>
                        <div v-else-if="m.body" class="ch-line">
                            <div class="ch-bubble">{{ m.body }}</div>
                            <span v-if="m.edited_at" class="ch-edited">已編輯</span>
                        </div>

                        <div v-if="m.photos?.length && editingId !== m.id" class="ch-photos">
                            <!-- 點了看大圖：這則留言的照片，下面是誰、幾點、說了什麼 -->
                            <button
                                v-for="(photo, index) in m.photos"
                                :key="photo.id"
                                type="button"
                                class="ch-photo"
                                aria-label="看大圖"
                                @click="openMessagePhotos(m, index)"
                            >
                                <img :src="photo.thumb_url" alt="" loading="lazy" />
                            </button>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- ===== 照片：留言裡的所有照片，依班分組；點了看大圖、看那則留言、可以跳過去 ===== -->
        <div v-show="view === 'photos'" ref="wallEl" class="ch-list">
            <div v-if="!wall.length" class="ch-empty">留言裡還沒有照片</div>
            <template v-for="group in wallGroups" :key="group.key">
                <div class="ch-divider" :class="{ current: group.isCurrent }">
                    {{ shiftText(group) }}
                </div>
                <div class="ch-wall">
                    <button
                        v-for="photo in group.photos"
                        :key="photo.id"
                        type="button"
                        class="ch-wall-item"
                        @click="openWallPhoto(photo)"
                    >
                        <img :src="photo.thumb_url" alt="" loading="lazy" />
                    </button>
                </div>
            </template>
        </div>

        <!-- ===== 輸入框：可以附照片 ===== -->
        <div v-show="view === 'messages'" class="ch-input">
            <div v-if="sending && attachments.length" class="ch-progress">
                <div class="ch-progress-text">
                    <span>上傳中 {{ uploadDone }}/{{ attachments.length }} 張</span>
                    <b>{{ uploadPercent }}%</b>
                </div>
                <div class="ch-progress-bar"><i :style="{ width: `${uploadPercent}%` }"></i></div>
            </div>
            <div v-if="attachments.length" class="ch-attachments">
                <div v-for="a in attachments" :key="a.key" class="ch-attachment">
                    <img :src="a.previewUrl" alt="" />
                    <button
                        v-if="!sending"
                        type="button"
                        class="ch-attachment-remove"
                        aria-label="取消這張"
                        @click="removeAttachment(a)"
                    >
                        ✕
                    </button>
                </div>
            </div>
            <el-input
                v-model="draft"
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 4 }"
                :disabled="disabled || sending"
                placeholder="寫下這隻貓的狀況…"
            />
            <div class="ch-actions">
                <button
                    type="button"
                    class="ch-attach"
                    :disabled="disabled || sending || attachments.length >= MAX_PHOTOS"
                    aria-label="附照片"
                    @click="fileInput?.click()"
                >
                    📷
                </button>
                <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    @change="onPickFiles"
                />
                <!-- 編輯留言時加照片用 -->
                <input
                    ref="editFileInput"
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    @change="onPickEditFiles"
                />
                <el-checkbox v-model="draftForNext" :disabled="disabled || sending" class="ch-for-next"
                    >重要</el-checkbox
                >
                <button
                    type="button"
                    class="ch-send"
                    :disabled="disabled || sending || (!draft.trim() && !attachments.length)"
                    @click="send"
                >
                    {{ sending ? '送出中' : '送出' }}
                </button>
            </div>
        </div>
    </el-drawer>

    <!-- 看大圖（components/PhotoViewer.vue）：留言裡的照片、留言的照片牆都用這個；
         從照片牆點開的，下面多一個「跳到這則留言」 -->
    <PhotoViewer v-model:index="viewerIndex" :photos="viewerPhotos" @close="viewerIndex = null">
        <template #actions="{ photo }">
            <button v-if="photo.fromWall" type="button" @click="jumpTo(photo.commentId, photo)">跳到這則留言</button>
        </template>
    </PhotoViewer>
</template>

<script setup>
import { ElMessage } from 'element-plus';
import Swal from 'sweetalert2';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // { cat_id, name }
    cat: { type: Object, default: null },
    // arrive / care / meal / required
    tab: { type: String, required: true },
    tabLabel: { type: String, required: true },
    // 正在看的這一班 { recordId, date, shift }：新留言寫進這一班，頻道只顯示到這一班為止
    current: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
    // 登入者的 user id：自己的留言才能編輯、刪除
    me: { type: String, default: null },
});
const emit = defineEmits(['update:modelValue', 'added', 'removed']);

const { $dayjs } = useNuxtApp();
const supabase = useSupabaseClient();
const { uploadFile } = usePhotoUpload();
const { avatarUrl } = useAvatar();

const SHIFT_LABELS = { morning: '早班', night: '晚班' };
const MAX_PHOTOS = 10;

const view = ref('messages');
const messages = ref([]);
const hasMore = ref(false);
const cursor = ref(null); // 已載入最舊的那班 { date, shift }，下次從它往前
const loadedShifts = ref([]); // 已載入的班（含沒留言的）
const loading = ref(false);
const loadingMore = ref(false);
const wall = ref([]);
const listEl = ref(null);
const wallEl = ref(null);
const fileInput = ref(null);

const draft = ref('');
const draftForNext = ref(false);
const attachments = ref([]); // { key, file, previewUrl, progress }
const sending = ref(false);

const editingId = ref(null);
const editDraft = ref('');
const editForNext = ref(false);
const editRemovedIds = ref([]); // 編輯時按 ✕ 拿掉的原本照片
const editAttachments = ref([]); // 編輯時新加的照片 { key, file, previewUrl, progress }
const editFileInput = ref(null);
const savingEdit = ref(false);

// 看大圖：目前的清單與第幾張（null = 關著）
const viewerPhotos = ref([]);
const viewerIndex = ref(null);

// 留言裡的照片：這則留言的幾張可以左右換，下面是誰、幾點、說了什麼
function openMessagePhotos(m, index) {
    viewerPhotos.value = m.photos.map((p) => ({
        url: p.url,
        label: shiftText(m),
        meta: `${m.author_name || '未命名'} ${timeText(m)}${m.edited_at ? '（已編輯）' : ''}`,
        text: m.body,
    }));
    viewerIndex.value = index;
}

// 「照片」頁：只在同一班的照片之間左右換，下面是那則留言，可以跳過去
function openWallPhoto(photo) {
    const list = wallGroups.value.find((g) => g.photos.some((p) => p.id === photo.id))?.photos || [photo];
    viewerPhotos.value = list.map((p) => ({
        url: p.url,
        label: shiftText(p),
        meta: `${p.comment?.author_name || '未命名'} ${$dayjs(p.comment?.created_at).format('HH:mm')}${p.comment?.edited_at ? '（已編輯）' : ''}`,
        text: p.comment?.body,
        fromWall: true,
        commentId: p.comment_id,
        date: p.date,
        shift: p.shift,
    }));
    viewerIndex.value = list.findIndex((p) => p.id === photo.id);
}
const flashId = ref(null); // 跳過去的那則，閃一下

// 班的先後：日期，同一天早班在前
const shiftKey = (date, shift) => `${date}-${shift === 'night' ? 1 : 0}`;
const currentKey = computed(() => shiftKey(props.current.date, props.current.shift));
const shiftText = ({ date, shift }) => `${$dayjs(date).format('MM/DD')} ${SHIFT_LABELS[shift] || ''}`;

function groupByShift(list, field) {
    const groups = [];
    for (const item of list) {
        const key = shiftKey(item.date, item.shift);
        let group = groups[groups.length - 1];
        if (!group || group.key !== key) {
            group = { key, date: item.date, shift: item.shift, isCurrent: key === currentKey.value, [field]: [] };
            groups.push(group);
        }
        group[field].push(item);
    }
    return groups;
}

// 留言：已載入的每一班一組（沒留言的班也在），舊的在上；同一班裡照時間
const groups = computed(() => {
    const map = new Map();
    const add = ({ date, shift }) => {
        const key = shiftKey(date, shift);
        if (!map.has(key)) map.set(key, { key, date, shift, isCurrent: key === currentKey.value, messages: [] });
        return map.get(key);
    };
    loadedShifts.value.forEach(add);
    [...messages.value].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((m) => add(m).messages.push(m));
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
});

// 照片牆：跟留言一樣，舊的班在上、這一班在最下面；同一班裡照時間
const wallGroups = computed(() =>
    groupByShift(
        [...wall.value].sort(
            (a, b) =>
                shiftKey(a.date, a.shift).localeCompare(shiftKey(b.date, b.shift)) ||
                a.created_at.localeCompare(b.created_at)
        ),
        'photos'
    )
);

const isMine = (m) => !!props.me && m.created_by === props.me;

// 頭像：有上傳就用照片，沒有就用名字第一個字，顏色照名字固定
const AVATAR_COLORS = [
    ['#d9e6ee', '#3f7ea3'],
    ['#e8e2dc', '#6b625d'],
    ['#e3ecdf', '#4f7243'],
    ['#efe0e6', '#8a4a63'],
    ['#e6e2f0', '#5b5190'],
    ['#f3e6d6', '#8a5a1f'],
];
const initial = (m) => (m.author_name || '？').trim().charAt(0);
function avatarStyle(m) {
    const name = m.author_name || '';
    const sum = [...name].reduce((total, ch) => total + ch.codePointAt(0), 0);
    const [background, color] = AVATAR_COLORS[sum % AVATAR_COLORS.length];
    return { background, color };
}

// 平常只顯示時間；補寫到別天的班時連日期一起顯示
function timeText(m) {
    const at = $dayjs(m.created_at);
    return at.format('YYYY-MM-DD') === m.date ? at.format('HH:mm') : at.format('MM/DD HH:mm');
}

const channelParams = () => ({
    catId: props.cat.cat_id,
    tab: props.tab,
    date: props.current.date,
    shift: props.current.shift,
});
const visible = (m) => m.tab === props.tab && shiftKey(m.date, m.shift) <= currentKey.value;

function upsert(message) {
    if (!visible(message)) return;
    const index = messages.value.findIndex((m) => m.id === message.id);
    if (index >= 0) messages.value.splice(index, 1, message);
    else messages.value.push(message);
}

function removeLocal(id) {
    messages.value = messages.value.filter((m) => m.id !== id);
    wall.value = wall.value.filter((p) => p.comment_id !== id);
}

async function scrollToBottom(el = listEl) {
    await nextTick();
    if (el.value) el.value.scrollTop = el.value.scrollHeight;
}

// 切到照片頁：跟留言一樣從最下面（這一班）開始看
watch(view, (v) => {
    if (v === 'photos') scrollToBottom(wallEl);
});

// 一批班：第一次是這一班加前面 4 班，之後從已載入最舊的那班再往前 5 班；
// until（{ date, shift }）是要跳到很早的某則留言時，一次載到那一班
async function loadPage(until = null) {
    const data = await $fetch('/api/shift/comments/channel', {
        params: {
            ...channelParams(),
            ...(cursor.value ? { cursorDate: cursor.value.date, cursorShift: cursor.value.shift } : {}),
            ...(cursor.value && until ? { untilDate: until.date, untilShift: until.shift } : {}),
        },
        cache: 'no-store',
    });
    loadedShifts.value.push(
        ...data.shifts.filter((s) => !loadedShifts.value.some((l) => l.date === s.date && l.shift === s.shift))
    );
    data.messages.forEach(upsert);
    hasMore.value = data.hasMore;
    cursor.value = data.cursor;
}

async function loadWall() {
    try {
        wall.value = await $fetch('/api/shift/comments/photos', { params: channelParams(), cache: 'no-store' });
    } catch (e) {
        console.error('loadWall error:', e);
    }
}

async function open() {
    resetSearch();
    view.value = 'messages';
    messages.value = [];
    loadedShifts.value = [];
    wall.value = [];
    cursor.value = null;
    hasMore.value = false;
    editingId.value = null;
    viewerIndex.value = null;
    loading.value = true;
    try {
        await loadPage();
    } catch (e) {
        console.error('load channel error:', e);
        ElMessage.error('留言載入失敗，請再試一次');
    } finally {
        loading.value = false;
    }
    scrollToBottom();
    loadWall();
    subscribe();
}

// 捲到最上面就載入更早的一頁，載入後畫面停在原本看的那則
async function loadMore() {
    if (loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
    const el = listEl.value;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    try {
        await loadPage();
        await nextTick();
        if (el) el.scrollTop = el.scrollHeight - before;
    } catch (e) {
        console.error('load more error:', e);
    } finally {
        loadingMore.value = false;
    }
}

function onScroll() {
    if (listEl.value && listEl.value.scrollTop < 60) loadMore();
}

// 照片牆、搜尋結果 → 那則留言：切回留言，還沒載入到就一次往前載到那則的班（target 是 { date, shift }），
// 捲過去閃一下
async function jumpTo(commentId, target = null) {
    viewerIndex.value = null;
    view.value = 'messages';
    const loaded = () => messages.value.some((m) => m.id === commentId);
    loadingMore.value = true;
    try {
        if (!loaded() && hasMore.value && target?.date) await loadPage(target);
        while (!loaded() && hasMore.value) await loadPage();
    } catch (e) {
        console.error('jump load error:', e);
    } finally {
        loadingMore.value = false;
    }
    await nextTick();
    const el = listEl.value?.querySelector(`[data-id="${commentId}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    flashId.value = commentId;
    setTimeout(() => {
        if (flashId.value === commentId) flashId.value = null;
    }, 1600);
}

// ---- 搜尋：這個頻道（一隻貓、一個分頁）所有的班 ----
const searchText = ref('');
const searchedText = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);
const searchInput = ref(null);
let searchTimer = null;
let searchSeq = 0;
// 每個頻道上次搜的字（這頁開著的期間都記得）：跳到某則之後再按 🔍，或關掉面板再打開，都還在
const lastSearch = new Map();
const lastJump = new Map(); // 每個頻道上次從搜尋跳過去的是哪一則
const seenJumps = new Map(); // 每個頻道這次搜尋跳過哪些（換關鍵字或按取消就清掉）
const searchKey = () => `${props.cat?.cat_id}-${props.tab}`;
const lastJumpId = ref(null);
const seenIds = ref([]);

let viewBeforeSearch = 'messages';

function toggleSearch() {
    if (view.value === 'search') leaveSearch();
    else openSearch();
}

// 收起搜尋：回到打開搜尋前的那一頁（留言或照片），搜尋的字與看過的標記都留著
function leaveSearch() {
    clearTimeout(searchTimer);
    view.value = viewBeforeSearch;
}

async function openSearch() {
    viewBeforeSearch = view.value === 'photos' ? 'photos' : 'messages';
    view.value = 'search';
    lastJumpId.value = lastJump.get(searchKey()) ?? null;
    seenIds.value = seenJumps.get(searchKey()) || [];
    const remembered = lastSearch.get(searchKey());
    if (remembered && remembered !== searchedText.value) {
        searchText.value = remembered;
        await runSearch();
    }
    await nextTick();
    // 回來時捲到上次看的那則；沒有的話游標放進搜尋框
    const last = lastJumpId.value && document.querySelector(`[data-result-id="${lastJumpId.value}"]`);
    if (last) last.scrollIntoView({ block: 'center' });
    else searchInput.value?.focus();
}

// 清掉畫面上的搜尋（換頻道時）；forget 才連記住的字一起忘掉（按「取消」）
function resetSearch(forget = false) {
    clearTimeout(searchTimer);
    if (forget) {
        lastSearch.delete(searchKey());
        lastJump.delete(searchKey());
        seenJumps.delete(searchKey());
    }
    lastJumpId.value = null;
    seenIds.value = [];
    searchText.value = '';
    searchedText.value = '';
    searchResults.value = [];
}

// 「取消」：連記住的字一起清掉，回到原本那一頁
function closeSearch() {
    resetSearch(true);
    view.value = viewBeforeSearch;
}

// 打字停 0.3 秒才搜；比較慢回來的舊結果不蓋掉新的
function searchSoon() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
    const q = searchText.value.trim();
    const seq = ++searchSeq;
    if (!q) {
        searchedText.value = '';
        searchResults.value = [];
        lastSearch.delete(searchKey());
        return;
    }
    searchLoading.value = true;
    try {
        const results = await $fetch('/api/shift/comments/search', {
            params: { ...channelParams(), q },
            cache: 'no-store',
        });
        if (seq !== searchSeq) return;
        // 換了關鍵字：看過的標記重來
        if (lastSearch.get(searchKey()) !== q) {
            lastJump.delete(searchKey());
            seenJumps.delete(searchKey());
            lastJumpId.value = null;
            seenIds.value = [];
        }
        searchResults.value = results;
        searchedText.value = q;
        lastSearch.set(searchKey(), q);
    } catch (e) {
        console.error('search comments error:', e);
        ElMessage.error('搜尋失敗，請再試一次');
    } finally {
        if (seq === searchSeq) searchLoading.value = false;
    }
}

// 跳過去時搜尋結果留著，再按 🔍 會回到同一份結果，並標出這次跳的是哪一則
function jumpFromSearch(result) {
    const id = result.id;
    lastJump.set(searchKey(), id);
    lastJumpId.value = id;
    seenIds.value = [...new Set([...seenIds.value, id])];
    seenJumps.set(searchKey(), seenIds.value);
    jumpTo(id, result);
}

// 搜尋結果：先跳脫 HTML，再把關鍵字包上 <mark>（不分大小寫）
const escapeHtml = (text) =>
    text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function highlight(body, q) {
    const html = escapeHtml(body || '');
    if (!q) return html;
    const pattern = new RegExp(escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return html.replace(pattern, (m) => `<mark>${m}</mark>`);
}

// ---- 輸入框附照片 ----
// 選好的照片加進清單（輸入框與編輯共用），超過一則的上限就只收前面幾張
function addFiles(event, list, room) {
    const files = [...(event.target.files || [])].filter((f) => f.type.startsWith('image/'));
    event.target.value = '';
    if (files.length > room) ElMessage.warning(`一則留言最多 ${MAX_PHOTOS} 張照片`);
    for (const file of files.slice(0, Math.max(0, room))) {
        list.value.push({
            key: `${Date.now()}-${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file),
            progress: 0,
        });
    }
}

const onPickFiles = (event) => addFiles(event, attachments, MAX_PHOTOS - attachments.value.length);

function removeAttachment(a) {
    URL.revokeObjectURL(a.previewUrl);
    attachments.value = attachments.value.filter((x) => x !== a);
}

function clearAttachments() {
    attachments.value.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    attachments.value = [];
}

const uploadDone = computed(() => attachments.value.filter((a) => a.progress >= 100).length);
const averageProgress = (list) =>
    list.length ? Math.round(list.reduce((sum, a) => sum + a.progress, 0) / list.length) : 0;
const uploadPercent = computed(() => averageProgress(attachments.value));

// 一張：壓縮 0～10%、大圖 10～90%（照實際傳了多少）、縮圖 90～100%
async function uploadAttachment(a, slot) {
    const step = (from, to) => (ratio) => {
        a.progress = Math.round(from + (to - from) * Math.min(1, Math.max(0, ratio)));
    };
    a.progress = 3;
    const { full, thumb } = await compressPhoto(a.file);
    a.progress = 10;
    await uploadFile(slot.path, slot.token, full.blob, step(10, 90));
    await uploadFile(slot.thumbPath, slot.thumbToken, thumb.blob, step(90, 100));
    return {
        path: slot.path,
        thumbPath: slot.thumbPath,
        width: full.width,
        height: full.height,
        size: full.blob.size,
    };
}

// 一批照片一張張傳到 Storage，回傳要記進資料庫的資料。路徑在那一班、這隻貓底下
async function uploadAll(list, shiftId) {
    if (!list.length) return [];
    const slots = await $fetch('/api/shift/photos/upload-url', {
        method: 'POST',
        body: { shiftId, catId: props.cat.cat_id, tab: props.tab, count: list.length },
    });
    const photos = [];
    for (const [i, a] of list.entries()) photos.push(await uploadAttachment(a, slots[i]));
    return photos;
}

// 照片先一張張傳到 Storage，全部傳完才送出留言（一次記下文字與照片，不會出現傳一半的留言）。
// 失敗的話文字與照片都留著，再按一次送出就重傳
async function send() {
    const body = draft.value.trim();
    if ((!body && !attachments.value.length) || !props.cat) return;
    sending.value = true;
    attachments.value.forEach((a) => (a.progress = 0));
    try {
        const photos = await uploadAll(attachments.value, props.current.recordId);
        const message = await $fetch('/api/shift/comments', {
            method: 'POST',
            body: {
                shiftId: props.current.recordId,
                catId: props.cat.cat_id,
                tab: props.tab,
                body,
                forNext: draftForNext.value,
                photos,
            },
        });
        upsert(message);
        emit('added', message);
        draft.value = '';
        draftForNext.value = false;
        clearAttachments();
        scrollToBottom();
        if (photos.length) loadWall();
    } catch (e) {
        console.error('send comment error:', e);
        ElMessage.error('留言送出失敗，請再按一次送出');
    } finally {
        sending.value = false;
    }
}

// ---- 編輯、刪除自己的留言 ----
function startEdit(m) {
    clearEditAttachments();
    editingId.value = m.id;
    editDraft.value = m.body;
    editForNext.value = m.for_next;
    editRemovedIds.value = [];
}

function cancelEdit() {
    clearEditAttachments();
    editingId.value = null;
}

const editKeptPhotos = (m) => (m.photos || []).filter((p) => !editRemovedIds.value.includes(p.id));
const editPhotoCount = (m) => editKeptPhotos(m).length + editAttachments.value.length;

function onPickEditFiles(event) {
    const m = messages.value.find((x) => x.id === editingId.value);
    if (m) addFiles(event, editAttachments, MAX_PHOTOS - editPhotoCount(m));
}

function removeEditAttachment(a) {
    URL.revokeObjectURL(a.previewUrl);
    editAttachments.value = editAttachments.value.filter((x) => x !== a);
}

function clearEditAttachments() {
    editAttachments.value.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    editAttachments.value = [];
}

const editUploadDone = computed(() => editAttachments.value.filter((a) => a.progress >= 100).length);
const editUploadPercent = computed(() => averageProgress(editAttachments.value));

// 新加的照片先傳到 Storage（照留言原本那一班、那隻貓的路徑），再一次送出文字、拿掉的、新加的
async function saveEdit(m) {
    const body = editDraft.value.trim();
    if (!body && !editPhotoCount(m)) {
        ElMessage.warning('留言不能是空的，不要的話請刪除');
        return;
    }
    savingEdit.value = true;
    editAttachments.value.forEach((a) => (a.progress = 0));
    try {
        const photos = await uploadAll(editAttachments.value, m.shift_id);
        const updated = await $fetch('/api/shift/comments/update', {
            method: 'POST',
            body: { id: m.id, body, forNext: editForNext.value, removePhotoIds: [...editRemovedIds.value], photos },
        });
        upsert(updated);
        if (photos.length || editRemovedIds.value.length) loadWall();
        clearEditAttachments();
        editingId.value = null;
    } catch (e) {
        console.error('edit comment error:', e);
        ElMessage.error('儲存失敗，請再試一次');
    } finally {
        savingEdit.value = false;
    }
}

async function removeMessage(m) {
    const { isConfirmed } = await Swal.fire({
        text: m.photos?.length ? '確定要刪除這則留言嗎？附的照片也會一起刪除。' : '確定要刪除這則留言嗎？',
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });
    if (!isConfirmed) return;
    try {
        await $fetch('/api/shift/comments/delete', { method: 'POST', body: { id: m.id } });
        removeLocal(m.id);
        emit('removed', m.id);
    } catch (e) {
        console.error('delete comment error:', e);
        ElMessage.error('刪除失敗，請再試一次');
    }
}

// ---- 即時：別人新增、編輯、刪除，開著的頻道跟著變 ----
// 新增時照片紀錄晚一點才寫進去，等一下再用 item API 拿整則（含照片網址）
let realtime = null;
const refreshTimers = new Map();
function refreshSoon(id) {
    clearTimeout(refreshTimers.get(id));
    refreshTimers.set(
        id,
        setTimeout(async () => {
            refreshTimers.delete(id);
            try {
                upsert(await $fetch('/api/shift/comments/item', { params: { id }, cache: 'no-store' }));
            } catch (e) {
                if (e?.statusCode === 404) removeLocal(id);
                else console.error('refresh comment error:', e);
            }
        }, 600)
    );
}

let wallTimer = null;
function reloadWallSoon() {
    clearTimeout(wallTimer);
    wallTimer = setTimeout(loadWall, 800);
}

function subscribe() {
    unsubscribe();
    const catFilter = `cat_id=eq.${props.cat.cat_id}`;
    realtime = supabase
        .channel(`comment-channel-${props.cat.cat_id}-${props.tab}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_comments', filter: catFilter }, ({ new: row }) => {
            if (row?.tab === props.tab) refreshSoon(row.id);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shift_comments', filter: catFilter }, ({ new: row }) => {
            if (row?.tab === props.tab) refreshSoon(row.id);
        })
        // 刪除的通知只帶 id（不能用 cat_id 過濾），不在這個頻道的就找不到，沒影響
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shift_comments' }, ({ old }) => {
            if (old?.id) removeLocal(old.id);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_photos', filter: catFilter }, ({ new: row }) => {
            if (!row?.comment_id || row.tab !== props.tab) return;
            if (messages.value.some((m) => m.id === row.comment_id)) refreshSoon(row.comment_id);
            reloadWallSoon();
        })
        .subscribe();
}

function unsubscribe() {
    if (realtime) supabase.removeChannel(realtime);
    realtime = null;
    refreshTimers.forEach(clearTimeout);
    refreshTimers.clear();
    clearTimeout(wallTimer);
}

watch(
    () => [props.modelValue, props.cat?.cat_id, props.tab, props.current.recordId],
    ([isOpen, catId]) => {
        if (isOpen && catId) open();
        else unsubscribe();
    }
);

// 關掉面板：還沒送出的照片放棄（文字留著，下次打開同一隻貓還在）
watch(
    () => props.modelValue,
    (isOpen) => {
        if (!isOpen && !sending.value) clearAttachments();
        if (!isOpen && !savingEdit.value) cancelEdit();
    }
);

onBeforeUnmount(() => {
    unsubscribe();
    clearAttachments();
    clearEditAttachments();
});
</script>

<style lang="scss">
/* el-drawer 會 teleport 到 body，這個元件又有兩個根（面板與大圖），scoped 選不到 drawer 本身，
   所以這塊不加 scoped。class 名稱夠獨特，不會影響其他 drawer */
.channel-drawer {
    border-radius: 14px 14px 0 0;

    .el-drawer__body {
        display: flex;
        flex-direction: column;
        padding: 0;
    }
}
</style>

<style lang="scss" scoped>
// 全域 button 有 width: 100%、邊框、底色、padding，這裡用到的按鈕都要蓋回來
button {
    width: auto;
    height: auto;
    margin: 0;
    cursor: pointer;
}

.ch-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #eee;

    .ch-title {
        font-size: 16px;
        font-weight: 500;
    }

    .ch-tab {
        font-size: 13px;
        color: #6da2c2;
    }

    .ch-close {
        padding: 0 4px;
        border: none;
        background: none;
        color: #999;
        font-size: 16px;
    }
}

// 🔍：搜尋中是藍底圓圈（跟「留言／照片」選中的樣子同一個顏色）
.ch-search-btn {
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    font-size: 16px;
    line-height: 30px;

    &.on {
        background: #6da2c2;
    }
}

.ch-searchbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid #eee;

    .el-input {
        flex: 1;
    }
}

// 搜尋結果：一則一列，右邊的按鈕才跳回頻道
.ch-result {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 -8px;
    padding: 10px 8px;
    border-bottom: 1px solid #f2f0ee;
    text-align: left;

    // 上次跳過的那則
    &.last {
        background: #eef5fa;
    }

    .ch-result-text {
        flex: 1;
        min-width: 0;
    }

    .ch-result-last,
    .ch-result-seen {
        margin-left: 4px;
        font-weight: 500;
        color: #3f7ea3;
    }

    // 這次搜尋跳過的：字淡一點、標「看過」
    &.seen:not(.last) .ch-result-body {
        color: #8e8783;
    }

    .ch-result-seen {
        color: #8e8783;
    }

    .ch-result-jump {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        padding: 0 0 2px 2px;
        border: 1px solid #d8d4d1;
        border-radius: 50%;
        background: #fff;
        color: #3f7ea3;
        font-size: 22px;
        line-height: 1;
    }

    &.important .ch-result-body {
        background: #fde9cc;
        border-radius: 6px;
        padding: 2px 6px;
        margin-left: -6px;
    }

    .ch-result-meta {
        display: block;
        margin-bottom: 2px;
        font-size: 12px;
        color: #999;
    }

    .ch-result-body {
        display: inline-block;
        font-size: 15px;
        line-height: 1.45;
        color: #222;
        white-space: pre-line;
        overflow-wrap: anywhere;

        :deep(mark) {
            padding: 0 1px;
            border-radius: 2px;
            background: #fff1a8;
            color: inherit;
        }
    }
}

// 留言／照片切換
.ch-switch {
    display: flex;
    gap: 2px;
    margin-left: auto;
    padding: 2px;
    border-radius: 14px;
    background: #f2f0ee;

    button {
        padding: 2px 10px;
        border: none;
        border-radius: 12px;
        background: none;
        color: #657181;
        font-size: 12px;
        line-height: 20px;

        &.on {
            background: #6da2c2;
            color: #fff;
        }
    }
}

.ch-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 16px 10px;
    text-align: left;
}

.ch-hint {
    padding: 8px 0 0;
    font-size: 12px;
    color: #aaa;
    text-align: center;
}

// 沒留言的班：分隔線下一行淡淡的小字
.ch-none {
    margin: -2px 0 4px;
    font-size: 12px;
    color: #c4bfbb;
    text-align: center;
}

.ch-empty {
    padding: 18px 0;
    font-size: 14px;
    color: #aaa;
    text-align: center;
}

// 班與班之間的分隔線；正在看的這一班是藍色
.ch-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0 6px;
    font-size: 12px;
    color: #8e8783;

    &::before,
    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #e5e2df;
    }

    &.current {
        color: #3f7ea3;
    }
}

// 一則留言：頭像＋（名字、時間，氣泡，照片）
.ch-msg {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 12px -8px 0;
    padding: 2px 8px;
    border-radius: 8px;
    transition: background-color 0.4s;

    &.flash {
        background: #e6f0f6;
    }
}

.ch-avatar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.ch-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    max-width: calc(100% - 44px);

    .editing & {
        flex: 1;
    }
}

.ch-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 2px 4px;
    font-size: 12px;
    color: #999;

    b {
        font-size: 13px;
        font-weight: 500;
        color: #4a4542;
    }

    .ch-important {
        padding: 0 5px;
        border-radius: 3px;
        background: #fdf0dc;
        color: #b36b00;
    }
}

.ch-more-btn {
    padding: 0 2px;
    border: none;
    background: none;
    color: #aaa;
    font-size: 16px;
    line-height: 16px;
}

// 氣泡顏色放在變數裡，尾巴（指向頭像的小三角）跟著用同一個顏色
.ch-bubble {
    --bubble-bg: #f0eeec;
    position: relative;
    min-width: 0;
    max-width: 100%;
    padding: 8px 12px;
    border-radius: 16px;
    background: var(--bubble-bg);
    color: #222;
    font-size: 15px;
    line-height: 1.45;
    white-space: pre-line;
    overflow-wrap: anywhere;

    // 勾了「重要」的：橘色氣泡。下一班的 💬 旁另有橘點，那個只維持一班
    .important & {
        --bubble-bg: #fde9cc;
    }

    // 尾巴像 LINE：氣泡左上方往左上翹的小勾（尖端是尖的、上下緣都彎）。用 SVG 當遮罩、底色用氣泡色，
    // 不用另外蓋一塊背景色（之前那樣會蓋到頭像，多出小白點）
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

.ch-time {
    flex-shrink: 0;
    white-space: nowrap;
}

// 氣泡＋旁邊的「已編輯」（貼著氣泡底部）
.ch-line {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    max-width: 100%;

    .ch-edited {
        flex-shrink: 0;
        font-size: 11px;
        color: #aaa;
        white-space: nowrap;
    }
}

.ch-photos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;

    .ch-meta + & {
        margin-top: 0;
    }

    // 點了看大圖的縮圖（button）：全域 button 樣式要蓋回來
    .ch-photo {
        width: 88px;
        height: 88px;
        padding: 0;
        border: none;
        border-radius: 10px;
        background: #f2f0ee;
        overflow: hidden;

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }
}

// 編輯時輸入框撐滿整排
.ch-edit {
    align-self: stretch;
    margin-top: 4px;

    .ch-attachments,
    .ch-progress {
        margin: 8px 0 0;
    }

    // 全域把 textarea 設成至少 100px，這裡一行起跳
    :deep(.el-textarea__inner) {
        min-height: 40px !important;
    }

    .ch-edit-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 6px;

        .ch-for-next {
            margin-right: auto;
        }
    }
}

.ch-btn {
    height: 32px;
    padding: 0 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    color: #657181;
    font-size: 13px;

    &.primary {
        border-color: #6da2c2;
        background: #6da2c2;
        color: #fff;
    }

    &:disabled {
        cursor: default;
        opacity: 0.5;
    }
}

// 照片牆：一排三張的正方形縮圖
.ch-wall {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;

    .ch-wall-item {
        aspect-ratio: 1;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: #f2f0ee;
        overflow: hidden;

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }
}

// 「重要」勾選（輸入框與編輯時）。值班表頁面把 el-checkbox 排成上下兩層的小字（scoped 規則會穿進這個面板），
// 這裡加上 .el-checkbox 提高權重改回左右並排、一般字級
.el-checkbox.ch-for-next {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    width: auto;
    height: auto;

    :deep(.el-checkbox__label) {
        padding: 0;
        color: #4a4542;
        font-size: 14px;
        line-height: 20px;
    }
}

.ch-input {
    padding: 10px 16px 16px;
    border-top: 1px solid #eee;

    :deep(.el-textarea__inner) {
        min-height: 40px !important;
    }
}

.ch-progress {
    margin-bottom: 8px;

    .ch-progress-text {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 13px;
        color: #4a4542;

        b {
            font-weight: 500;
            color: #6da2c2;
            font-variant-numeric: tabular-nums;
        }
    }

    .ch-progress-bar {
        height: 6px;
        border-radius: 3px;
        background: #eceae8;
        overflow: hidden;

        i {
            display: block;
            height: 100%;
            border-radius: 3px;
            background: #6da2c2;
            transition: width 0.2s linear;
        }
    }
}

// 送出前的照片：一排小縮圖，右上角 ✕ 拿掉
.ch-attachments {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
    overflow-x: auto;

    .ch-attachment {
        position: relative;
        flex-shrink: 0;
        width: 64px;
        height: 64px;

        img {
            width: 100%;
            height: 100%;
            border-radius: 6px;
            object-fit: cover;
        }
    }

    .ch-attachment-remove {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 20px;
        height: 20px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: 11px;
        line-height: 20px;
    }
}

// 📷 加照片（輸入框與編輯共用）
.ch-attach {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    font-size: 17px;

    &:disabled {
        cursor: default;
        opacity: 0.4;
    }
}

.ch-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;


    .ch-send {
        height: 36px;
        margin-left: auto;
        padding: 0 18px;
        border: none;
        border-radius: 8px;
        background: #6da2c2;
        color: #fff;
        font-size: 14px;

        &:disabled {
            cursor: default;
            opacity: 0.4;
        }
    }
}

</style>
