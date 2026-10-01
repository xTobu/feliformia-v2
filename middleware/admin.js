export default defineNuxtRouteMiddleware(async () => {
    const user = useSupabaseUser();

    // 先檢查登入
    if (!user.value) {
        return navigateTo('/login');
    }

    // 管理頁面不掛 auth 中介層，停用檢查這裡要自己做一次
    const { isAdmin, ensureActive } = useProfile();
    const redirect = await ensureActive();

    if (redirect) {
        return navigateTo(redirect);
    }

    if (!isAdmin.value) {
        return navigateTo('/');
    }
});
