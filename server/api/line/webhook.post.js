import { supabase } from '~/server/utils/supabase'
import { verifyLineSignature, replyMessage } from '~/server/utils/line'
import { loadUserEvents, todayInTaipei } from '~/server/utils/calendar-today'
import { buildDigest } from '~/server/utils/calendar-message'

// LINE webhook。處理綁定、解除綁定、選單，以及查自己今天的活動。
//
// ⚠️ 只回應下面這幾個關鍵字，其他訊息一律不回應也不動作 ——
// 交給 LINE Official Account Manager 設定的關鍵字自動回覆。
// 新增關鍵字前要先確認後台沒設過同樣的詞，否則使用者會收到兩則回覆。

const BIND_KEYWORD = '我要綁定'
const UNBIND_KEYWORD = '我要解除綁定'
const MENU_KEYWORD = '大哥我要問'
const TODAY_KEYWORD = '我的活動提醒'

// 選單標了號碼，使用者很自然會直接回數字。
// 對應的動作依綁定狀態不同，見 handleMenuNumber()
const MENU_NUMBERS = ['1', '2']

const HELP_TEXT = [
    '喵喵  我是大哥 🐱',
    '很高興你加入了我們',
    '',
    '這是貓毛的網站',
    'https://feliformia.org/',
    '',
    '如果想收到貓屋行事曆的活動提醒，',
    '請傳訊息：',
    `「${BIND_KEYWORD} {你的註冊信箱}」`,
    '',
    `例如：${BIND_KEYWORD} cat@example.com`,
    '（信箱要跟你登入貓屋網站的一樣）',
    '',
    `任何時候傳「${MENU_KEYWORD}」都能看我會做什麼 🐾`,
].join('\n')

// 選單。未綁定的人只能綁定，所以直接把用法寫出來，不列成選單
function menuText(profile) {
    if (!profile) {
        return [
            '喵喵  你好～',
            '需要什麼幫忙呢？',
            '',
            `1. ${BIND_KEYWORD} {你的信箱}`,
            '',
            `例如：${BIND_KEYWORD} cat@example.com`,
            '（信箱要跟你登入貓屋網站的一樣）',
        ].join('\n')
    }

    return [
        // 帶暱稱順便讓他確認「綁到的是我沒錯」
        profile.nickname ? `喵喵  ${profile.nickname}你好～` : '喵喵  你好～',
        '需要什麼幫忙呢？',
        '',
        `1. ${TODAY_KEYWORD}`,
        `2. ${UNBIND_KEYWORD}`,
    ].join('\n')
}

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

    if (text === MENU_KEYWORD) {
        await replyMessage(lineEvent.replyToken, menuText(await findProfileByLineUserId(lineUserId)))
        return
    }

    if (text === TODAY_KEYWORD) {
        await handleMyToday(lineEvent.replyToken, await findProfileByLineUserId(lineUserId))
        return
    }

    if (MENU_NUMBERS.includes(text)) {
        await handleMenuNumber(lineEvent.replyToken, lineUserId, text)
        return
    }

    // 解除要排在綁定前面：兩個都以「我要」開頭，但只有解除是完整前綴比對
    if (text.startsWith(UNBIND_KEYWORD)) {
        await handleUnbind(lineEvent.replyToken, await findProfileByLineUserId(lineUserId))
        return
    }

    if (text.startsWith(BIND_KEYWORD)) {
        await handleBind(lineEvent.replyToken, lineUserId, text.slice(BIND_KEYWORD.length).trim())
    }

    // 其他訊息：不回應，交給 LINE 內建的自動回覆
}

// 直接回數字時的對應。未綁定只有一項，已綁定是 1 活動提醒 / 2 解除綁定
async function handleMenuNumber(replyToken, lineUserId, number) {
    const profile = await findProfileByLineUserId(lineUserId)

    if (!profile) {
        // 還沒綁定的人按什麼號碼都只能走綁定，直接把選單再給他一次
        await replyMessage(replyToken, menuText(null))
        return
    }

    if (number === '1') {
        await handleMyToday(replyToken, profile)
        return
    }

    await handleUnbind(replyToken, profile)
}

// 查自己今天的活動。格式跟早上八點那則提醒一模一樣（共用 buildDigest）
async function handleMyToday(replyToken, profile) {
    if (!profile) {
        await replyMessage(
            replyToken,
            `你還沒有綁定喔 🐾\n請傳「${BIND_KEYWORD} 你的信箱」。`
        )
        return
    }

    const date = todayInTaipei()
    const events = await loadUserEvents(profile.id, date)

    if (!events.length) {
        await replyMessage(replyToken, '你今天沒有活動 🐾')
        return
    }

    await replyMessage(replyToken, buildDigest(date, events))
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
        await replyMessage(replyToken, '綁定失敗了 😿\n請稍後再試，或在群組裡跟管理員說一聲。')
        return
    }

    await replyMessage(
        replyToken,
        `綁定成功，${profile.nickname || email} 👍\n之後有活動我會在當天早上提醒你。`
    )
}

async function handleUnbind(replyToken, profile) {
    if (!profile) {
        await replyMessage(replyToken, '你目前沒有綁定任何帳號喔。')
        return
    }

    await supabase
        .from('profiles')
        .update({ line_user_id: null, updated_at: new Date().toISOString() })
        .eq('id', profile.id)

    await replyMessage(replyToken, `已解除綁定，之後不會再收到提醒。\n要重新綁定請傳「${BIND_KEYWORD} 你的信箱」。`)
}

// 這個 LINE 帳號綁在誰身上。選單、活動提醒、解除綁定都要先問這件事
async function findProfileByLineUserId(lineUserId) {
    const { data } = await supabase
        .from('profiles')
        .select('id, nickname')
        .eq('line_user_id', lineUserId)
        .maybeSingle()

    return data || null
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
