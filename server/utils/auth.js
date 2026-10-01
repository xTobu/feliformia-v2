import { serverSupabaseUser } from '#supabase/server'
import { supabase } from '~/server/utils/supabase'

// 驗身分 + 撈 profiles。requireUser 與 requireAdmin 共用這一段，
// 所以不管呼叫哪個，profiles 都只查一次。
//
// 注意：這版 @nuxtjs/supabase 的 serverSupabaseUser 回傳的是 JWT claims
//（內部走 auth.getClaims()），所以 user id 要取 user.sub 不是 user.id。
async function authenticate(event) {
    const user = await serverSupabaseUser(event)

    if (!user) {
        throw createError({ statusCode: 401, message: '請先登入' })
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, is_active')
        .eq('id', user.sub)
        .maybeSingle()

    if (error) {
        throw createError({ statusCode: 500, message: error.message })
    }

    // 只有「明確被標成停用」才擋。is_active 是 null 或整列不存在都放行 ——
    // 早期的 row 沒有這個欄位，把它當成停用會讓老帳號全部進不來。
    if (data?.is_active === false) {
        throw createError({
            statusCode: 403,
            message: '這個帳號已經停用，請聯絡管理員',
        })
    }

    return { userId: user.sub, profile: data }
}

// 取得目前登入者的 id。未登入丟 401，帳號已停用丟 403。
export async function requireUser(event) {
    const { userId } = await authenticate(event)
    return userId
}

// 確認是管理員，不是就丟 403。
// 一定要在 server 端查 profiles.is_admin —— 前端的 isAdmin 只是拿來
// 決定按鈕要不要顯示，改個 JS 變數就繞過去了。
export async function requireAdmin(event) {
    const { userId, profile } = await authenticate(event)

    if (!profile?.is_admin) {
        throw createError({
            statusCode: 403,
            message: '只有管理員可以執行這個操作',
        })
    }

    return userId
}
