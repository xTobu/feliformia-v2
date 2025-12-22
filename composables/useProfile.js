export const useProfile = () => {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()

    const nickname = useState('nickname', () => null)
    const profileLoaded = useState('profileLoaded', () => false)

    // 取得 user id（相容不同版本）
    const getUserId = () => user.value?.id || user.value?.sub

    const displayName = computed(() => {
        if (!profileLoaded.value) return '...'
        return nickname.value || user.value?.email || '使用者'
    })

    const loadProfile = async () => {
        const userId = getUserId()
        if (!userId) return

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('nickname')
                .eq('id', userId)
                .single()

            if (!error && data) {
                nickname.value = data.nickname
            }
        } catch (err) {
            console.warn('loadProfile failed:', err)
        } finally {
            profileLoaded.value = true
        }
    }

    // 自動監聽 user 變化並載入 profile
    watch(user, async (newUser) => {
        if (newUser && !profileLoaded.value) {
            await loadProfile()
        }
    }, { immediate: true })

    return { nickname, profileLoaded, displayName, loadProfile, getUserId }
}