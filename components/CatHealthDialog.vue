<template>
    <!-- 醫療紀錄（類型：看診、急診、回診、貓屋處理；項目可多選）的新增／編輯視窗，貓咪檔案的小檔案用。只有管理員打得開；
         照片先在手機壓縮、直接傳到 Storage（cat-health），按儲存才一起送出 -->
    <div class="cat-health-dialog">
        <el-dialog
            :model-value="modelValue"
            :title="record ? '編輯醫療紀錄' : '新增醫療紀錄'"
            width="90%"
            class="health-dialog"
            align-center
            :close-on-click-modal="!saving"
            @update:model-value="close"
        >
            <el-form label-position="top" @submit.prevent>
                <!-- 類型單選：看醫生的三種，最後一個是貓屋處理（前面一條分隔線） -->
                <el-form-item label="類型">
                    <div class="chips">
                        <template v-for="t in HEALTH_TYPES" :key="t.key">
                            <span v-if="t.key === 'house'" class="chip-sep" aria-hidden="true"></span>
                            <button
                                type="button"
                                class="chip"
                                :class="{ on: form.kind === t.key }"
                                :disabled="saving"
                                @click="form.kind = t.key"
                            >
                                {{ t.label }}
                            </button>
                        </template>
                    </div>
                </el-form-item>
                <!-- 項目多選：預設的＋大家加過的標籤（灰色）；「＋ 其他」打字加入新的 -->
                <el-form-item label="項目（可多選，至少一個）">
                    <div class="chips">
                        <button
                            v-for="item in itemChoices"
                            :key="item"
                            type="button"
                            class="chip"
                            :class="{ on: form.items.includes(item), custom: !isPresetItem(item) }"
                            :disabled="saving"
                            @click="toggleItem(item)"
                        >
                            {{ item }}
                        </button>
                        <button
                            v-if="!addingItem"
                            type="button"
                            class="chip chip-add"
                            :disabled="saving || form.items.length >= MAX_HEALTH_ITEMS"
                            @click="startAddItem"
                        >
                            ＋ 其他
                        </button>
                    </div>
                    <!-- 加標籤：「加入」嵌在輸入框右邊，最右邊 ✕ 取消 -->
                    <div v-if="addingItem" class="item-input">
                        <div class="item-field">
                            <input
                                ref="itemInput"
                                v-model="newItem"
                                type="text"
                                placeholder="例如：剪耳"
                                :maxlength="MAX_HEALTH_ITEM_LENGTH"
                                @keydown.enter.prevent="addItem"
                            />
                            <button type="button" class="item-add" @click="addItem">加入</button>
                        </div>
                        <button type="button" class="item-cancel" aria-label="取消" @click="cancelAddItem">
                            <Icon icon="mdi:close" width="18" />
                        </button>
                    </div>
                </el-form-item>
                <el-form-item label="日期">
                    <el-date-picker
                        v-model="form.date"
                        type="date"
                        value-format="YYYY-MM-DD"
                        placeholder="選擇日期"
                        :editable="false"
                        :clearable="false"
                        :disabled="saving"
                    />
                </el-form-item>
                <!-- 陪同者：志工名單一顆一顆點（不用打字，手機不會跳鍵盤）；名單上沒有的按「＋ 其他」打字加入（灰色） -->
                <el-form-item label="陪同者（可多選）">
                    <div class="chips">
                        <button
                            v-for="name in companionChoices"
                            :key="name"
                            type="button"
                            class="chip"
                            :class="{ on: form.companions.includes(name), custom: !volunteerNames.includes(name) }"
                            :disabled="saving"
                            @click="toggleCompanion(name)"
                        >
                            {{ name }}
                        </button>
                        <button
                            v-if="!addingCompanion"
                            type="button"
                            class="chip chip-add"
                            :disabled="saving || form.companions.length >= MAX_COMPANIONS"
                            @click="startAddCompanion"
                        >
                            ＋ 其他
                        </button>
                    </div>
                    <div v-if="addingCompanion" class="item-input">
                        <div class="item-field">
                            <input
                                ref="companionInput"
                                v-model="newCompanion"
                                type="text"
                                placeholder="例如：林醫師"
                                :maxlength="MAX_COMPANION_LENGTH"
                                @keydown.enter.prevent="addCompanion"
                            />
                            <button type="button" class="item-add" @click="addCompanion">加入</button>
                        </div>
                        <button type="button" class="item-cancel" aria-label="取消" @click="cancelAddCompanion">
                            <Icon icon="mdi:close" width="18" />
                        </button>
                    </div>
                </el-form-item>
                <el-form-item label="描述">
                    <el-input
                        v-model="form.note"
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 6 }"
                        placeholder="例如：數值穩定，醫生開了兩個禮拜止痛"
                        :disabled="saving"
                    />
                </el-form-item>
                <el-form-item :label="`照片（${photoCount}/${MAX_PHOTOS}）`">
                    <div class="photos">
                        <div v-for="photo in keptPhotos" :key="photo.id" class="photo">
                            <img :src="photo.thumb_url" alt="" />
                            <button
                                v-if="!saving"
                                type="button"
                                class="photo-remove"
                                aria-label="拿掉這張"
                                @click="removedIds = [...removedIds, photo.id]"
                            >
                                ✕
                            </button>
                        </div>
                        <div v-for="item in added" :key="item.key" class="photo">
                            <img :src="item.preview" alt="" />
                            <button
                                v-if="!saving"
                                type="button"
                                class="photo-remove"
                                aria-label="拿掉這張"
                                @click="removeAdded(item)"
                            >
                                ✕
                            </button>
                        </div>
                        <button
                            v-if="photoCount < MAX_PHOTOS && !saving"
                            type="button"
                            class="photo-add"
                            aria-label="加照片"
                            @click="fileInput?.click()"
                        >
                            <Icon icon="mdi:camera-plus-outline" width="22" />
                        </button>
                        <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="pickPhotos" />
                    </div>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button v-if="record" type="danger" plain :disabled="saving" @click="confirmDelete">刪除</el-button>
                <el-button :disabled="saving" @click="close(false)">取消</el-button>
                <el-button type="primary" :loading="saving" @click="save">{{ savingText || '儲存' }}</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
// v-model：開關。catId：哪隻貓。record：要編輯的那筆（null＝新增）。preset：新增時預先帶的 { kind, items }
// saved(row)：存好的那筆（含照片網址）。deleted(id)：刪掉了
import { Icon } from '@iconify/vue';
import Swal from 'sweetalert2';
import {
    HEALTH_ITEMS,
    HEALTH_TYPES,
    MAX_COMPANIONS,
    MAX_COMPANION_LENGTH,
    MAX_HEALTH_ITEMS,
    MAX_HEALTH_ITEM_LENGTH,
    isPresetItem,
    sortHealthItems,
} from '~/composables/healthKinds';
import { compressPhoto } from '~/composables/useImageCompress';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    catId: { type: Number, required: true },
    record: { type: Object, default: null },
    // 新增時預先帶好的類型與項目（基本資料卡上的「＋」：驅蟲、預防針、結紮）
    preset: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'saved', 'deleted']);

const MAX_PHOTOS = 10;
const { $dayjs } = useNuxtApp();
const { uploadFile } = usePhotoUpload();

const form = ref({ kind: 'visit', date: null, items: [], companions: [], note: '' });
const removedIds = ref([]); // 原本的照片按了 ✕
const added = ref([]); // 新選的：{ key, file, preview }
const saving = ref(false);
const savingText = ref('');
const fileInput = ref(null);

// ---- 項目：預設的、大家加過的（/api/cats/health/items，打開時抓一次）、這筆已經有的，照順序列 ----
const customItems = ref([]); // 大家加過的標籤
const addingItem = ref(false);
const newItem = ref('');
const itemInput = ref(null);

const itemChoices = computed(() => sortHealthItems([...HEALTH_ITEMS, ...customItems.value, ...form.value.items]));

function toggleItem(item) {
    form.value.items = form.value.items.includes(item)
        ? form.value.items.filter((i) => i !== item)
        : [...form.value.items, item];
}

function startAddItem() {
    addingItem.value = true;
    newItem.value = '';
    nextTick(() => itemInput.value?.focus());
}

function cancelAddItem() {
    addingItem.value = false;
    newItem.value = '';
}

// 打好的字變成一顆標籤並勾起來（已經有一樣的就直接勾）
function addItem() {
    const item = newItem.value.trim().slice(0, MAX_HEALTH_ITEM_LENGTH);
    if (item && !form.value.items.includes(item)) form.value.items = [...form.value.items, item];
    cancelAddItem();
}

// ---- 陪同者：有效志工的暱稱（/api/volunteer/list，打開視窗時抓一次）＋這筆已經有、但不在名單上的 ----
const addingCompanion = ref(false);
const newCompanion = ref('');
const companionInput = ref(null);

const companionChoices = computed(() => [
    ...volunteerNames.value,
    ...form.value.companions.filter((name) => !volunteerNames.value.includes(name)),
]);

function toggleCompanion(name) {
    if (form.value.companions.includes(name)) {
        form.value.companions = form.value.companions.filter((n) => n !== name);
    } else if (form.value.companions.length < MAX_COMPANIONS) {
        form.value.companions = [...form.value.companions, name];
    }
}

function startAddCompanion() {
    addingCompanion.value = true;
    newCompanion.value = '';
    nextTick(() => companionInput.value?.focus());
}

function cancelAddCompanion() {
    addingCompanion.value = false;
    newCompanion.value = '';
}

// 打好的名字加進來並選起來（已經選了就不重複）
function addCompanion() {
    const name = newCompanion.value.trim().slice(0, MAX_COMPANION_LENGTH);
    if (name && !form.value.companions.includes(name) && form.value.companions.length < MAX_COMPANIONS) {
        form.value.companions = [...form.value.companions, name];
    }
    cancelAddCompanion();
}


const volunteerNames = ref([]);
async function loadVolunteers() {
    if (volunteerNames.value.length) return;
    try {
        const list = await $fetch('/api/volunteer/list');
        volunteerNames.value = [...new Set(list.map((v) => v.name).filter(Boolean))];
    } catch (e) {
        console.error('load volunteers error:', e);
    }
}

async function loadCustomItems() {
    try {
        customItems.value = await $fetch('/api/cats/health/items');
    } catch (e) {
        console.error('load health items error:', e);
    }
}
const keptPhotos = computed(() => (props.record?.photos || []).filter((p) => !removedIds.value.includes(p.id)));
const photoCount = computed(() => keptPhotos.value.length + added.value.length);

function clearAdded() {
    added.value.forEach((item) => URL.revokeObjectURL(item.preview));
    added.value = [];
}

// 每次打開都照傳進來的那筆（或空白、日期預設今天）重新填
watch(
    () => props.modelValue,
    (open) => {
        if (!open) return;
        const r = props.record;
        form.value = r
            ? {
                  kind: r.kind,
                  date: r.date,
                  items: [...(r.items || [])],
                  companions: [...(r.companions || [])],
                  note: r.note || '',
              }
            : {
                  kind: props.preset?.kind || 'visit',
                  date: $dayjs().format('YYYY-MM-DD'),
                  items: [...(props.preset?.items || [])],
                  companions: [],
                  note: '',
              };
        removedIds.value = [];
        clearAdded();
        cancelAddItem();
        cancelAddCompanion();
        loadCustomItems();
        loadVolunteers();
    },
    { immediate: true }
);

function close(value = false) {
    if (saving.value) return;
    if (!value) clearAdded();
    emit('update:modelValue', value);
}

function pickPhotos(event) {
    const files = [...(event.target.files || [])].slice(0, MAX_PHOTOS - photoCount.value);
    event.target.value = '';
    added.value = [
        ...added.value,
        ...files.map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
    ];
}

function removeAdded(item) {
    URL.revokeObjectURL(item.preview);
    added.value = added.value.filter((x) => x !== item);
}

// 新選的照片：壓縮 → 拿上傳網址 → 傳大圖與縮圖。回傳要存的路徑
async function uploadAdded() {
    if (!added.value.length) return [];
    const slots = await $fetch('/api/cats/health/upload-url', {
        method: 'POST',
        body: { catId: props.catId, count: added.value.length },
    });
    const uploaded = [];
    for (const [i, item] of added.value.entries()) {
        savingText.value = `上傳照片 ${i + 1}/${added.value.length}`;
        const { full, thumb } = await compressPhoto(item.file);
        const slot = slots[i];
        await uploadFile(slot.path, slot.token, full.blob, () => {}, 'cat-health');
        await uploadFile(slot.thumbPath, slot.thumbToken, thumb.blob, () => {}, 'cat-health');
        uploaded.push({
            path: slot.path,
            thumbPath: slot.thumbPath,
            width: full.width,
            height: full.height,
            size: full.blob.size,
        });
    }
    return uploaded;
}

async function save() {
    // 打了字還沒按加入：當成要加
    if (addingItem.value && newItem.value.trim()) addItem();
    if (addingCompanion.value && newCompanion.value.trim()) addCompanion();
    const { kind, date, note, companions } = form.value;
    const items = sortHealthItems(form.value.items);
    if (!date) {
        Swal.fire({ text: '請選日期' });
        return;
    }
    if (!items.length) {
        Swal.fire({ text: '請至少選一個項目' });
        return;
    }

    saving.value = true;
    try {
        const photos = await uploadAdded();
        savingText.value = '儲存中';
        const row = props.record
            ? await $fetch('/api/cats/health/update', {
                  method: 'POST',
                  body: { id: props.record.id, kind, date, items, companions, note, addPhotos: photos, removePhotoIds: removedIds.value },
              })
            : await $fetch('/api/cats/health', {
                  method: 'POST',
                  body: { catId: props.catId, kind, date, items, companions, note, photos },
              });
        saving.value = false;
        close(false);
        emit('saved', row);
    } catch (e) {
        console.error('save health record error:', e);
        Swal.fire({ text: '儲存失敗，請再試一次' });
    } finally {
        saving.value = false;
        savingText.value = '';
    }
}

async function confirmDelete() {
    const { isConfirmed } = await Swal.fire({
        html: '確定要刪除這筆醫療紀錄嗎？<br><span class="swal-hint">照片會一起刪除，刪除後無法復原。</span>',
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });
    if (!isConfirmed) return;

    saving.value = true;
    try {
        await $fetch('/api/cats/health/delete', { method: 'POST', body: { id: props.record.id } });
        saving.value = false;
        const id = props.record.id;
        close(false);
        emit('deleted', id);
    } catch (e) {
        console.error('delete health record error:', e);
        Swal.fire({ text: '刪除失敗，請再試一次' });
    } finally {
        saving.value = false;
    }
}
</script>

<style lang="scss" scoped>
.cat-health-dialog {
    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .chip {
        width: auto;
        height: 30px;
        margin: 0;
        padding: 0 14px;
        border: 1px solid #d8d4d1;
        border-radius: 15px;
        background: #fff;
        color: #657181;
        font-size: 14px;
        line-height: 28px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }

        // 自己加的標籤：勾起來是灰色（跟預設項目分得出來）
        &.custom.on {
            border-color: #8a7f78;
            background: #8a7f78;
        }

        &.chip-add {
            border-style: dashed;
            color: #8a7f78;
        }
    }

    // 看醫生的三種與貓屋處理之間的分隔線
    .chip-sep {
        align-self: center;
        width: 1px;
        height: 20px;
        margin: 0 2px;
        background: #e4e0dd;
    }
}

.item-input {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    margin-top: 8px;
}

// 輸入框與「加入」一個外框，高度同其他欄位（40px）
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

// 全域 button 樣式（寬度、邊框、圓角）要蓋回來
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

.photos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.photo,
.photo-add {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
}

.photo img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.photo-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 11px;
}

.photo-add {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px dashed #c9c3be;
    background: #faf8f6;
    color: #8a7f78;
}

// 同貓咪編輯視窗：標籤在欄位上方，欄位佔滿寬度，內容可以捲
:deep(.health-dialog) {
    max-width: 420px;

    .el-dialog__body {
        max-height: 65vh;
        overflow-y: auto;
        padding-right: 8px;
    }

    .el-date-editor,
    .el-select {
        width: 100%;
    }

    .el-form-item {
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

    .el-input__wrapper {
        height: 40px;
        min-height: 40px;
        box-sizing: border-box;
    }

    .el-input {
        height: 40px;
    }

    .el-textarea .el-textarea__inner {
        min-height: 60px;
    }

    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        .el-button {
            flex: 1;
        }
    }
}
</style>
