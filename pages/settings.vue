<template>
    <div class="settings-page">
        <h1>設定</h1>

        <!-- 名稱設定 -->
        <section class="settings-section">
            <h2>個人資料</h2>
            <div class="form-group">
                <label>名稱</label>
                <input
                    v-model="nickname"
                    type="text"
                    placeholder="請輸入要顯示的名稱"
                    :disabled="saving"
                />
            </div>
            <button
                class="btn save-btn"
                @click="saveProfile"
                :disabled="saving || !isNicknameValid"
            >
                {{ saving ? '儲存中...' : '儲存名稱' }}
            </button>
            <p v-if="profileSuccess" class="success">{{ profileSuccess }}</p>
            <p v-if="profileError" class="error">{{ profileError }}</p>
        </section>

        <!-- LINE 提醒 -->
        <section class="settings-section">
            <h2>LINE 提醒</h2>

            <div v-if="lineLoading" class="hint">讀取中...</div>

            <template v-else-if="lineBound">
                <p class="line-status bound">✅ 已綁定 LINE</p>
                <p class="hint">
                    有你負責的活動時，<br>「大哥」會在當天早上私訊提醒你。
                </p>
                <button
                    class="btn unbind-btn"
                    @click="unbindLine"
                    :disabled="unbinding"
                >
                    {{ unbinding ? '解除中...' : '解除綁定' }}
                </button>
            </template>

            <template v-else>
                <p class="line-status">尚未綁定</p>
                <p class="hint">
                    綁定後，有你負責的活動時「大哥」會私訊提醒你。
                </p>

                <a
                    class="line-add"
                    :href="LINE_ADD_FRIEND_URL"
                    target="_blank"
                    rel="noopener"
                >
                    加「大哥」為好友
                </a>

                <p class="line-step">加好友後，私訊他這句話：</p>

                <!-- 手機打這串很麻煩，點一下直接複製 -->
                <button type="button" class="line-copy" @click="copyBindCommand">
                    <code>{{ bindCommand }}</code>
                    <el-icon
                        class="lc-action"
                        :class="{ done: copied }"
                        :title="copied ? '已複製' : '複製'"
                    >
                        <Check v-if="copied" />
                        <CopyDocument v-else />
                    </el-icon>
                </button>

                <p class="hint">信箱要跟你登入這個網站用的一樣。</p>
            </template>

            <p v-if="lineSuccess" class="success">{{ lineSuccess }}</p>
            <p v-if="lineError" class="error">{{ lineError }}</p>
        </section>

        <!-- 修改密碼 -->
        <section class="settings-section">
            <h2>修改密碼</h2>
            <div class="form-group">
                <label>新密碼</label>
                <input
                    v-model="newPassword"
                    type="password"
                    placeholder="輸入新密碼（至少 6 碼）"
                    :disabled="updatingPassword"
                />
            </div>
            <div class="form-group">
                <label>確認新密碼</label>
                <input
                    v-model="confirmPassword"
                    type="password"
                    placeholder="再次輸入新密碼"
                    :disabled="updatingPassword"
                />
            </div>
            <button
                class="btn save-btn"
                @click="updatePassword"
                :disabled="updatingPassword || !isPasswordValid"
            >
                {{ updatingPassword ? '更新中...' : '更新密碼' }}
            </button>
            <p v-if="passwordSuccess" class="success">{{ passwordSuccess }}</p>
            <p v-if="passwordError" class="error">{{ passwordError }}</p>
        </section>

        <NuxtLink to="/" class="back-link">← 返回首頁</NuxtLink>
    </div>
</template>

<script setup>
import { CopyDocument, Check } from '@element-plus/icons-vue';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '設定',
});

const supabase = useSupabaseClient();
const {
    nickname: globalNickname,
    loadProfile: reloadProfile,
    getUserId,
} = useProfile();

// 名稱（本地編輯用）
const nickname = ref('');
const saving = ref(false);
const profileSuccess = ref(null);
const profileError = ref(null);

// LINE 綁定
// 加好友短連結。LINE Official Account Manager →
// 增加好友人數 → 加入好友指南 可以重新取得
const LINE_ADD_FRIEND_URL = 'https://lin.ee/8pI3YeW';

const lineLoading = ref(true);
const lineBound = ref(false);
const unbinding = ref(false);
const lineSuccess = ref(null);
const lineError = ref(null);
const user = useSupabaseUser();
const userEmail = computed(() => user.value?.email || '');
const bindCommand = computed(() => `我要綁定 ${userEmail.value || '你的信箱'}`);
const copied = ref(false);

// 密碼
const newPassword = ref('');
const confirmPassword = ref('');
const updatingPassword = ref(false);
const passwordSuccess = ref(null);
const passwordError = ref(null);

const isNicknameValid = computed(() => {
    if (!nickname.value) return false;
    const trimmed = nickname.value.replace(/[\s\u3000]/g, '');
    return trimmed.length > 0;
});

const isPasswordValid = computed(() => {
    return (
        newPassword.value.length >= 6 &&
        newPassword.value === confirmPassword.value
    );
});

// 用全局 nickname 初始化本地值
watch(
    globalNickname,
    (val) => {
        if (val && !nickname.value) {
            nickname.value = val;
        }
    },
    { immediate: true }
);

async function copyBindCommand() {
    try {
        await navigator.clipboard.writeText(bindCommand.value);
        copied.value = true;
        // 給個短暫的回饋就好，不用跳 dialog 打斷操作
        setTimeout(() => (copied.value = false), 2000);
    } catch {
        // 舊瀏覽器或非 https 會沒有 clipboard API，讓使用者自己選取
        lineError.value = '複製失敗，請手動選取文字';
    }
}

async function loadLineStatus() {
    lineLoading.value = true;

    try {
        const userId = getUserId();
        if (!userId) return;

        const { data } = await supabase
            .from('profiles')
            .select('line_user_id')
            .eq('id', userId)
            .maybeSingle();

        lineBound.value = !!data?.line_user_id;
    } catch (error) {
        console.error('讀取 LINE 綁定狀態失敗:', error);
    } finally {
        lineLoading.value = false;
    }
}

async function unbindLine() {
    unbinding.value = true;
    lineSuccess.value = null;
    lineError.value = null;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ line_user_id: null, updated_at: new Date().toISOString() })
            .eq('id', getUserId());

        if (error) throw error;

        lineBound.value = false;
        lineSuccess.value = '已解除綁定';
    } catch (error) {
        console.error('解除綁定失敗:', error);
        lineError.value = '解除失敗，請稍後再試';
    } finally {
        unbinding.value = false;
    }
}

onMounted(loadLineStatus);

async function saveProfile() {
    if (!isNicknameValid.value) {
        profileError.value = '請輸入名稱';
        return;
    }

    const userId = getUserId();
    if (!userId) {
        profileError.value = '請先登入';
        return;
    }

    saving.value = true;
    profileSuccess.value = null;
    profileError.value = null;

    try {
        const cleanNickname = nickname.value.replace(
            /^[\s\u3000]+|[\s\u3000]+$/g,
            ''
        );

        // 檢查是否有其他人使用相同名稱
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('nickname', cleanNickname)
            .neq('id', userId)
            .limit(1);

        if (existing && existing.length > 0) {
            profileError.value = '此名稱已被使用';
            saving.value = false;
            return;
        }

        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            nickname: cleanNickname,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            profileError.value = error.message;
        } else {
            profileSuccess.value = '名稱已儲存！';
            await reloadProfile(true); // 強制重新載入全局狀態
        }
    } catch (err) {
        profileError.value = '儲存失敗，請稍後再試';
        console.error(err);
    } finally {
        saving.value = false;
    }
}

async function updatePassword() {
    if (!isPasswordValid.value) {
        if (newPassword.value.length < 6) {
            passwordError.value = '密碼至少需要 6 個字元';
        } else {
            passwordError.value = '兩次輸入的密碼不一致';
        }
        return;
    }

    updatingPassword.value = true;
    passwordSuccess.value = null;
    passwordError.value = null;

    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword.value,
        });

        if (error) {
            passwordError.value = error.message;
        } else {
            passwordSuccess.value = '密碼已更新成功！';
            newPassword.value = '';
            confirmPassword.value = '';
        }
    } catch (err) {
        passwordError.value = '更新失敗，請稍後再試';
        console.error(err);
    } finally {
        updatingPassword.value = false;
    }
}
</script>

<style scoped lang="scss">
// 說明文字，比內文小一級的灰字
.hint {
    margin: 0 0 12px;
    color: #909399;
    font-size: 13px;
    line-height: 1.7;
}

.line-status {
    margin: 0 0 8px;
    font-weight: 500;

    &.bound {
        color: #67c23a;
    }
}

// LINE 的品牌綠。手機上點了會直接開 LINE app
// LINE 的品牌綠。手機上點了會直接開 LINE app
.line-add {
    display: block;
    width: 100%;
    margin-bottom: 16px;
    padding: 10px;
    border-radius: 4px;
    background: #06c755;
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    text-align: center;
    text-decoration: none;

    &:hover {
        opacity: 0.85;
    }
}

.line-step {
    margin: 0 0 6px;
    color: #606266;
    font-size: 13px;
    text-align: left;
}

// 要私訊的整句話。點一下複製，手機不用自己打
.line-copy {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    background: #fafafa;
    text-align: left;
    cursor: pointer;

    &:hover {
        border-color: #06c755;
    }

    code {
        flex: 1;
        min-width: 0;
        color: #303133;
        font-size: 13px;
        line-height: 1.6;
        // 信箱可能很長，讓它斷行不要撐破版面
        word-break: break-all;
    }

    .lc-action {
        flex-shrink: 0;
        color: #909399;
        font-size: 16px;

        // 複製成功後轉成 LINE 綠的打勾
        &.done {
            color: #06c755;
        }
    }
}

.unbind-btn {
    background: #fff;
    border: 1px solid #dcdfe6;
    color: #606266;
}

.settings-page {
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
}

.settings-section {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;

    h2 {
        font-size: 16px;
        font-weight: 500;
        color: #657181;
        margin: 0 0 16px 0;
    }
}

.form-group {
    margin-bottom: 16px;
    text-align: left;

    label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        color: #657181;
    }

    input {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 15px;

        &:focus {
            outline: none;
            border-color: #6da2c2;
        }
    }
}

.save-btn {
    width: 100%;
    padding: 12px;
    line-height: 1.5;
    font-size: 15px;
}

.error {
    color: #b33a39;
    font-size: 14px;
    margin-top: 12px;
}

.success {
    color: #34a853;
    font-size: 14px;
    margin-top: 12px;
}

.back-link {
    display: inline-block;
    margin-top: 10px;
    color: #657181;
    font-size: 14px;
}
</style>
