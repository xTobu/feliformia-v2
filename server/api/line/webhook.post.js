import { supabase } from '~/server/utils/supabase'
import { verifyLineSignature, replyMessage } from '~/server/utils/line'

// LINE webhook。目前只做一件事：把志工的 LINE 帳號綁到系統帳號，
// 之後行事曆的提醒才發得出去。
//
// ⚠️ 只處理「綁定」「解除綁定」開頭的訊息，其他一律不回應也不動作。
// LINE Official Account Manager 設定的關鍵字自動回覆不會受影響。

const BIND_KEYWORD = '綁定'
const UNBIND_KEYWORD = '解除綁定'

const HELP_TEXT = [
    '嗨！我是大哥 🐱',
    '',
    '想收到貓屋行事曆的活動提醒，請傳：',
    '綁定 你的信箱',
    '',
    '例如：綁定 cat@example.com',
    '（信箱要跟你登入貓屋網站的一樣）',
].join('\n')

export default defineEventHandler(async (event) => {
    // 驗簽一定要用原始字串，不能用 readBody() 解析過的物件
    const rawBody = await readRawBody(event)
    const signature = getHeader(event, 'x-line-signature')

    if (!verifyLineSignature(rawBody, signature)) {
        throw createError({ statusCode: 401, message: 'invalid signature' })
    }

    const body = JSON.parse(rawBody)

    for (const lineEvent of body.events || []) {
        try {
            await handleEvent(lineEvent)
        } catch (error) {
            // 單一事件失敗不要讓整批回 500，否則 LINE 會一直重送
            console.error('處理 LINE 事件失敗:', error)
        }
    }

    // LINE 只在意有沒有收到 200
    return { success: true }
})

async function handleEvent(lineEvent) {
    // 加好友時送出使用說明
    if (lineEvent.type === 'follow') {
        await replyMessage(lineEvent.replyToken, HELP_TEXT)
        return
    }

    if (lineEvent.type !== 'message' || lineEvent.message?.type !== 'text') return

    // 只處理一對一的私訊。群組裡的訊息不碰，免得干擾現有的關鍵字回覆
    if (lineEvent.source?.type !== 'user') return

    const text = lineEvent.message.text.trim()
    const lineUserId = lineEvent.source.userId

    if (text.startsWith(UNBIND_KEYWORD)) {
        await handleUnbind(lineEvent.replyToken, lineUserId)
        return
    }

    if (text.startsWith(BIND_KEYWORD)) {
        await handleBind(lineEvent.replyToken, lineUserId, text.slice(BIND_KEYWORD.length).trim())
    }

    // 其他訊息：不回應，交給 LINE 內建的自動回覆
}

async function handleBind(replyToken, lineUserId, email) {
    if (!email) {
        await replyMessage(replyToken, `請一起附上信箱，例如：\n${BIND_KEYWORD} cat@example.com`)
        return
    }

    const profile = await findProfileByEmail(email)

    if (!profile) {
        await replyMessage(
            replyToken,
            `找不到「${email}」這個帳號 😿\n請確認是你登入貓屋網站用的信箱。`
        )
        return
    }

    // 這個 LINE 帳號已經綁在別人身上
    const { data: taken } = await supabase
        .from('profiles')
        .select('id, nickname')
        .eq('line_user_id', lineUserId)
        .maybeSingle()

    if (taken && taken.id !== profile.id) {
        await replyMessage(
            replyToken,
            `這個 LINE 帳號已經綁定「${taken.nickname || '其他志工'}」了。\n` +
                `要改綁請先傳「${UNBIND_KEYWORD}」。`
        )
        return
    }

    const { error } = await supabase
        .from('profiles')
        .update({ line_user_id: lineUserId, updated_at: new Date().toISOString() })
        .eq('id', profile.id)

    if (error) {
        console.error('綁定寫入失敗:', error)
        await replyMessage(replyToken, '綁定失敗了 😿 請稍後再試，或在群組裡跟管理員說一聲。')
        return
    }

    await replyMessage(
        replyToken,
        `綁定成功，${profile.nickname || email} 👍\n之後有活動我會在當天早上提醒你。`
    )
}

async function handleUnbind(replyToken, lineUserId) {
    const { data } = await supabase
        .from('profiles')
        .select('id, nickname')
        .eq('line_user_id', lineUserId)
        .maybeSingle()

    if (!data) {
        await replyMessage(replyToken, '你目前沒有綁定任何帳號喔。')
        return
    }

    await supabase
        .from('profiles')
        .update({ line_user_id: null, updated_at: new Date().toISOString() })
        .eq('id', data.id)

    await replyMessage(replyToken, `已解除綁定，之後不會再收到提醒。\n要重新綁定請傳「${BIND_KEYWORD} 你的信箱」。`)
}

// email 存在 auth.users 不在 profiles，要透過 admin API 查
async function findProfileByEmail(email) {
    const target = email.toLowerCase()
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
        console.error('查詢使用者失敗:', error)
        return null
    }

    const user = data.users.find((u) => u.email?.toLowerCase() === target)
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, nickname, is_active')
        .eq('id', user.id)
        .maybeSingle()

    // 已停用的志工不給綁
    if (!profile || profile.is_active === false) return null

    return profile
}
