import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

// 全體志工的暱稱對照表，/calendar 與 /vote 都用它把 user_id 轉成名字。
// 志工名單與 email 不是公開資料，一定要先確認登入身分。
export default defineEventHandler(async (event) => {
    await requireUser(event)

    // 撈 profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, is_active, line_user_id')

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
        id: p.id,
        nickname: p.nickname,
        email: emailMap[p.id] || null,
        is_active: p.is_active,
        // 只回有沒有綁定，不把 LINE userId 送到前端
        hasLine: !!p.line_user_id,
    }))
})