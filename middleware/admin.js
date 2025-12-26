export default defineNuxtRouteMiddleware(async (to) => {
    const supabase = useSupabaseClient();

    // 先檢查登入
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return navigateTo('/login');
    }

    // 檢查是否為管理員
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.is_admin) {
        // 不是管理員，導回首頁
        return navigateTo('/');
    }
});