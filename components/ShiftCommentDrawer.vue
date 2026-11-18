<template>
    <!-- 留言頻道：一隻貓、一個分頁一個頻道，跨班一路往上看，班與班之間有分隔線。
         從下方滑出；最新的在最下面，捲到最上面會載入更早的班。標題列可以切到「照片」看留言裡的所有照片 -->
    <el-drawer
        :model-value="modelValue"
        direction="btt"
        size="72%"
        :with-header="false"
        class="channel-drawer"
        :modal-class="instant ? 'drawer-instant' : ''"
        @update:model-value="emit('update:modelValue', $event)"
    >
        <div class="ch-head">
            <span class="ch-title">{{ cat?.name }}</span>
            <span class="ch-tab">{{ tabLabel }}留言</span>
            <!-- 🔍 再按一次就收起搜尋，回到留言 -->
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
            <!-- 「照片」打開這隻貓、這個分頁的 🗂️ 照片庫（直接上傳的與留言附的都在那裡），由值班頁切換 -->
            <ChannelSwitch current="messages" @switch="emit('open-photos')" />
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
                <div v-if="!group.items.length" class="ch-none">
                    {{ group.isCurrent ? '這一班還沒有留言' : '沒有留言' }}
                </div>
                <template v-for="m in group.items" :key="m.uploadKey || m.id">
                <!-- 直接上傳到照片庫的照片：同一個人 10 分鐘內傳的併成一筆，像一則留言但帶系統訊息感
                     （頭像位置是灰色 🗂️、一行灰字說誰上傳了幾張、照片放在淡灰框裡），點了看大圖 -->
                <div v-if="m.uploadKey" class="ch-msg ch-upload">
                    <div class="ch-avatar ch-avatar-system" aria-hidden="true">🗂️</div>
                    <div class="ch-main">
                        <div class="ch-meta">
                            <span class="ch-upload-text">
                                {{ m.author_name || '未命名' }} 上傳了 {{ m.photos.length }} 張照片到照片庫
                            </span>
                            <span class="ch-time">{{ timeText(m) }}</span>
                        </div>
                        <div class="ch-photos ch-upload-box">
                            <button
                                v-for="(photo, index) in m.photos"
                                :key="photo.id"
                                type="button"
                                class="ch-photo"
                                aria-label="看大圖"
                                @click="openUploadPhotos(m, index)"
                            >
                                <img :src="photo.thumb_url" alt="" loading="lazy" />
                                <span
                                    v-for="kind in (photo.kinds || []).filter(isObserveKind)"
                                    :key="kind"
                                    class="ch-photo-kind"
                                    >{{ kind }}</span
                                >
                            </button>
                        </div>
                    </div>
                </div>
                <!-- 每則留言都是一組：頭像、名字、時間，下面是氣泡（有指向頭像的尾巴）與照片。
                     所有人（含自己）都靠左；勾了「重要」的氣泡是橘色 -->
                <div
                    v-else
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
                                <div
                                    v-for="(a, index) in editAttachments"
                                    :key="a.key"
                                    class="ch-attachment"
                                    :class="{ picking: pickingKey === a.key }"
                                >
                                    <!-- 點照片選這張的類型（下面出現一排類型），左下角顯示選了什麼 -->
                                    <button
                                        type="button"
                                        class="ch-attachment-pick"
                                        :disabled="savingEdit || !hasKinds"
                                        :aria-label="`第 ${index + 1} 張的類型`"
                                        @click="pickingKey = a.key"
                                    >
                                        <img :src="a.previewUrl" alt="" />
                                        <span v-if="hasKinds" class="ch-attachment-kind" :class="kindTagClass(a)">{{ kindTag(a) }}</span>
                                    </button>
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
                            <!-- 新加的照片：點了選類型（原本的照片在照片庫或看大圖按編輯改） -->
                            <div v-if="pickedEdit && !savingEdit" class="ch-kind-row">
                                <span class="ch-kind-label">新加的第 {{ editAttachments.indexOf(pickedEdit) + 1 }} 張</span>
                                <PhotoKindPicker v-model="pickedEdit.kinds" :tab="tab" />
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
                                <!-- 剛到要拍的那組（剩食、貓砂，擇一）：左上角暖橘標籤；其他類型不標 -->
                                <span
                                    v-for="kind in (photo.kinds || []).filter(isObserveKind)"
                                    :key="kind"
                                    class="ch-photo-kind"
                                    >{{ kind }}</span
                                >
                            </button>
                        </div>
                    </div>
                </div>
                </template>
            </template>
            <!-- 別人的新留言進來、自己正往上看舊的：浮在最下面提示，點了滑到最新 -->
            <div v-if="newCount" class="ch-new-wrap">
                <button type="button" class="ch-new" @click="scrollToBottom()">
                    <el-icon class="ch-new-icon"><Bottom /></el-icon>{{ newCount }} 則新留言
                </button>
            </div>
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
                <div
                    v-for="(a, index) in attachments"
                    :key="a.key"
                    class="ch-attachment"
                    :class="{ picking: pickingKey === a.key }"
                >
                    <!-- 點照片選這張的類型（下面出現一排類型），左下角顯示選了什麼 -->
                    <button
                        type="button"
                        class="ch-attachment-pick"
                        :disabled="sending || !hasKinds"
                        :aria-label="`第 ${index + 1} 張的類型`"
                        @click="pickingKey = a.key"
                    >
                        <img :src="a.previewUrl" alt="" />
                        <span v-if="hasKinds" class="ch-attachment-kind" :class="kindTagClass(a)">{{ kindTag(a) }}</span>
                    </button>
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
            <!-- 點選中的那張照片：選它的類型（規則跟照片庫一樣，剩食、貓砂擇一） -->
            <div v-if="pickedNew && !sending" class="ch-kind-row">
                <span class="ch-kind-label">第 {{ attachments.indexOf(pickedNew) + 1 }} 張</span>
                <PhotoKindPicker v-model="pickedNew.kinds" :tab="tab" />
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

    <!-- 看大圖（components/PhotoViewer.vue）：跟照片庫點開留言照片一樣，下面是誰、幾點、類型、說了什麼，
         可以改類型（上傳的人或管理員，編輯視窗在值班頁）、跳到這則留言 -->
    <PhotoViewer v-model:index="viewerIndex" :photos="viewerPhotos" @close="viewerIndex = null">
        <template #actions="{ photo }">
            <button v-if="canEditPhoto(photo.raw)" type="button" @click="editPhotoKinds(photo.raw)">✎ 編輯</button>
            <button v-if="photo.message" type="button" @click="jumpTo(photo.message.id, photo.message)">跳到這則留言</button>
        </template>
    </PhotoViewer>
</template>

<script setup>
import { ElMessage } from 'element-plus';
import { Bottom } from '@element-plus/icons-vue';
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
    // 打開後要跳過去的那則 { commentId, date, shift }（從照片庫的留言照片「跳到這則留言」），跳完 emit jumped
    jump: { type: Object, default: null },
    // 管理員可以改所有照片的類型
    admin: { type: Boolean, default: false },
    // 跟照片庫互相切換時：不要滑動動畫，直接換過去
    instant: { type: Boolean, default: false },
    // 值班頁上這一班的照片（即時更新）：頻道裡這一班的上傳紀錄用這份，新增、刪除馬上看得到
    currentPhotos: { type: Array, default: () => [] },
});
// edit-photo（照片, 那則留言）：編輯留言照片，由值班頁開「編輯照片」視窗（跟照片庫同一個）
const emit = defineEmits(['update:modelValue', 'added', 'updated', 'removed', 'open-photos', 'jumped', 'edit-photo']);

const { $dayjs } = useNuxtApp();
const { uploadFile } = usePhotoUpload();
const { avatarUrl } = useAvatar();

const SHIFT_LABELS = { morning: '早班', night: '晚班' };
const MAX_PHOTOS = 10;

const view = ref('messages');
const messages = ref([]);
const hasMore = ref(false);
const cursor = ref(null); // 已載入最舊的那班 { date, shift }，下次從它往前
const loadedShifts = ref([]); // 已載入的班（含沒留言的）
const uploads = ref([]); // 已載入的班裡，直接上傳到照片庫的照片（這一班的改用 currentPhotos）
const loading = ref(false);
const loadingMore = ref(false);
const listEl = ref(null);
const fileInput = ref(null);

const draft = ref('');
const draftForNext = ref(false);
const attachments = ref([]); // { key, file, previewUrl, progress, kinds }
const sending = ref(false);

const editingId = ref(null);
const editDraft = ref('');
const editForNext = ref(false);
const editRemovedIds = ref([]); // 編輯時按 ✕ 拿掉的原本照片
const editAttachments = ref([]); // 編輯時新加的照片 { key, file, previewUrl, progress, kinds }

// 附照片的類型：點哪張就選哪張（pickingKey），這個分頁沒有類型（收尾）就不顯示
const hasKinds = computed(() => !!PHOTO_KINDS[props.tab]);
const pickingKey = ref(null);
const pickedNew = computed(() => attachments.value.find((a) => a.key === pickingKey.value) || null);
const pickedEdit = computed(() => editAttachments.value.find((a) => a.key === pickingKey.value) || null);
// 縮圖左下角：選了的類型（兩個以上加 +N），還沒選寫「＋類型」
const kindTag = (a) =>
    a.kinds.length ? `${a.kinds[0]}${a.kinds.length > 1 ? ` +${a.kinds.length - 1}` : ''}` : '＋類型';
const kindTagClass = (a) => ({ empty: !a.kinds.length, observe: a.kinds.length && isObserveKind(a.kinds[0]) });
const editFileInput = ref(null);
const savingEdit = ref(false);

// 看大圖：目前的清單與第幾張（null = 關著）
const viewerPhotos = ref([]);
const viewerIndex = ref(null);

// 留言裡的照片：這則留言的幾張可以左右換，下面跟照片庫點開留言照片一樣（誰、幾點、類型、說了什麼）
function openMessagePhotos(m, index) {
    viewerPhotos.value = m.photos.map((p) => ({
        url: p.url,
        label: shiftText(m),
        meta: `${m.author_name || '未命名'} ${timeText(m)}${m.edited_at ? '（已編輯）' : ''}`,
        kinds: p.kinds,
        text: m.body,
        textKind: 'comment',
        raw: p,
        message: m,
    }));
    viewerIndex.value = index;
}

const canEditPhoto = (photo) => props.admin || (!!props.me && photo.uploaded_by === props.me);

function editPhotoKinds(photo) {
    viewerIndex.value = null;
    emit('edit-photo', photo, photo.comment_id && messages.value.find((m) => m.id === photo.comment_id));
}

const flashId = ref(null); // 跳過去的那則，閃一下

// 班的先後：日期，同一天早班在前
const shiftKey = (date, shift) => `${date}-${shift === 'night' ? 1 : 0}`;
const currentKey = computed(() => shiftKey(props.current.date, props.current.shift));
const shiftText = ({ date, shift }) => `${$dayjs(date).format('MM/DD')} ${SHIFT_LABELS[shift] || ''}`;

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
    // 每一班的時間軸：留言＋上傳紀錄，照時間排
    const batches = uploadBatches.value;
    return [...map.values()]
        .map((g) => ({
            ...g,
            items: [...g.messages, ...batches.filter((b) => b.date === g.date && b.shift === g.shift)].sort((a, b) =>
                a.created_at.localeCompare(b.created_at)
            ),
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
});

// 上傳紀錄：以前的班用 API 帶回來的，這一班用值班頁即時的那份（只要這隻貓、這個分頁、直接上傳的）。
// 同一次上傳（upload_batch 一樣）併成一筆；沒有 upload_batch 的舊照片一張一筆
const uploadBatches = computed(() => {
    const { recordId, date, shift } = props.current;
    const current = props.currentPhotos
        .filter((p) => !p.comment_id && p.cat_id === props.cat?.cat_id && p.tab === props.tab)
        .map((p) => ({ ...p, date, shift }));
    const list = [...uploads.value.filter((p) => p.shift_id !== recordId), ...current].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
    );
    const batches = [];
    for (const photo of list) {
        const same = photo.upload_batch && batches.find((b) => b.batch === photo.upload_batch);
        if (same) {
            same.photos.push(photo);
        } else {
            batches.push({
                uploadKey: `upload-${photo.id}`,
                batch: photo.upload_batch || null,
                uploaded_by: photo.uploaded_by,
                author_name: photo.author_name,
                shift_id: photo.shift_id,
                date: photo.date,
                shift: photo.shift,
                created_at: photo.created_at,
                photos: [photo],
            });
        }
    }
    return batches;
});

// 上傳紀錄的照片看大圖：這一筆的幾張左右換，下面是描述（沒有「跳到這則留言」）
function openUploadPhotos(batch, index) {
    viewerPhotos.value = batch.photos.map((p) => ({
        url: p.url,
        label: shiftText(batch),
        meta: `${p.author_name || '未命名'} ${timeText(p)}`,
        kinds: p.kinds,
        text: p.note,
        textKind: 'note',
        raw: p,
    }));
    viewerIndex.value = index;
}

const isMine = (m) => !!props.me && m.created_by === props.me;

// 頭像：有上傳就用照片，沒有就用名字第一個字，顏色照名字固定（composables/authorAvatar.js）
const initial = (m) => authorInitial(m.author_name);
const avatarStyle = (m) => authorAvatarStyle(m.author_name);

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
}

async function scrollToBottom(el = listEl) {
    await nextTick();
    if (el.value) el.value.scrollTop = el.value.scrollHeight;
    if (el === listEl) newCount.value = 0;
}

// 別人的新留言：正在看最下面就跟著捲下去；往上看舊留言時不打斷，改成「↓ N 則新留言」
const NEAR_BOTTOM_PX = 80;
const newCount = ref(0);
const nearBottom = () => {
    const el = listEl.value;
    return !!el && el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
};

async function receiveMessage(message) {
    const isNew = visible(message) && !messages.value.some((m) => m.id === message.id);
    const follow = view.value === 'messages' && nearBottom();
    upsert(message);
    if (!isNew) return;
    if (follow) scrollToBottom();
    else newCount.value++;
}

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
    uploads.value.push(...(data.uploads || []).filter((p) => !uploads.value.some((u) => u.id === p.id)));
    hasMore.value = data.hasMore;
    cursor.value = data.cursor;
}

// 已經載入的頻道（貓、分頁、正在看的班）。關掉面板時資料與即時同步都留著（一直在收別人的留言），
// 同一個頻道再打開（例如從照片庫切回來）直接顯示、停在原本的位置；換了頻道才從頭載入
let loadedKey = null;
const channelKey = () => `${props.cat?.cat_id}-${props.tab}-${props.current.recordId}`;

async function open() {
    viewerIndex.value = null;
    if (loadedKey !== channelKey()) {
        loadedKey = channelKey();
        resetSearch();
        view.value = 'messages';
        editingId.value = null;
        await reloadChannel();
        subscribe();
    }
    if (props.jump) {
        const { commentId, date, shift } = props.jump;
        emit('jumped');
        await jumpTo(commentId, { date, shift });
    }
}

// 從頭載入這個頻道（打開時、斷線重連或從背景回來時）
async function reloadChannel() {
    messages.value = [];
    newCount.value = 0;
    loadedShifts.value = [];
    uploads.value = [];
    cursor.value = null;
    hasMore.value = false;
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
    if (newCount.value && nearBottom()) newCount.value = 0;
}

// 照片庫的留言照片、搜尋結果 → 那則留言：切回留言，還沒載入到就一次往前載到那則的班（target 是 { date, shift }），
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

function toggleSearch() {
    if (view.value === 'search') leaveSearch();
    else openSearch();
}

// 收起搜尋：回到留言，搜尋的字與看過的標記都留著
function leaveSearch() {
    clearTimeout(searchTimer);
    view.value = 'messages';
}

async function openSearch() {
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

// 「取消」：連記住的字一起清掉，回到留言
function closeSearch() {
    resetSearch(true);
    view.value = 'messages';
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
    const added = files.slice(0, Math.max(0, room)).map((file) => ({
        key: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        kinds: [],
    }));
    list.value.push(...added);
    // 剛加的第一張先選起來，下面直接出現類型可以點
    if (added.length && hasKinds.value && !list.value.some((a) => a.key === pickingKey.value)) {
        pickingKey.value = added[0].key;
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
        kinds: [...a.kinds],
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
        broadcastMessage({ action: 'upsert', message });
        emit('added', message);
        draft.value = '';
        draftForNext.value = false;
        clearAttachments();
        scrollToBottom();
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
        broadcastMessage({ action: 'upsert', message: updated });
        emit('updated', updated);
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
        broadcastMessage({ action: 'delete', id: m.id });
        emit('removed', m.id);
    } catch (e) {
        console.error('delete comment error:', e);
        ElMessage.error('刪除失敗，請再試一次');
    }
}

// ---- 即時（Broadcast，見 composables/useBroadcast.js）：別人新增、編輯、刪除，開著的頻道跟著變 ----
// 一個頻道（一隻貓、一個分頁）一個私人頻道 comments:<貓>:<分頁>，訊息 message：
//   { action: 'upsert', message }（整則，含照片網址）或 { action: 'delete', id }
const { join: joinBroadcast, send: sendBroadcast } = useBroadcast();
let realtime = null;
const channelTopic = () => `comments:${props.cat.cat_id}:${props.tab}`;

function broadcastMessage(payload) {
    sendBroadcast(channelTopic(), 'message', JSON.parse(JSON.stringify(payload)), realtime);
}

// 收到一則留言的變更（別人廣播來的，或值班頁在照片庫刪了留言照片時直接呼叫）
function applyMessage({ action, message, id }) {
    if (action === 'delete') removeLocal(id);
    else receiveMessage(message);
}
defineExpose({ applyMessage });

function subscribe() {
    unsubscribe();
    realtime = joinBroadcast(channelTopic(), { message: applyMessage }, { onResync: reloadChannel });
}

function unsubscribe() {
    realtime?.leave();
    realtime = null;
}

// 打開就載入（同一個頻道不重載）。關掉不停即時同步，換頻道時 subscribe 會先離開舊的、離開頁面時才全部停
watch(
    () => [props.modelValue, props.cat?.cat_id, props.tab, props.current.recordId],
    ([isOpen, catId]) => {
        if (isOpen && catId) open();
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
// 標題列右邊依序：🔍、留言／照片、✕；🔍 靠右推過去
.ch-search-btn {
    margin-left: auto;
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
.ch-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 16px 10px;
    text-align: left;
}

// 高度 0、黏在捲動區底部，藥丸才浮在最下面又不佔版面
.ch-new-wrap {
    position: sticky;
    bottom: 0;
    height: 0;
}

.ch-new {
    position: absolute;
    bottom: 10px;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 4px;
    width: auto;
    height: 32px;
    margin: 0;
    padding: 0 14px;
    border: none;
    border-radius: 16px;
    background: #6da2c2;
    color: #fff;
    font-size: 13px;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transform: translateX(-50%);
    cursor: pointer;

    // 中文字的墨水中心比 line box 低一點，箭頭跟著往下 1px 才看起來齊
    .ch-new-icon {
        transform: translateY(1px);
    }
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

// 上傳紀錄：頭像位置是灰色 🗂️，一行灰字，照片放在淡灰框裡（看得出是系統訊息，不是有人留言）
.ch-avatar-system {
    background: #f0eeec;
    font-size: 16px;
}

.ch-upload {
    .ch-upload-text {
        color: #8e8783;
    }

    .ch-upload-box {
        padding: 6px;
        border-radius: 12px;
        background: #f7f6f5;
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
        position: relative;
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

        // 剩食、貓砂：左上角暖橘膠囊（跟照片庫一樣）
        .ch-photo-kind {
            position: absolute;
            top: 4px;
            left: 4px;
            padding: 0 7px;
            border-radius: 10px;
            background: #e08a3c;
            color: #fff;
            font-size: 11px;
            line-height: 20px;
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

    // 選中要選類型的那張：藍框
    .ch-attachment.picking .ch-attachment-pick {
        outline: 2px solid #6da2c2;
        outline-offset: -2px;
    }

    // 整張縮圖是按鈕（點了選類型）。全域 button 樣式要蓋回來
    .ch-attachment-pick {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: none;
        overflow: hidden;
        cursor: pointer;

        &:disabled {
            cursor: default;
        }
    }

    // 左下角：選了的類型（剛到要拍的那組暖橘、其他藍），沒選是灰色「＋類型」
    .ch-attachment-kind {
        position: absolute;
        bottom: 3px;
        left: 3px;
        max-width: calc(100% - 6px);
        padding: 0 5px;
        overflow: hidden;
        border-radius: 8px;
        background: #6da2c2;
        color: #fff;
        font-size: 10px;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.observe {
            background: #e08a3c;
        }

        &.empty {
            background: rgba(0, 0, 0, 0.5);
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

// 附照片時，選中那張的類型：一排膠囊（components/PhotoKindPicker.vue），前面寫第幾張
.ch-kind-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-bottom: 8px;

    .ch-kind-label {
        font-size: 12px;
        color: #8e8783;
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
