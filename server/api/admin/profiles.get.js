import { supabase } from '~/server/utils/supabase'
import { requireAdmin } from '~/server/utils/auth'

// 志工一覽的完整資料（含 is_admin、email、LINE 綁定狀態）。
// 頁面有 admin 中介層，但那只是前端路由保護，API 自己也要擋。
export default defineEventHandler(async (event) => {
    await requireAdmin(event)

    // 撈 profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, is_admin, is_active, created_at, line_user_id')
        .order('created_at', { ascending: false })

    if (profilesError) {
        throw createError({ statusCode: 500, message: profilesError.message })
    }

    // 從 auth.users 撈 email
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
        throw createError({ statusCode: 500, message: authError.message })
    }

    // 建立 email 對照表
    const emailMap = Object.fromEntries(
        authData.users.map((u) => [u.id, u.email])
    )

    // 合併資料
    return profiles.map((p) => ({
        ...p,
        email: emailMap[p.id] || null,
    }))
})