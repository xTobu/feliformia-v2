export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  const publicPages = ['/login', '/reset-password', '/confirm']

  // 如果是 reset-password 頁面且有 hash（包含 token），允許進入
  if (to.path === '/reset-password') {
    return
  }

  if (!user.value && !publicPages.includes(to.path)) {
    return navigateTo('/login')
  }

  if (user.value && to.path === '/login') {
    return navigateTo('/')
  }
})