<template>
    <div class="confirm-container">
        <div class="confirm-box">
            <h1>{{ message }}</h1>
            <p v-if="error" class="error">{{ error }}</p>
        </div>
    </div>
</template>

<script setup>
definePageMeta({
    layout: 'blank',
});

const supabase = useSupabaseClient();
const message = ref('驗證中...');
const error = ref(null);

onMounted(async () => {
    const hash = window.location.hash;

    if (!hash) {
        message.value = '無效的連結';
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
        return;
    }

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');

    // 處理錯誤
    if (errorCode) {
        if (errorCode === 'otp_expired') {
            error.value = '連結已過期，請重新申請';
        } else {
            error.value = decodeURIComponent(
                errorDescription?.replace(/\+/g, ' ') || '驗證失敗'
            );
        }
        message.value = '驗證失敗';
        setTimeout(() => {
            window.location.href = '/login';
        }, 3000);
        return;
    }

    // 處理密碼重置
    if (type === 'recovery' && accessToken) {
        try {
            const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (sessionError) {
                throw sessionError;
            }

            message.value = '驗證成功，正在跳轉...';
            window.location.href = '/reset-password';
        } catch (e) {
            error.value = e.message || '驗證失敗';
            message.value = '驗證失敗';
            setTimeout(() => {
                window.location.href = '/login';
            }, 3000);
        }
        return;
    }

    // 其他類型（如 signup confirmation）
    if (accessToken) {
        try {
            await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });
            message.value = '驗證成功！';
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } catch (e) {
            error.value = '驗證失敗';
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        }
    }
});
</script>

<style scoped lang="scss">
.confirm-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f5f7f8 0%, #e8ecef 100%);
}

.confirm-box {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    text-align: center;

    h1 {
        margin: 0;
        font-size: 20px;
        color: #333;
    }
}

.error {
    margin-top: 16px;
    color: #b33a39;
    font-size: 14px;
}
</style>
