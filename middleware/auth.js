export default defineNuxtRouteMiddleware(async (to) => {
    const user = useSupabaseUser();
    const publicPages = ['/login', '/reset-password', '/confirm'];

    // reset-password 的 token 在 URL hash 裡，一律放行
    if (to.path === '/reset-password') {
        return;
    }

    if (!user.value) {
        if (publicPages.includes(to.path)) return;
        return navigateTo('/login');
    }

    // 已登入，但帳號可能被停用了。
    // 停用的人後端每支 API 都會回 403，讓他進得了頁面只會看到一連串錯誤。
    const { ensureActive } = useProfile();
    const redirect = await ensureActive();

    if (redirect) {
        // 已經在 /login 就別再導一次，否則會跳同一個路由
        return to.path === '/login' ? undefined : navigateTo(redirect);
    }

    if (to.path === '/login') {
        return navigateTo('/');
    }
});
