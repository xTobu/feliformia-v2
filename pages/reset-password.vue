<template>
    <div class="reset-container">
        <div class="reset-box">
            <h1>設定新密碼</h1>

            <div class="form-group">
                <input
                    v-model="password"
                    type="password"
                    placeholder="新密碼（至少 6 碼）"
                    :disabled="loading"
                />
            </div>

            <div class="form-group">
                <input
                    v-model="confirmPassword"
                    type="password"
                    placeholder="確認新密碼"
                    :disabled="loading"
                    @keyup.enter="updatePassword"
                />
                <p
                    v-if="confirmPassword && password !== confirmPassword"
                    class="warning"
                >
                    兩次輸入的密碼不一致
                </p>
            </div>

            <button
                class="btn"
                @click="updatePassword"
                :disabled="loading || !isValid"
            >
                {{ loading ? '更新中...' : '更新密碼' }}
            </button>

            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="success" class="success">{{ success }}</p>
        </div>
    </div>
</template>

<script setup>
definePageMeta({
    layout: 'blank',
});

useHead({
    title: '重設密碼',
});

const supabase = useSupabaseClient();

const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref(null);
const success = ref(null);

const isValid = computed(() => {
    return (
        password.value.length >= 6 && password.value === confirmPassword.value
    );
});

// 檢查是否有 session
onMounted(async () => {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = '/login';
    }
});

async function updatePassword() {
    if (!isValid.value) {
        if (password.value.length < 6) {
            error.value = '密碼至少需要 6 個字元';
        } else {
            error.value = '兩次輸入的密碼不一致';
        }
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        const { error: updateError } = await supabase.auth.updateUser({
            password: password.value,
        });

        if (updateError) {
            error.value = updateError.message;
        } else {
            success.value = '密碼已更新！3 秒後跳轉到登入頁...';
            await supabase.auth.signOut();
            setTimeout(() => {
                window.location.href = '/login';
            }, 3000);
        }
    } catch (err) {
        error.value = '更新失敗，請稍後再試';
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped lang="scss">
.reset-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f5f7f8 0%, #e8ecef 100%);
    padding: 20px;
}

.reset-box {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    text-align: center;
    max-width: 400px;
    width: 100%;

    h1 {
        margin: 0 0 30px 0;
        font-size: 24px;
    }
}

.form-group {
    margin-bottom: 16px;

    input {
        width: 100%;
        padding: 14px 16px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 15px;

        &:focus {
            outline: none;
            border-color: #6da2c2;
        }
    }

    .warning {
        margin: 8px 0 0 0;
        color: #e67e22;
        font-size: 13px;
        text-align: left;
    }
}

.btn {
    width: 100%;
    padding: 14px;
    line-height: 1.5;
    font-size: 16px;
}

.error {
    margin-top: 16px;
    color: #b33a39;
    font-size: 14px;
}

.success {
    margin-top: 16px;
    color: #34a853;
    font-size: 14px;
}
</style>
