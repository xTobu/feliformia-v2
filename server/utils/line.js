import * as line from '@line/bot-sdk'

// 共用的 LINE client。原本散在 push.post.js 裡，
// webhook 與提醒都要用，抽出來統一管理。
function getClient() {
    return new line.Client({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    })
}

function textMessage(text) {
    return [{ type: 'text', text }]
}

// 驗證 LINE webhook 的簽章。
// ⚠️ 一定要用「原始的 body 字串」，解析過的 JSON 重新 stringify 會對不起來
//（鍵的順序、空白都可能不同）。呼叫端要用 readRawBody() 不是 readBody()。
export function verifyLineSignature(rawBody, signature) {
    const channelSecret = process.env.LINE_CHANNEL_SECRET

    if (!channelSecret) {
        throw createError({
            statusCode: 500,
            message: '沒有設定 LINE_CHANNEL_SECRET，無法驗證 webhook 簽章',
        })
    }

    if (!signature || !rawBody) return false

    return line.validateSignature(rawBody, channelSecret, signature)
}

// 推播給單一使用者（需要對方的 LINE userId，靠 webhook 綁定取得）
export async function pushToUser(lineUserId, text) {
    if (!lineUserId || !text) return { success: false, reason: 'missing args' }

    try {
        await getClient().pushMessage(lineUserId, textMessage(text))
        return { success: true }
    } catch (error) {
        // 對方封鎖或刪除好友時 LINE 會回錯，不要讓整批提醒因為一個人失敗
        console.error(`LINE push 給 ${lineUserId} 失敗:`, error.message)
        return { success: false, reason: error.message }
    }
}

// 推播到志工群組。
// 正式環境才發主群組，測試環境只發夥伴群組 —— 這個安全閥是既有行為，保留。
export async function pushToGroups(text) {
    const client = getClient()
    const groupIdMain = process.env.LINE_GROUPID_FELIFORMIA_MAIN
    const groupIdPartner = process.env.LINE_GROUPID_FELIFORMIA_PARTNER
    const messages = textMessage(text)

    if (process.env.DEPLOY_SITE === 'feliformia' && groupIdMain) {
        await client.pushMessage(groupIdMain, messages)
    }

    if (groupIdPartner) {
        await client.pushMessage(groupIdPartner, messages)
    }

    return { success: true }
}

// 回覆 webhook 事件。replyToken 只能用一次、且有時效（約 30 秒）
export async function replyMessage(replyToken, text) {
    if (!replyToken || !text) return

    try {
        await getClient().replyMessage(replyToken, textMessage(text))
    } catch (error) {
        console.error('LINE reply 失敗:', error.message)
    }
}
