<template>
    <ClientOnly>
        <div id="profiles-admin">
            <h1>志工一覽</h1>

            <!-- 統計 -->
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">{{ profiles.length }}</div>
                    <div class="stat-label">志工總數</div>
                </div>
            </div>

            <!-- 搜尋 -->
            <div class="search-box">
                <el-input
                    v-model="searchQuery"
                    placeholder="搜尋名稱或 Email"
                    clearable
                    :prefix-icon="Search"
                />
            </div>

            <!-- 志工列表 -->
            <div class="profiles-list">
                <div
                    v-for="profile in filteredProfiles"
                    :key="profile.id"
                    class="profile-item"
                >
                    <div class="profile-info">
                        <div class="profile-name">
                            {{ profile.nickname || '（未設定名稱）' }}
                        </div>
                        <div class="profile-email">
                            {{ profile.email || '（無 Email）' }}
                        </div>
                    </div>
                    <div class="profile-meta">
                        <el-tag
                            v-if="profile.is_admin"
                            type="danger"
                            size="small"
                        >
                            管理員
                        </el-tag>
                    </div>
                    <div class="profile-actions">
                        <el-button size="small" @click="openDialog(profile)">
                            編輯
                        </el-button>
                    </div>
                </div>
            </div>

            <!-- 空狀態 -->
            <div v-if="filteredProfiles.length === 0" class="empty">
                {{ searchQuery ? '找不到符合的志工' : '尚無志工資料' }}
            </div>

            <!-- 編輯 Dialog -->
            <el-dialog v-model="dialogVisible" title="編輯志工" width="300px">
                <el-form :model="form" label-width="80px" @submit.prevent>
                    <el-form-item label="Email">
                        <el-input :value="form.email" disabled />
                    </el-form-item>
                    <el-form-item label="名稱">
                        <el-input
                            v-model="form.nickname"
                            placeholder="輸入志工名稱"
                        />
                    </el-form-item>
                    <el-form-item label="管理員">
                        <el-switch v-model="form.is_admin" />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="saveProfile"
                        >儲存</el-button
                    >
                </template>
            </el-dialog>

            <NuxtLink to="/admin" class="back-link">← 返回管理後台</NuxtLink>
        </div>
    </ClientOnly>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue';
import Swal from 'sweetalert2';

definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '志工一覽',
});

const supabase = useSupabaseClient();

// 狀態
const profiles = ref([]);
const searchQuery = ref('');
const dialogVisible = ref(false);
const editingProfile = ref(null);
const form = ref({
    email: '',
    nickname: '',
    is_admin: false,
});

// 過濾後的志工列表
const filteredProfiles = computed(() => {
    if (!searchQuery.value.trim()) {
        return profiles.value;
    }
    const query = searchQuery.value.toLowerCase();
    return profiles.value.filter(
        (p) =>
            (p.nickname && p.nickname.toLowerCase().includes(query)) ||
            (p.email && p.email.toLowerCase().includes(query))
    );
});

// 載入志工
async function loadProfiles() {
    const { data } = await supabase
        .from('profiles')
        .select('id, nickname, email, is_admin, created_at')
        .order('created_at', { ascending: false });

    if (data) {
        profiles.value = data;
    }
}

// 開啟 Dialog
function openDialog(profile) {
    editingProfile.value = profile;
    form.value = {
        email: profile.email,
        nickname: profile.nickname || '',
        is_admin: profile.is_admin || false,
    };
    dialogVisible.value = true;
}

// 儲存
async function saveProfile() {
    const { error } = await supabase
        .from('profiles')
        .update({
            nickname: form.value.nickname || null,
            is_admin: form.value.is_admin,
            updated_at: new Date().toISOString(),
        })
        .eq('id', editingProfile.value.id);

    if (error) {
        Swal.fire({
            text: '更新失敗',
            confirmButtonColor: '#b33a39',
        });
        return;
    }

    dialogVisible.value = false;
    await loadProfiles();
}

// 初始化
onMounted(() => {
    loadProfiles();
});
</script>

<style lang="scss" scoped>
#profiles-admin {
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;

    :deep(.el-button) {
        width: auto !important;
        -webkit-appearance: button !important;
    }
}

.stats {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
}

.stat-card {
    flex: 1;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
}

.stat-number {
    font-size: 32px;
    font-weight: 600;
    color: #b33a39;
}

.stat-label {
    font-size: 14px;
    color: #888;
    margin-top: 4px;
}

.search-box {
    margin-bottom: 16px;
}

.profiles-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.profile-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: box-shadow 0.2s;

    &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
}

.profile-info {
    flex: 1;
    text-align: left;
}

.profile-name {
    font-weight: 500;
    color: #333;
}

.profile-email {
    font-size: 12px;
    color: #888;
    margin-top: 2px;
}

.profile-meta {
    display: flex;
    gap: 4px;
}

.profile-actions {
    display: flex;
    gap: 4px;
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

:deep(.el-dialog) {
    .el-dialog__footer {
        display: flex;
        justify-content: flex-end;

        .el-button {
            width: auto !important;
        }
    }
}
</style>
