<template>
    <!-- 新版貓咪（cat_profiles）的新增／編輯視窗：後台「貓咪管理」與貓咪檔案頁（/cats/[id]）共用。
         管理員直接寫資料庫（RLS is_admin()）。編輯時可以刪除 -->
    <div ref="root" class="cat-profile-dialog">
        <el-dialog
            :model-value="modelValue"
            :title="editingCat ? '編輯貓咪' : '新增貓咪'"
            width="90%"
            class="cat-dialog"
            align-center
            @update:model-value="emit('update:modelValue', $event)"
            @opened="scrollToFocus"
        >
            <AvatarCropper :file="avatarFile" @done="onCropped" @cancel="avatarFile = null" />

            <el-form :model="form" label-position="top" @submit.prevent>
                <!-- 淡底卡片：左邊頭像（點了換，右下角相機；下面「移除頭像」），右邊名稱、暱稱上下疊 -->
                <div class="head-card">
                    <div class="avatar-col">
                        <button type="button" class="avatar" aria-label="更換頭像" @click="avatarInput?.click()">
                            <img v-if="avatarPreview" :src="avatarPreview" alt="" />
                            <span v-else>{{ (form.name || '？').trim().charAt(0) }}</span>
                            <span class="avatar-badge"><Icon icon="mdi:camera" width="16" /></span>
                        </button>
                        <button v-if="avatarPreview" type="button" class="avatar-link" @click="clearAvatar">
                            移除頭像
                        </button>
                        <input ref="avatarInput" type="file" accept="image/*" hidden @change="pickAvatar" />
                    </div>
                    <div class="head-fields">
                        <el-form-item label="名稱">
                            <el-input v-model="form.name" placeholder="例如：大哥" />
                        </el-form-item>
                        <el-form-item label="暱稱">
                            <!-- 輸入後按 Enter 變成一個標籤，可以填多個 -->
                            <el-input-tag v-model="form.nicknames" placeholder="按 Enter 加入" />
                        </el-form-item>
                        <!-- 性別：兩顆分開的按鈕，選到淡色底（公藍、母粉），再點一次取消（不確定） -->
                        <el-form-item label="性別">
                            <div class="sex-picks">
                                <button
                                    v-for="sex in CAT_SEXES"
                                    :key="sex"
                                    type="button"
                                    :class="{ on: form.sex === sex, female: sex === '母' }"
                                    @click="form.sex = form.sex === sex ? '' : sex"
                                >
                                    <Icon :icon="sex === '公' ? 'mdi:gender-male' : 'mdi:gender-female'" width="16" />{{ sex }}
                                </button>
                            </div>
                        </el-form-item>
                    </div>
                </div>
                <!-- 位置：分段按鈕，再點一次取消 -->
                <el-form-item label="位置">
                    <div class="seg">
                        <button
                            v-for="location in LOCATIONS"
                            :key="location"
                            type="button"
                            :class="{ on: form.location === location }"
                            @click="form.location = form.location === location ? '' : location"
                        >
                            {{ location }}
                        </button>
                    </div>
                </el-form-item>

                <!-- 關於我：一點一點加（存在 notes，一行一點；貓咪檔案頁首每點前面一個 ❣️）。⋮⋮ 拖拉排序 -->
                <div class="form-sec">關於我</div>
                <draggable v-model="aboutItems" item-key="key" handle=".about-drag" class="about-list">
                    <template #item="{ element, index }">
                        <div class="about-row">
                            <span class="about-drag" aria-label="拖拉排序"><Icon icon="mdi:drag-vertical" width="18" /></span>
                            <span class="about-mark" aria-hidden="true">❣️</span>
                            <el-input
                                :ref="(el) => (aboutInputs[index] = el)"
                                v-model="element.text"
                                placeholder="例如：怕生，靠近要慢慢來"
                                maxlength="100"
                            />
                            <button type="button" class="about-remove" aria-label="刪除這點" @click="removeAbout(index)">
                                <Icon icon="mdi:close" width="16" />
                            </button>
                        </div>
                    </template>
                </draggable>
                <button type="button" class="about-add" @click="addAbout(aboutItems.length)">＋ 新增一點</button>

                <div class="form-sec">基本資料</div>
                <!-- 外觀：花色（可多選，自己加的灰色）、毛長（短毛／長毛擇一，再點一次取消＝不確定）都在同一排；
                     「＋ 其他」打字加花色 -->
                <el-form-item label="外觀" data-field="looks">
                    <div class="chips">
                        <button
                            v-for="coat in coatChoices"
                            :key="coat"
                            type="button"
                            class="chip"
                            :class="{ on: form.coats.includes(coat), custom: !COAT_COLORS.includes(coat) }"
                            @click="toggleCoat(coat)"
                        >
                            {{ coat }}
                        </button>
                        <button
                            v-for="len in COAT_LENGTHS"
                            :key="len"
                            type="button"
                            class="chip"
                            :class="{ on: form.coat_length === len }"
                            @click="form.coat_length = form.coat_length === len ? '' : len"
                        >
                            {{ len }}
                        </button>
                        <button v-if="!addingCoat" type="button" class="chip chip-add" @click="startAddCoat">＋ 其他</button>
                    </div>
                    <div v-if="addingCoat" class="item-input">
                        <div class="item-field">
                            <input
                                ref="coatInput"
                                v-model="newCoat"
                                type="text"
                                placeholder="例如：暹羅"
                                :maxlength="MAX_COAT_LENGTH"
                                @keydown.enter.prevent="(e) => !isImeEnter(e) && addCoat()"
                            />
                            <button type="button" class="item-add" @click="addCoat">加入</button>
                        </div>
                        <button type="button" class="item-cancel" aria-label="取消" @click="cancelAddCoat">
                            <Icon icon="mdi:close" width="18" />
                        </button>
                    </div>
                </el-form-item>

                <div class="two-col">
                    <el-form-item label="入住日期" data-field="arrived">
                        <el-date-picker
                            v-model="form.arrived_on"
                            type="date"
                            value-format="YYYY-MM-DD"
                            placeholder="選擇日期"
                            :editable="false"
                        />
                    </el-form-item>
                    <!-- 生日多半是估的，選到日就好（不確定的日子隨便選那個月一天） -->
                    <el-form-item label="生日（預估）" data-field="birthday">
                        <el-date-picker
                            v-model="form.birthday"
                            type="date"
                            value-format="YYYY-MM-DD"
                            placeholder="選擇日期"
                            :editable="false"
                        />
                    </el-form-item>
                </div>
                <!-- 入住日期下：在貓屋住了多久（有到新家日期算到那天，沒有算到今天）；生日下：大約幾歲 -->
                <div v-if="stayHint || ageText" class="two-col">
                    <div class="age-hint">{{ stayHint }}</div>
                    <div class="age-hint">{{ ageText }}</div>
                </div>
                <el-form-item label="結紮" data-field="neutered">
                    <div class="chips">
                        <button
                            v-for="opt in NEUTERED_OPTIONS"
                            :key="opt.value"
                            type="button"
                            class="chip"
                            :class="{ on: form.neutered === opt.value }"
                            @click="form.neutered = opt.value"
                        >
                            {{ opt.label }}
                        </button>
                    </div>
                </el-form-item>
                <!-- 領養：自己一區，只填到新家日期（adopted_on），有日期就是已領養、清掉就是沒領養。
                     舊資料「已領養但沒日期」的顯示「已領養，日期未填」，不填日期存檔還是已領養 -->
                <template v-if="editingCat">
                    <div class="form-sec">領養</div>
                    <el-form-item label="到新家日期">
                        <el-date-picker
                            v-model="form.adopted_on"
                            type="date"
                            value-format="YYYY-MM-DD"
                            :placeholder="adoptedNoDate ? '已領養，日期未填' : '還沒領養'"
                            :editable="false"
                        />
                    </el-form-item>
                    <div v-if="form.adopted_on && stayHint" class="age-hint">{{ stayHint }}</div>
                </template>
            </el-form>
            <template #footer>
                <el-button v-if="editingCat" type="danger" plain :disabled="savingCat" @click="confirmDelete">
                    刪除
                </el-button>
                <el-button @click="emit('update:modelValue', false)">取消</el-button>
                <el-button type="primary" :loading="savingCat" @click="saveCat">儲存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
// v-model：開關。cat：要編輯的那隻（null＝新增）。nextSortOrder：新增時排在哪（後台傳，清單最後一個 + 1）
// saved(id)：存好了（資料與頭像），呼叫的頁面自己重抓。deleted(id)：刪掉了
import draggable from 'vuedraggable';
import { Icon } from '@iconify/vue';
import {
    CAT_SEXES,
    COAT_COLORS,
    COAT_LENGTHS,
    MAX_COAT_LENGTH,
    catAgeText,
    stayText,
} from '~/composables/catTraits';
import Swal from 'sweetalert2';

const NEUTERED_OPTIONS = [
    { value: 'yes', label: '已結紮' },
    { value: 'no', label: '未結紮' },
    { value: '', label: '不確定' },
];

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    cat: { type: Object, default: null },
    nextSortOrder: { type: Number, default: 1 },
    // 打開時捲到哪一欄（貓咪檔案點卡片進來）：arrived 入住日期、birthday 生日、looks 花色起的外觀、neutered 結紮
    focus: { type: String, default: null },
});
const emit = defineEmits(['update:modelValue', 'saved', 'deleted']);

const supabase = useSupabaseClient();
const { avatarUrl, uploadAvatar, removeAvatar } = useAvatar();

// 打開動畫結束後，視窗內容捲到指定的欄位，那一欄底色閃一下
const root = ref(null);
function scrollToFocus() {
    if (!props.focus) return;
    const body = root.value?.querySelector('.el-dialog__body');
    const field = body?.querySelector(`[data-field="${props.focus}"]`);
    if (!field) return;
    const top = field.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
    body.scrollTo({ top, behavior: 'smooth' });
    field.classList.add('field-flash');
    setTimeout(() => field.classList.remove('field-flash'), 1600);
}

// 編輯中的那隻。新增成功後也記在這裡：頭像傳失敗再按儲存，是更新這隻而不是又新增一隻
const editingCat = ref(null);
const form = ref(emptyForm());
const savingCat = ref(false);

function emptyForm() {
    return {
        name: '',
        nicknames: [],
        location: '',
        adopted_on: null,
        coats: [],
        // 單選的「不確定」用空字串（el-radio 不收 null），存的時候轉回 null
        sex: '',
        neutered: '', // 'yes' / 'no' / ''
        coat_length: '',
        arrived_on: null,
        birthday: null,
    };
}

function formOf(cat) {
    return {
        name: cat.name,
        nicknames: [...(cat.nicknames || [])],
        location: cat.location || '',
        adopted_on: cat.adopted_on ?? null,
        coats: [...(cat.coats || [])],
        sex: cat.sex || '',
        neutered: cat.neutered === true ? 'yes' : cat.neutered === false ? 'no' : '',
        coat_length: cat.coat_length || '',
        arrived_on: cat.arrived_on ?? null,
        birthday: cat.birthday ?? null,
    };
}

// ---- 關於我：notes 一行一點，編輯時拆成一列一列（手打的「-」「・」開頭拿掉） ----
const aboutItems = ref([]); // [{ key, text }]
const aboutInputs = ref([]);
const aboutOf = (notes) =>
    (notes || '')
        .split('\n')
        .map((line) => line.trim().replace(/^[-–•・*]\s*/, ''))
        .filter(Boolean)
        .map((text) => ({ key: crypto.randomUUID(), text }));

// 按「＋ 新增一點」：在 index 的位置插一列空的並移過去（按 Enter 不會新增：中文輸入法選字也會按 Enter）
function addAbout(index) {
    aboutItems.value.splice(index, 0, { key: crypto.randomUUID(), text: '' });
    nextTick(() => aboutInputs.value[index]?.focus());
}

function removeAbout(index) {
    aboutItems.value.splice(index, 1);
}


// 暱稱：去掉空白、重複，以及跟名稱本身一樣的
function cleanNicknames(name) {
    return [...new Set((form.value.nicknames || []).map((n) => n.trim()).filter((n) => n && n !== name))];
}

function toggleCoat(coat) {
    form.value.coats = form.value.coats.includes(coat)
        ? form.value.coats.filter((c) => c !== coat)
        : [...form.value.coats, coat];
}

// 花色選項：清單上的，加上這隻已經有、但不在清單上的（自己加的）
const coatChoices = computed(() => [...COAT_COLORS, ...form.value.coats.filter((c) => !COAT_COLORS.includes(c))]);

// 「＋ 其他」：打字加一個花色並選起來
const addingCoat = ref(false);
const newCoat = ref('');
const coatInput = ref(null);
function startAddCoat() {
    addingCoat.value = true;
    newCoat.value = '';
    nextTick(() => coatInput.value?.focus());
}
function cancelAddCoat() {
    addingCoat.value = false;
    newCoat.value = '';
}
function addCoat() {
    const coat = newCoat.value.trim().slice(0, MAX_COAT_LENGTH);
    if (coat && !form.value.coats.includes(coat)) form.value.coats = [...form.value.coats, coat];
    cancelAddCoat();
}

// 生日（預估）→ 大約幾歲（滿 1 歲顯示幾歲幾個月，不滿 1 歲顯示幾個月）
const ageText = computed(() => catAgeText(form.value.birthday));

// 領養：有日期就是已領養。舊資料已領養但沒日期的，沒填日期就維持已領養
const adoptedNoDate = computed(() => !!editingCat.value?.adopted && !editingCat.value?.adopted_on);
// 在貓屋住了多久：從入住日算到到新家那天，還沒到新家就算到今天
const stayHint = computed(() => {
    const { arrived_on: arrived, adopted_on: adopted } = form.value;
    const stay = arrived && stayText(arrived, adopted || undefined);
    return stay ? `在貓屋住了 ${stay}` : '';
});

// ---- 頭像：在視窗裡先選好、裁好，按儲存才上傳 ----
const avatarInput = ref(null);
const avatarFile = ref(null); // 選好的照片，有值就打開裁切視窗
const avatarBlob = ref(null); // 裁好、還沒上傳的
const avatarRemoved = ref(false); // 按了移除
const avatarBlobUrl = ref(null);

const avatarPreview = computed(() => {
    if (avatarBlobUrl.value) return avatarBlobUrl.value;
    if (avatarRemoved.value) return null;
    return editingCat.value?.avatar_path ? avatarUrl(editingCat.value.avatar_path) : null;
});

function resetAvatarDraft() {
    if (avatarBlobUrl.value) URL.revokeObjectURL(avatarBlobUrl.value);
    avatarBlobUrl.value = null;
    avatarBlob.value = null;
    avatarRemoved.value = false;
    avatarFile.value = null;
}

function pickAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) avatarFile.value = file;
}

function onCropped(blob) {
    resetAvatarDraft();
    avatarBlob.value = blob;
    avatarBlobUrl.value = URL.createObjectURL(blob);
}

function clearAvatar() {
    resetAvatarDraft();
    avatarRemoved.value = true;
}

// 儲存貓咪之後處理頭像：有新裁的就上傳，按了移除就刪掉
async function saveCatAvatar(catId) {
    if (avatarBlob.value) await uploadAvatar({ target: 'cat', catId, blob: avatarBlob.value });
    else if (avatarRemoved.value && editingCat.value?.avatar_path) await removeAvatar({ target: 'cat', catId });
}

// 頭像上傳失敗時資料已經存了，提示再試一次（視窗留著，按儲存會再傳）
async function saveAvatarSafely(catId) {
    try {
        await saveCatAvatar(catId);
        return true;
    } catch (e) {
        console.error('save cat avatar error:', e);
        Swal.fire({ text: '資料已儲存，但頭像上傳失敗，請再按一次儲存' });
        return false;
    }
}

async function saveCat() {
    // 打了字還沒按加入：當成要加
    if (addingCoat.value && newCoat.value.trim()) addCoat();
    const name = form.value.name.trim();
    if (!name) {
        Swal.fire({ text: '請輸入貓咪名稱' });
        return;
    }

    const payload = {
        name,
        nicknames: cleanNicknames(name),
        location: form.value.location || null,
        adopted: !!form.value.adopted_on || adoptedNoDate.value,
        adopted_on: form.value.adopted_on || null,
        // 花色：清單上的照清單順序，自己加的接在後面
        coats: [
            ...COAT_COLORS.filter((c) => form.value.coats.includes(c)),
            ...form.value.coats.map((c) => c.trim()).filter((c) => c && !COAT_COLORS.includes(c)),
        ],
        sex: form.value.sex || null,
        neutered: form.value.neutered === '' ? null : form.value.neutered === 'yes',
        coat_length: form.value.coat_length || null,
        arrived_on: form.value.arrived_on || null,
        birthday: form.value.birthday || null,
        notes: aboutItems.value.map((i) => i.text.trim()).filter(Boolean).join('\n') || null,
    };

    savingCat.value = true;
    try {
        await writeCat(payload);
    } finally {
        savingCat.value = false;
    }
}

async function writeCat(payload) {
    let catId;
    if (editingCat.value) {
        catId = editingCat.value.id;
        const { error } = await supabase.from('cat_profiles').update(payload).eq('id', catId);
        if (error) {
            Swal.fire({ text: '更新失敗' });
            return;
        }
    } else {
        const { data: created, error } = await supabase
            .from('cat_profiles')
            .insert({ ...payload, sort_order: props.nextSortOrder })
            .select('id')
            .single();
        if (error) {
            Swal.fire({ text: '新增失敗' });
            return;
        }
        catId = created.id;
        editingCat.value = { ...payload, id: catId, avatar_path: null };
    }

    if (!(await saveAvatarSafely(catId))) {
        emit('saved', catId); // 資料存了，清單先更新
        return;
    }
    emit('update:modelValue', false);
    emit('saved', catId);
}

// 刪除確認。資料庫設了 on delete cascade：這隻貓的飲食、醫療、待辦與留言會一起刪掉
async function confirmDelete() {
    const cat = editingCat.value;
    const { isConfirmed } = await Swal.fire({
        html: `確定要刪除「${cat.name}」嗎？<br>牠的飲食、醫療、待辦設定與留言會一起刪除。<br>只是送養了的話，請改用「已領養」。`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });
    if (!isConfirmed) return;

    const { error } = await supabase.from('cat_profiles').delete().eq('id', cat.id);
    if (error) {
        Swal.fire({ text: '刪除失敗' });
        return;
    }
    emit('update:modelValue', false);
    emit('deleted', cat.id);
}

// 每次打開都照傳進來的那隻（或空白）重新填。放在最後：immediate 會馬上跑，用到的東西都要先宣告好
watch(
    () => props.modelValue,
    (open) => {
        if (!open) return;
        editingCat.value = props.cat;
        form.value = props.cat ? formOf(props.cat) : emptyForm();
        aboutItems.value = aboutOf(props.cat?.notes);
        cancelAddCoat();
        resetAvatarDraft();
    },
    { immediate: true }
);
</script>

<style lang="scss" scoped>
.cat-profile-dialog {
    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }

    :deep(.el-select) {
        width: 100%;
    }
}

// 頂部淡底卡片：頭像在左，名稱、暱稱疊在右邊
.head-card {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    padding: 12px;
    border-radius: 12px;
    background: #faf8f6;

    .head-fields {
        flex: 1;
        min-width: 0;
    }

    // 卡片裡的欄位白底，最後一欄不留下邊距
    :deep(.el-input__wrapper),
    :deep(.el-input-tag__wrapper) {
        background: #fff;
    }

    // 名稱、暱稱、性別一樣高（32px，比下面的欄位矮一點）
    :deep(.el-input),
    :deep(.el-input .el-input__wrapper),
    :deep(.el-input-tag__wrapper) {
        height: 32px;
        min-height: 32px;
    }

    :deep(.el-form-item:last-child) {
        margin-bottom: 0;
    }
}

.avatar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

// 頭像：點了選照片，右下角一個藍色相機小圓
.avatar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 112px;
    height: 112px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #e8e2dc;
    color: #6b625d;
    font-size: 40px;
    font-weight: 500;
    cursor: pointer;

    img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
    }
}

.avatar-badge {
    position: absolute;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: #6da2c2;
    color: #fff;
}

.avatar-link {
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: #b33a39;
    font-size: 12px;
    cursor: pointer;
}

// 分區標題：比欄位名稱大、深，字後面一條細線
.form-sec {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0 10px;
    color: #3d3936;
    font-size: 15px;
    font-weight: 600;

    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #f0edea;
    }
}

// 兩欄並排（名稱｜暱稱、入住日期｜生日）
.two-col {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
}

// 分段按鈕（位置）：一條框平分，選到的填色
.seg {
    display: flex;
    width: 100%;
    border: 1px solid #d8d4d1;
    border-radius: 8px;
    overflow: hidden;

    button {
        display: inline-flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: 2px;
        height: 30px;
        margin: 0;
        padding: 0;
        border: none;
        border-left: 1px solid #d8d4d1;
        background: #fff;
        color: #657181;
        font-size: 14px;
        cursor: pointer;

        &:first-child {
            border-left: none;
        }

        &.on {
            background: #6da2c2;
            color: #fff;
        }
    }
}

// 性別：兩顆分開的按鈕，和輸入框一樣高；選到淡色底（公藍、母粉）
.sex-picks {
    display: flex;
    gap: 8px;

    button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        height: 32px;
        margin: 0;
        padding: 0 14px;
        border: 1px solid #d8d4d1;
        border-radius: 8px;
        background: #fff;
        color: #657181;
        font-size: 14px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #eef5fa;
            color: #3f7598;
        }

        &.female.on {
            border-color: #d9809f;
            background: #fbeef3;
            color: #b24f74;
        }
    }
}

.age-hint {
    margin: -10px 0 12px;
    color: #a8a29e;
    font-size: 12px;
    text-align: right;
}

// 關於我：一列一點，⋮⋮ 拖拉、❣️、輸入框、✕
.about-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;

    .el-input {
        flex: 1;
        min-width: 0;
    }
}

.about-drag {
    display: flex;
    flex-shrink: 0;
    color: #c9c3be;
    cursor: grab;
}

.about-mark {
    flex-shrink: 0;
    font-size: 14px;
}

.about-remove {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: #a8a29e;
}

.about-add {
    display: block;
    width: 100%;
    height: 34px;
    margin: 0 0 16px;
    border: 1px dashed #c9c3be;
    border-radius: 6px;
    background: #faf8f6;
    color: #8a7f78;
    font-size: 13px;
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;

    .chip {
        width: auto;
        height: 28px;
        margin: 0;
        padding: 0 10px;
        border: 1px solid #d8d4d1;
        border-radius: 14px;
        background: #fff;
        color: #657181;
        font-size: 13px;
        line-height: 26px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }

        // 自己加的花色：選起來是灰色
        &.custom.on {
            border-color: #8a7f78;
            background: #8a7f78;
        }

        &.chip-add {
            border-style: dashed;
            color: #8a7f78;
        }
    }
}

// 「＋ 其他」的輸入：「加入」嵌在輸入框右邊，最右邊 ✕（同醫療紀錄的項目）
.item-input {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    margin-top: 8px;
}

.item-field {
    display: flex;
    flex: 1;
    min-width: 0;
    height: 40px;
    border: 1px solid #6da2c2;
    border-radius: 6px;
    overflow: hidden;

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        margin: 0;
        padding: 0 10px;
        border: none;
        outline: none;
        background: #fff;
        font-size: 14px;
    }
}

.item-add {
    flex-shrink: 0;
    width: auto;
    height: 100%;
    margin: 0;
    padding: 0 14px;
    border: none;
    border-radius: 0;
    background: #6da2c2;
    color: #fff;
    font-size: 14px;
}

.item-cancel {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: #8a7f78;
}

// 標籤放在欄位上方，欄位佔滿整個寬度。欄位多，視窗內容可以捲動
:deep(.cat-dialog) {
    max-width: 420px;

    .el-dialog__body {
        max-height: 65vh;
        overflow-y: auto;
        // 捲軸不要壓到欄位右邊框
        padding-right: 8px;
    }

    .el-date-editor {
        width: 100%;
    }

    // 從貓咪檔案點卡片進來、捲到的那一欄：底色閃一下
    .el-form-item.field-flash {
        background: #e6f0f6;
    }

    .el-form-item {
        margin-right: -6px;
        margin-left: -6px;
        padding: 2px 6px;
        border-radius: 8px;
        transition: background-color 0.4s;
        flex-direction: column;
        align-items: stretch;
        margin-bottom: 14px;
    }

    .el-form-item__label {
        justify-content: flex-start;
        height: auto;
        padding: 0;
        margin-bottom: 4px;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: #767676;
    }

    // 欄位高度統一 40px（全域把 select 設成 45px，其他輸入框是 32px）
    .el-select__wrapper,
    .el-input__wrapper {
        height: 40px;
        min-height: 40px;
        box-sizing: border-box;
    }

    .el-input {
        height: 40px;
    }

    // 按鈕平分一排：（刪除）取消 儲存
    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        .el-button {
            flex: 1;
        }
    }
}
</style>
