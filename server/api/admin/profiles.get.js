import { supabase } from '~/server/utils/supabase'

export default defineEventHandler(async () => {
    // 撈 profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, is_admin, is_active, created_at')
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