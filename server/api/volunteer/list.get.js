import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'

// 有效志工名單，給 /calendar、/regular、/medicine 的選單用。
export default defineEventHandler(async (event) => {
    await requireUser(event)

    // 撈 profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, is_active')
        .neq('is_active', false)

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

    return profiles
        .map((record) => ({
            recordId: record.id,
            name: record.nickname || emailMap[record.id] || '未命名',
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
});