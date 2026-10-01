export const useProfile = () => {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()

    const nickname = useState('nickname', () => null)
    const profileLoaded = useState('profileLoaded', () => false)
    const isAdmin = useState('isAdmin', () => false)
    // 預設 true：查不到或查詢失敗時放行，跟 server 端的 requireUser() 一致。
    // 這裡 fail-open 是刻意的 —— 一次查詢打嗝就把全體志工鎖在門外太危險。
    const isActive = useState('isActive', () => true)

    // 取得 user id（相容不同版本）
    const getUserId = () => user.value?.id || user.value?.sub

    const displayName = computed(() => {
        if (!profileLoaded.value) return '...'
        return nickname.value || user.value?.email || '使用者'
    })

    const loadProfile = async (force = false) => {
        // 如果已載入且非強制，跳過
        if (profileLoaded.value && !force) return

        const userId = getUserId()
        if (!userId) return

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('nickname, is_admin, is_active')
                .eq('id', userId)
                .single()

            if (!error && data) {
                nickname.value = data.nickname
                isAdmin.value = data.is_admin || false
                // 只有明確被標成 false 才算停用
                isActive.value = data.is_active !== false
            }
        } catch (err) {
            console.warn('loadProfile failed:', err)
        } finally {
            profileLoaded.value = true
        }
    }

    // 清除狀態（登出時用）
    const clearProfile = () => {
        nickname.value = null
        isAdmin.value = false
        isActive.value = true
        profileLoaded.value = false
    }

    // 帳號被停用的話，回傳該把人導去哪裡；正常就回 null。
    // 後端每支 API 都會擋停用的帳號（server/utils/auth.js），讓他留在頁面上
    // 只會看到一連串 403，不如直接擋在門口並說明原因。
    const ensureActive = async () => {
        if (!profileLoaded.value) await loadProfile()
        if (isActive.value !== false) return null

        // 一定要登出。不然 auth 中介層的「已登入就別待在 /login」那條規則
        // 會把他彈回首頁，然後又被擋下來，無限迴圈。
        if (import.meta.client) await supabase.auth.signOut()

        return '/login?inactive=1'
    }

    return {
        nickname,
        profileLoaded,
        isAdmin,
        isActive,
        displayName,
        loadProfile,
        clearProfile,
        ensureActive,
        getUserId,
    }
}