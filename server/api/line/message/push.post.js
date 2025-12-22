import * as line from '@line/bot-sdk'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { text } = body

    if (!text) {
        throw createError({ statusCode: 400, message: 'empty body.text' })
    }

    const client = new line.Client({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    })

    const groupIdMain = process.env.LINE_GROUPID_FELIFORMIA_MAIN
    const groupIdPartner = process.env.LINE_GROUPID_FELIFORMIA_PARTNER

    const messages = [
        {
            type: 'text',
            text,
        },
    ]

    try {
        // 只有正式環境才發送到主群組
        if (process.env.DEPLOY_SITE === 'feliformia' && groupIdMain) {
            await client.pushMessage(groupIdMain, messages)
        }

        // 發送到夥伴群組
        if (groupIdPartner) {
            await client.pushMessage(groupIdPartner, messages)
        }

        return { success: true }
    } catch (error) {
        console.error('LINE push error:', error)
        throw createError({ statusCode: 500, message: error.message })
    }
});