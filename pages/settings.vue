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
    definePageMeta({
      middleware: 'auth',
    })
    
    useHead({
      title: '設定',
    })
    
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    const { loadProfile: reloadProfile } = useProfile()
    
    // 取得 user id
    const getUserId = () => user.value?.id || user.value?.sub
    
    // 名稱
    const nickname = ref('')
    const saving = ref(false)
    const profileSuccess = ref(null)
    const profileError = ref(null)
    
    // 密碼
    const newPassword = ref('')
    const confirmPassword = ref('')
    const updatingPassword = ref(false)
    const passwordSuccess = ref(null)
    const passwordError = ref(null)
    
    const isNicknameValid = computed(() => {
      if (!nickname.value) return false
      const trimmed = nickname.value.replace(/[\s\u3000]/g, '')
      return trimmed.length > 0
    })
    
    const isPasswordValid = computed(() => {
      return newPassword.value.length >= 6 && newPassword.value === confirmPassword.value
    })
    
    // 用 watch 等待 user 載入
    watch(user, async (newUser) => {
      if (newUser) {
        await loadProfile()
      }
    }, { immediate: true })
    
    async function loadProfile() {
      const userId = getUserId()
      if (!userId) return
    
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', userId)
          .single()
    
        if (data) {
          nickname.value = data.nickname || ''
        }
      } catch (err) {
        console.error('載入 profile 失敗:', err)
      }
    }
    
    async function saveProfile() {
      if (!isNicknameValid.value) {
        profileError.value = '請輸入名稱'
        return
      }
    
      const userId = getUserId()
      if (!userId) {
        profileError.value = '請先登入'
        return
      }
    
      saving.value = true
      profileSuccess.value = null
      profileError.value = null
    
      try {
        const cleanNickname = nickname.value.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
    
        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          nickname: cleanNickname,
          updated_at: new Date().toISOString(),
        })
    
        if (error) {
          profileError.value = error.message
        } else {
          profileSuccess.value = '名稱已儲存！'
          await reloadProfile()
        }
      } catch (err) {
        profileError.value = '儲存失敗，請稍後再試'
        console.error(err)
      } finally {
        saving.value = false
      }
    }
    
    async function updatePassword() {
      if (!isPasswordValid.value) {
        if (newPassword.value.length < 6) {
          passwordError.value = '密碼至少需要 6 個字元'
        } else {
          passwordError.value = '兩次輸入的密碼不一致'
        }
        return
      }
    
      updatingPassword.value = true
      passwordSuccess.value = null
      passwordError.value = null
    
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword.value,
        })
    
        if (error) {
          passwordError.value = error.message
        } else {
          passwordSuccess.value = '密碼已更新成功！'
          newPassword.value = ''
          confirmPassword.value = ''
        }
      } catch (err) {
        passwordError.value = '更新失敗，請稍後再試'
        console.error(err)
      } finally {
        updatingPassword.value = false
      }
    }
    </script>

<style scoped lang="scss">
.settings-page {
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
}

h1 {
    margin-bottom: 30px;
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
