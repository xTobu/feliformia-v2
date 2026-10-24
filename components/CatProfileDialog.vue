<template>
    <!-- 新版貓咪（cat_profiles）的新增／編輯視窗：後台「貓咪管理」與貓咪檔案頁（/cats/[id]）共用。
         管理員直接寫資料庫（RLS is_admin()）。編輯時可以刪除 -->
    <div class="cat-profile-dialog">
        <el-dialog
            :model-value="modelValue"
            :title="editingCat ? '編輯貓咪' : '新增貓咪'"
            width="90%"
            class="cat-dialog"
            align-center
            @update:model-value="emit('update:modelValue', $event)"
        >
            <!-- 頭像：選照片 → 裁切 → 按儲存才上傳（新增的貓先建好再傳） -->
            <div class="avatar-row">
                <div class="avatar">
                    <img v-if="avatarPreview" :src="avatarPreview" alt="" />
                    <span v-else>{{ (form.name || '？').trim().charAt(0) }}</span>
                </div>
                <button type="button" class="avatar-btn" @click="avatarInput?.click()">
                    {{ avatarPreview ? '更換頭像' : '上傳頭像' }}
                </button>
                <button v-if="avatarPreview" type="button" class="avatar-link" @click="clearAvatar">移除</button>
                <input ref="avatarInput" type="file" accept="image/*" hidden @change="pickAvatar" />
            </div>
            <AvatarCropper :file="avatarFile" @done="onCropped" @cancel="avatarFile = null" />

            <el-form :model="form" label-position="top" @submit.prevent>
                <el-form-item label="名稱">
                    <el-input v-model="form.name" placeholder="例如：大哥" />
                </el-form-item>
                <el-form-item label="暱稱">
                    <!-- 輸入後按 Enter 變成一個標籤，可以填多個 -->
                    <el-input-tag v-model="form.nicknames" placeholder="輸入後按 Enter" />
                </el-form-item>
                <el-form-item label="位置">
                    <!-- 不開搜尋：手機點了不會跳出鍵盤 -->
                    <el-select v-model="form.location" placeholder="選擇位置" clearable>
                        <el-option v-for="location in LOCATIONS" :key="location" :label="location" :value="location" />
                    </el-select>
                </el-form-item>
                <el-form-item label="花色（可多選）">
                    <div class="chips">
                        <button
                            v-for="coat in COAT_COLORS"
                            :key="coat"
                            type="button"
                            class="chip"
                            :class="{ on: form.coats.includes(coat) }"
                            @click="toggleCoat(coat)"
                        >
                            {{ coat }}
                        </button>
                    </div>
                </el-form-item>
                <el-form-item label="性別">
                    <el-radio-group v-model="form.sex">
                        <el-radio v-for="sex in CAT_SEXES" :key="sex" :value="sex">{{ sex }}</el-radio>
                        <el-radio value="">不確定</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="結紮">
                    <el-radio-group v-model="form.neutered">
                        <el-radio value="yes">已結紮</el-radio>
                        <el-radio value="no">未結紮</el-radio>
                        <el-radio value="">不確定</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="毛長">
                    <el-radio-group v-model="form.coat_length">
                        <el-radio v-for="len in COAT_LENGTHS" :key="len" :value="len">{{ len }}</el-radio>
                        <el-radio value="">不確定</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="入住日期">
                    <el-date-picker
                        v-model="form.arrived_on"
                        type="date"
                        value-format="YYYY-MM-DD"
                        placeholder="選擇日期"
                        :editable="false"
                    />
                </el-form-item>
                <el-form-item :label="ageText ? `預估生日（${ageText}）` : '預估生日'">
                    <el-date-picker
                        v-model="form.birth_month"
                        type="month"
                        value-format="YYYY-MM-DD"
                        placeholder="選擇年月"
                        :editable="false"
                    />
                </el-form-item>
                <el-form-item label="備註">
                    <el-input v-model="form.notes" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" />
                </el-form-item>
                <el-form-item v-if="editingCat" label="已領養">
                    <el-switch v-model="form.adopted" />
                </el-form-item>
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
import { CAT_SEXES, COAT_COLORS, COAT_LENGTHS, catAgeText } from '~/composables/catTraits';
import Swal from 'sweetalert2';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    cat: { type: Object, default: null },
    nextSortOrder: { type: Number, default: 1 },
});
const emit = defineEmits(['update:modelValue', 'saved', 'deleted']);

const supabase = useSupabaseClient();
const { avatarUrl, uploadAvatar, removeAvatar } = useAvatar();

// 編輯中的那隻。新增成功後也記在這裡：頭像傳失敗再按儲存，是更新這隻而不是又新增一隻
const editingCat = ref(null);
const form = ref(emptyForm());
const savingCat = ref(false);

function emptyForm() {
    return {
        name: '',
        nicknames: [],
        location: '',
        adopted: false,
        coats: [],
        // 單選的「不確定」用空字串（el-radio 不收 null），存的時候轉回 null
        sex: '',
        neutered: '', // 'yes' / 'no' / ''
        coat_length: '',
        arrived_on: null,
        birth_month: null,
        notes: '',
    };
}

function formOf(cat) {
    return {
        name: cat.name,
        nicknames: [...(cat.nicknames || [])],
        location: cat.location || '',
        adopted: cat.adopted,
        coats: [...(cat.coats || [])],
        sex: cat.sex || '',
        neutered: cat.neutered === true ? 'yes' : cat.neutered === false ? 'no' : '',
        coat_length: cat.coat_length || '',
        arrived_on: cat.arrived_on ?? null,
        birth_month: cat.birth_month ?? null,
        notes: cat.notes || '',
    };
}

// 每次打開都照傳進來的那隻（或空白）重新填
watch(
    () => props.modelValue,
    (open) => {
        if (!open) return;
        editingCat.value = props.cat;
        form.value = props.cat ? formOf(props.cat) : emptyForm();
        resetAvatarDraft();
    },
    { immediate: true }
);

// 暱稱：去掉空白、重複，以及跟名稱本身一樣的
function cleanNicknames(name) {
    return [...new Set((form.value.nicknames || []).map((n) => n.trim()).filter((n) => n && n !== name))];
}

function toggleCoat(coat) {
    form.value.coats = form.value.coats.includes(coat)
        ? form.value.coats.filter((c) => c !== coat)
        : [...form.value.coats, coat];
}

// 預估生日 → 大約幾歲（滿 1 歲顯示幾歲幾個月，不滿 1 歲顯示幾個月）
const ageText = computed(() => catAgeText(form.value.birth_month));

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
    const name = form.value.name.trim();
    if (!name) {
        Swal.fire({ text: '請輸入貓咪名稱' });
        return;
    }

    const payload = {
        name,
        nicknames: cleanNicknames(name),
        location: form.value.location || null,
        adopted: form.value.adopted,
        // 花色照清單順序存
        coats: COAT_COLORS.filter((c) => form.value.coats.includes(c)),
        sex: form.value.sex || null,
        neutered: form.value.neutered === '' ? null : form.value.neutered === 'yes',
        coat_length: form.value.coat_length || null,
        arrived_on: form.value.arrived_on || null,
        birth_month: form.value.birth_month || null,
        notes: form.value.notes.trim() || null,
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

// 編輯視窗：頭像列、花色標籤
.avatar-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;

    .avatar {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        overflow: hidden;
        background: #e8e2dc;
        color: #6b625d;
        font-size: 24px;
        font-weight: 500;

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    .avatar-btn {
        width: auto;
        height: 32px;
        padding: 0 14px;
        border: 1px solid #ddd;
        border-radius: 16px;
        background: #fff;
        color: #657181;
        font-size: 13px;
        cursor: pointer;
    }

    .avatar-link {
        width: auto;
        height: auto;
        padding: 0;
        border: none;
        background: none;
        color: #b33a39;
        font-size: 13px;
        cursor: pointer;
    }
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

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
    }
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
