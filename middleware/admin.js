export default defineNuxtRouteMiddleware(async (to) => {
    const supabase = useSupabaseClient();
    const user = useSupabaseUser();

    // 先檢查登入
    if (!user.value) {
        return navigateTo('/login');
    }

    // 檢查 useProfile 是否已載入
    const profileLoaded = useState('profileLoaded');
    const isAdmin = useState('isAdmin');

    if (profileLoaded.value) {
        // 已載入，直接用 isAdmin
        if (!isAdmin.value) {
            return navigateTo('/');
        }
        return;
    }

    // 尚未載入，查資料庫
    const userId = user.value?.id || user.value?.sub;
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

    if (!profile?.is_admin) {
        return navigateTo('/');
    }
});