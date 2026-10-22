<template>
    <ClientOnly>
        <div id="cat-profiles-admin">
            <div class="page-header">
                <h1>貓咪管理</h1>
                <el-button type="primary" @click="openDialog()">
                    ＋ 新增貓咪
                </el-button>
            </div>

            <!-- 貓咪列表 - 拖拉排序。順序也是飲食、醫療、待辦管理與值班記錄表的順序 -->
            <draggable
                v-model="cats"
                item-key="id"
                handle=".drag-handle"
                ghost-class="ghost"
                @end="onDragEnd"
                class="cats-list"
            >
                <template #item="{ element: cat }">
                    <div class="cat-item">
                        <span class="drag-handle">☰</span>
                        <div class="cat-info">
                            <div class="cat-name">
                                <span class="cat-avatar">
                                    <img v-if="cat.avatar_path" :src="avatarUrl(cat.avatar_path)" alt="" />
                                    <template v-else>{{ cat.name.charAt(0) }}</template>
                                </span>
                                {{ cat.name }}
                            </div>
                            <div class="cat-meta">
                                <div class="cat-status">
                                    <span v-if="cat.location"
                                        >📍 {{ cat.location }}</span
                                    >
                                    <span v-if="cat.adopted">🏠 已領養</span>
                                </div>
                                <div class="cat-actions">
                                    <el-button @click="openDialog(cat)">
                                        編輯
                                    </el-button>
                                    <el-button
                                        type="danger"
                                        @click="confirmDelete(cat)"
                                    >
                                        刪除
                                    </el-button>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </draggable>

            <!-- 空狀態 -->
            <div v-if="cats.length === 0" class="empty">尚無貓咪資料</div>

            <!-- 新增/編輯 Dialog -->
            <el-dialog
                v-model="dialogVisible"
                :title="editingCat ? '編輯貓咪' : '新增貓咪'"
                width="90%"
                class="cat-dialog"
                align-center
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
                        <el-input
                            v-model="form.name"
                            placeholder="例如：大哥"
                        />
                    </el-form-item>
                    <el-form-item label="位置">
                        <!-- 不開搜尋：手機點了不會跳出鍵盤 -->
                        <el-select
                            v-model="form.location"
                            placeholder="選擇位置"
                            clearable
                        >
                            <el-option
                                v-for="location in LOCATIONS"
                                :key="location"
                                :label="location"
                                :value="location"
                            />
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
                    <el-form-item label="已領養" v-if="editingCat">
                        <el-switch v-model="form.adopted" />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" :loading="savingCat" @click="saveCat">儲存</el-button>
                </template>
            </el-dialog>

            <NuxtLink to="/admin" class="back-link">← 返回管理後台</NuxtLink>
        </div>
    </ClientOnly>
</template>

<script setup>
// 新版貓咪管理（cat_profiles）。跟舊的 /admin/cats（cats 表）並行，兩邊資料不互通
import draggable from 'vuedraggable';
import { CAT_SEXES, COAT_COLORS, COAT_LENGTHS } from '~/composables/catTraits';
import Swal from 'sweetalert2';

definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '貓咪管理',
});

const supabase = useSupabaseClient();
const { $dayjs } = useNuxtApp();
const { avatarUrl, uploadAvatar, removeAvatar } = useAvatar();

// 狀態
const cats = ref([]);
const dialogVisible = ref(false);
const editingCat = ref(null);
const form = ref(emptyForm());

function emptyForm() {
    return {
        name: '',
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

const savingCat = ref(false);

function toggleCoat(coat) {
    form.value.coats = form.value.coats.includes(coat)
        ? form.value.coats.filter((c) => c !== coat)
        : [...form.value.coats, coat];
}

// 預估生日 → 大約幾歲（滿 1 歲顯示幾歲幾個月，不滿 1 歲顯示幾個月）
const ageText = computed(() => {
    if (!form.value.birth_month) return '';
    const months = $dayjs().diff($dayjs(form.value.birth_month), 'month');
    if (months < 0) return '';
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return years ? `約 ${years} 歲${rest ? ` ${rest} 個月` : ''}` : `約 ${rest} 個月`;
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

// 載入貓咪
async function loadCats() {
    const { data } = await supabase
        .from('cat_profiles')
        .select('*')
        .order('sort_order');

    if (data) {
        cats.value = data;
    }
}

// 拖拉結束後更新排序，只更新有變的
async function onDragEnd() {
    const updates = cats.value
        .map((cat, index) => ({ cat, sort_order: index + 1 }))
        .filter(({ cat, sort_order }) => cat.sort_order !== sort_order)
        .map(({ cat, sort_order }) => {
            cat.sort_order = sort_order;
            return supabase
                .from('cat_profiles')
                .update({ sort_order })
                .eq('id', cat.id);
        });

    await Promise.all(updates);
}

// 開啟 Dialog
function openDialog(cat = null) {
    editingCat.value = cat;
    form.value = cat
        ? {
              name: cat.name,
              location: cat.location || '',
              adopted: cat.adopted,
              coats: [...(cat.coats || [])],
              sex: cat.sex || '',
              neutered: cat.neutered === true ? 'yes' : cat.neutered === false ? 'no' : '',
              coat_length: cat.coat_length || '',
              arrived_on: cat.arrived_on ?? null,
              birth_month: cat.birth_month ?? null,
              notes: cat.notes || '',
          }
        : emptyForm();
    resetAvatarDraft();
    dialogVisible.value = true;
}

// 儲存貓咪
async function saveCat() {
    const name = form.value.name.trim();
    if (!name) {
        Swal.fire({
            text: '請輸入貓咪名稱',
        });
        return;
    }

    const payload = {
        name,
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
    if (editingCat.value) {
        // 編輯
        const { error } = await supabase
            .from('cat_profiles')
            .update(payload)
            .eq('id', editingCat.value.id);

        if (error) {
            Swal.fire({
                text: '更新失敗',
            });
            return;
        }
        if (!(await saveAvatarSafely(editingCat.value.id))) return;
    } else {
        // 新增
        const maxOrder =
            cats.value.length > 0
                ? Math.max(...cats.value.map((c) => c.sort_order || 0))
                : 0;

        const { data: created, error } = await supabase
            .from('cat_profiles')
            .insert({ ...payload, sort_order: maxOrder + 1 })
            .select('id')
            .single();

        if (error) {
            Swal.fire({
                text: '新增失敗',
            });
            return;
        }
        // 之後當成編輯中的這隻：頭像傳失敗時再按儲存，是更新這隻而不是又新增一隻
        editingCat.value = { ...payload, id: created.id, avatar_path: null };
        if (!(await saveAvatarSafely(created.id))) {
            await loadCats();
            return;
        }
    }

    dialogVisible.value = false;
    await loadCats();
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

// 刪除確認。資料庫設了 on delete cascade：這隻貓的飲食、醫療、待辦與留言會一起刪掉
async function confirmDelete(cat) {
    const { isConfirmed } = await Swal.fire({
        html: `確定要刪除「${cat.name}」嗎？<br>牠的飲食、醫療、待辦設定與留言會一起刪除。<br>只是送養了的話，請改用「已領養」。`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });

    if (isConfirmed) {
        const { error } = await supabase
            .from('cat_profiles')
            .delete()
            .eq('id', cat.id);

        if (error) {
            Swal.fire({
                text: '刪除失敗',
            });
            return;
        }

        await loadCats();
    }
}

// 初始化
onMounted(() => {
    loadCats();
});
</script>

<style lang="scss" scoped>
#cat-profiles-admin {
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;

    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }

    :deep(.el-select) {
        width: 100%;
    }
}

// 跟飲食、醫療、待辦管理一致：標題靠左、新增按鈕靠右
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 16px;

    h1 {
        // 全域 h1 有 margin-bottom: 10px !important（element-variables.css），
        // 不蓋掉的話標題會比按鈕高 5px
        margin: 0 !important;
        font-size: 22px;
        text-align: left;
        // 光學補償：Noto Sans TC 22px 中文墨水比行框中心低約 1.7px，
        // 按鈕文字幾乎沒偏，往上提讓兩邊的字對齊（換字體或字級要重算）
        transform: translateY(-1.7px);
    }

    .el-button {
        flex-shrink: 0;
    }
}

.cats-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cat-item {
    display: flex;
    justify-content: flex-start;
    gap: 6px;
    padding: 12px 8px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: box-shadow 0.2s;

    &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
}

.drag-handle {
    cursor: grab;
    color: #999;
    font-size: 16px;
    line-height: 8px;
    height: 20px;
    padding: 4px 6px;
    user-select: none;

    &:hover {
        color: #666;
    }

    &:active {
        cursor: grabbing;
    }
}

.cat-info {
    text-align: left;
    width: 100%;
}

.cat-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    font-size: 14px;
}

// 列表上的小頭像（沒有就顯示名字第一個字）
.cat-avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    background: #e8e2dc;
    color: #6b625d;
    font-size: 13px;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
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

.cat-meta {
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #888;
    margin-top: 12px;
    .cat-status {
        line-height: 32px;
        display: flex;
        gap: 4px;
    }
}

.cat-actions {
    display: flex;
}

.empty {
    text-align: center;
    color: #999;
    padding: 40px 20px;
    background: #f9f9f9;
    border-radius: 8px;
}

.back-link {
    display: inline-block;
    margin-top: 20px;
    color: #657181;
    font-size: 14px;
    text-decoration: none;

    &:hover {
        color: #b33a39;
    }
}

/* 拖拉時的樣式 */
.ghost {
    opacity: 0.5;
    background: #e8f4f8;
    border: 1px dashed #6da2c2;
}

:deep(.el-dialog) {
    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        .el-button {
            width: auto !important;
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

    .el-dialog__footer .el-button {
        flex: 1;
    }
}
</style>
