export const useProfile = () => {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()

    const nickname = useState('nickname', () => null)
    const profileLoaded = useState('profileLoaded', () => false)
    const isAdmin = useState('isAdmin', () => false)

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
                .select('nickname, is_admin')
                .eq('id', userId)
                .single()

            if (!error && data) {
                nickname.value = data.nickname
                isAdmin.value = data.is_admin || false
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
        profileLoaded.value = false
    }

    return { nickname, profileLoaded, isAdmin, displayName, loadProfile, clearProfile, getUserId }
}