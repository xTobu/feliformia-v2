<template>
    <div class="login-container">
        <div class="login-box">
            <h1>吾等與貓毛</h1>
            <p class="subtitle">Feliformia 志工系統</p>

            <!-- 登入表單 -->
            <template v-if="mode === 'login'">
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

                <p class="link" @click="mode = 'reset'">忘記密碼？</p>
                <p class="link" @click="mode = 'register'">註冊</p>
            </template>

            <!-- 註冊表單 -->
            <template v-else-if="mode === 'register'">
                <p class="info">請輸入資料進行註冊</p>

                <div class="form-group">
                    <input
                        v-model="registerName"
                        type="text"
                        placeholder="姓名 / 暱稱"
                        :disabled="loading"
                    />
                </div>

                <div class="form-group">
                    <input
                        v-model="registerEmail"
                        type="email"
                        placeholder="Email"
                        :disabled="loading"
                    />
                </div>

                <div class="form-group">
                    <input
                        v-model="registerPassword"
                        type="password"
                        placeholder="密碼（至少 6 碼）"
                        :disabled="loading"
                    />
                </div>

                <div class="form-group">
                    <input
                        v-model="registerConfirmPassword"
                        type="password"
                        placeholder="確認密碼"
                        :disabled="loading"
                    />
                    <p
                        v-if="
                            registerConfirmPassword &&
                            registerPassword !== registerConfirmPassword
                        "
                        class="warning"
                    >
                        兩次輸入的密碼不一致
                    </p>
                </div>

                <div class="form-group question">
                    <label>我們貓屋在哪裡？</label>
                    <input
                        v-model="securityAnswer"
                        type="text"
                        placeholder="請輸入答案"
                        :disabled="loading"
                        @keyup.enter="signUp"
                    />
                </div>

                <button
                    class="login-btn"
                    @click="signUp"
                    :disabled="loading || !canRegister"
                >
                    {{ loading ? '註冊中...' : '註冊' }}
                </button>

                <p class="link" @click="mode = 'login'">← 返回登入</p>
            </template>

            <!-- 重置密碼表單 -->
            <template v-else-if="mode === 'reset'">
                <p class="info">輸入你的 Email，我們會寄送重置連結給你</p>

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

                <p class="link" @click="mode = 'login'">← 返回登入</p>
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

useHead({
    title: '登入',
});

const supabase = useSupabaseClient();

// 模式：login, register, reset
const mode = ref('login');

// 登入
const email = ref('');
const password = ref('');

// 註冊
const registerName = ref('');
const registerEmail = ref('');
const registerPassword = ref('');
const registerConfirmPassword = ref('');
const securityAnswer = ref('');

// 重置密碼
const resetEmail = ref('');

// 狀態
const loading = ref(false);
const error = ref(null);
const success = ref(null);

// 是否可以註冊
const canRegister = computed(() => {
    return (
        registerName.value.trim() &&
        registerEmail.value &&
        registerPassword.value.length >= 6 &&
        registerPassword.value === registerConfirmPassword.value &&
        securityAnswer.value.trim()
    );
});

// 處理 URL hash 中的錯誤
onMounted(() => {
    const hash = window.location.hash;
    if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');

        if (errorCode === 'otp_expired') {
            error.value = '重置密碼連結已過期，請重新申請';
            mode.value = 'reset';
        } else if (errorDescription) {
            error.value = decodeURIComponent(
                errorDescription.replace(/\+/g, ' ')
            );
        }
    }
});

// 切換模式時清除錯誤和成功訊息
watch(mode, () => {
    error.value = null;
    success.value = null;
});

// 登入
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
        window.location.href = '/';
    }
};

// 註冊
const signUp = async () => {
    if (!canRegister.value) return;

    loading.value = true;
    error.value = null;
    success.value = null;

    try {
        // 先驗證問題答案
        await $fetch('/api/auth/verify-answer', {
            method: 'POST',
            body: { answer: securityAnswer.value.trim() },
        });

        // 答案正確，進行註冊
        const { data, error: signUpError } = await supabase.auth.signUp({
            email: registerEmail.value,
            password: registerPassword.value,
            options: {
                data: {
                    nickname: registerName.value.trim(),
                },
            },
        });

        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                error.value = '此 Email 已經註冊過了';
            } else {
                error.value = signUpError.message;
            }
            return;
        }

        // 如果用戶已建立，更新 profiles
        if (data.user) {
            await supabase
                .from('profiles')
                .upsert({
                    id: data.user.id,
                    nickname: registerName.value.trim(),
                })
                .select();
        }

        success.value = '註冊成功！';
        
        // 清空表單
        registerName.value = '';
        registerEmail.value = '';
        registerPassword.value = '';
        registerConfirmPassword.value = '';
        securityAnswer.value = '';
    } catch (err) {
        error.value = err.data?.message || '驗證失敗';
    } finally {
        loading.value = false;
    }
};

// 重置密碼
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

    .subtitle {
        color: #657181;
        margin: 0 0 30px 0;
        font-size: 14px;
    }
}

.info {
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

    .warning {
        margin: 8px 0 0 0;
        color: #e67e22;
        font-size: 13px;
        text-align: left;
    }

    &.question {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
        text-align: left;

        label {
            display: block;
            font-size: 14px;
            color: #333;
            margin-bottom: 10px;
            font-weight: 500;
        }

        input {
            margin-top: 0;
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

.link {
    margin-top: 12px;
    color: #6da2c2;
    font-size: 14px;
    cursor: pointer;
    text-decoration: underline;

    &:first-of-type {
        margin-top: 16px;
    }
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
