import { serverSupabaseUser } from '#supabase/server'
import { supabase } from '~/server/utils/supabase'

// 取得目前登入者的 id，未登入就丟 401。
// 注意：這版 @nuxtjs/supabase 的 serverSupabaseUser 回傳的是 JWT claims
//（內部走 auth.getClaims()），所以 user id 要取 user.sub 不是 user.id。
export async function requireUser(event) {
    const user = await serverSupabaseUser(event)

    if (!user) {
        throw createError({ statusCode: 401, message: '請先登入' })
    }

    return user.sub
}

// 確認是管理員，不是就丟 403。
// 一定要在 server 端查 profiles.is_admin —— 前端的 isAdmin 只是拿來
// 決定按鈕要不要顯示，改個 JS 變數就繞過去了。
export async function requireAdmin(event) {
    const userId = await requireUser(event)

    const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    if (!data?.is_admin) {
        throw createError({ statusCode: 403, message: '只有管理員可以執行這個操作' })
    }

    return userId
}
