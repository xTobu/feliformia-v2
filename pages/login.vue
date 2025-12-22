<template>
    <div class="login-container">
        <div class="login-box">
            <h1>吾等與貓毛</h1>
            <p class="subtitle">Feliformia 志工系統</p>

            <template v-if="!showReset">
                <div class="form-group">
                    <input
                        v-model="email"
                        type="email"
                        placeholder="Email"
                        :disabled="loading"
                        @keyup.enter="signIn"
                    />
                </div>

                <div class="form-group">
                    <input
                        v-model="password"
                        type="password"
                        placeholder="密碼"
                        :disabled="loading"
                        @keyup.enter="signIn"
                    />
                </div>

                <button
                    class="login-btn"
                    @click="signIn"
                    :disabled="loading || !email || !password"
                >
                    {{ loading ? '登入中...' : '登入' }}
                </button>

                <p class="forgot-link" @click="showReset = true">忘記密碼？</p>
            </template>

            <template v-else>
                <p class="reset-info">輸入你的 Email，我們會寄送重置連結給你</p>

                <div class="form-group">
                    <input
                        v-model="resetEmail"
                        type="email"
                        placeholder="Email"
                        :disabled="loading"
                        @keyup.enter="sendReset"
                    />
                </div>

                <button
                    class="login-btn"
                    @click="sendReset"
                    :disabled="loading || !resetEmail"
                >
                    {{ loading ? '發送中...' : '發送重置信' }}
                </button>

                <p class="forgot-link" @click="showReset = false">← 返回登入</p>
            </template>

            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="success" class="success">{{ success }}</p>
        </div>
    </div>
</template>

<script setup>
definePageMeta({
    layout: 'blank',
    middleware: 'auth',
});

const route = useRoute();
const supabase = useSupabaseClient();

const email = ref('');
const password = ref('');
const resetEmail = ref('');
const loading = ref(false);
const error = ref(null);
const success = ref(null);
const showReset = ref(false);

// 處理 URL hash 中的錯誤（重置密碼連結過期等）
onMounted(() => {
    const hash = window.location.hash;
    if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');

        if (errorCode === 'otp_expired') {
            error.value = '重置密碼連結已過期，請重新申請';
            showReset.value = true;
        } else if (errorDescription) {
            error.value = decodeURIComponent(
                errorDescription.replace(/\+/g, ' ')
            );
        }
    }
});

const signIn = async () => {
    if (!email.value || !password.value) return;

    loading.value = true;
    error.value = null;

    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
    });

    if (signInError) {
        error.value =
            signInError.message === 'Invalid login credentials'
                ? 'Email 或密碼錯誤'
                : signInError.message;
        loading.value = false;
    } else {
        // 用 window.location 強制跳轉
        window.location.href = '/';
    }
};

const sendReset = async () => {
    if (!resetEmail.value) return;

    loading.value = true;
    error.value = null;
    success.value = null;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail.value,
        { redirectTo: window.location.origin + '/reset-password' }
    );

    if (resetError) {
        error.value = resetError.message;
    } else {
        success.value = '重置信已發送，請檢查你的信箱！';
    }

    loading.value = false;
};
</script>

<style scoped lang="scss">
.login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f5f7f8 0%, #e8ecef 100%);
    padding: 20px;
}

.login-box {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    text-align: center;
    max-width: 400px;
    width: 100%;

    h1 {
        margin: 0 0 8px 0;
        font-size: 28px;
    }
    .subtitle {
        color: #657181;
        margin: 0 0 30px 0;
        font-size: 14px;
    }
}

.reset-info {
    color: #657181;
    font-size: 14px;
    margin-bottom: 20px;
}

.form-group {
    margin-bottom: 16px;

    input {
        width: 100%;
        padding: 14px 16px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 15px;
        box-sizing: border-box;
        &:focus {
            outline: none;
            border-color: #6da2c2;
        }
    }
}

.login-btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 8px;
    background: #6da2c2;
    color: white;
    font-size: 16px;
    cursor: pointer;
    &:hover:not(:disabled) {
        background: #5a8fb0;
    }
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
}

.forgot-link {
    margin-top: 16px;
    color: #6da2c2;
    font-size: 14px;
    cursor: pointer;
    text-decoration: underline;
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
