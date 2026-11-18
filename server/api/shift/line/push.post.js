import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { LINE_MESSAGES_MAX, pushToGroups, splitText } from '~/server/utils/line'
import { PHOTO_TABS, storage } from '~/server/utils/photos'

// 給 LINE 抓圖的網址有效期：LINE 收到後會自己存一份，這裡給 30 天
const LINE_URL_SECONDS = 30 * 24 * 60 * 60
const TOO_LONG = '\n…（內容太長，請到網站看完整內容）'

// 「LINE 發送至群組」：文字（回報＋留言，畫面組好的）加上勾選的照片，一次推播到群組。
// 一次最多 5 則：文字太長會切成好幾則，剩下的位置才給照片
export default defineEventHandler(async (event) => {
    await requireUser(event)

    const { shiftId, tab, text, photoIds = [] } = await readBody(event)
    if (
        !Number.isInteger(shiftId) ||
        !PHOTO_TABS.includes(tab) ||
        typeof text !== 'string' ||
        !text.trim() ||
        !Array.isArray(photoIds) ||
        !photoIds.every((id) => Number.isInteger(id) && id > 0)
    ) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    let chunks = splitText(text)
    if (chunks.length > LINE_MESSAGES_MAX) {
        chunks = chunks.slice(0, LINE_MESSAGES_MAX)
        chunks[LINE_MESSAGES_MAX - 1] = chunks[LINE_MESSAGES_MAX - 1].slice(0, 5000 - TOO_LONG.length) + TOO_LONG
    }
    if (photoIds.length > LINE_MESSAGES_MAX - chunks.length) {
        throw createError({ statusCode: 400, message: `這次最多只能附 ${LINE_MESSAGES_MAX - chunks.length} 張照片` })
    }

    let images = []
    if (photoIds.length) {
        // 只能附這一班、這個分頁的照片
        const { data: photos, error } = await supabase
            .from('shift_photos')
            .select('id, path, thumb_path')
            .in('id', photoIds)
            .eq('shift_id', shiftId)
            .eq('tab', tab)
        if (error) throw createError({ statusCode: 500, message: error.message })
        if (photos.length !== new Set(photoIds).size) throw createError({ statusCode: 400, message: '資料格式錯誤' })

        const { data: signed, error: signError } = await storage().createSignedUrls(
            photos.flatMap((p) => [p.path, p.thumb_path]),
            LINE_URL_SECONDS
        )
        if (signError) throw createError({ statusCode: 500, message: signError.message })
        const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]))
        // 照勾選的順序發
        images = photoIds.map((id) => {
            const p = photos.find((x) => x.id === id)
            return { type: 'image', originalContentUrl: urlOf.get(p.path), previewImageUrl: urlOf.get(p.thumb_path) }
        })
    }

    try {
        return await pushToGroups([...chunks.map((t) => ({ type: 'text', text: t })), ...images])
    } catch (error) {
        console.error('LINE push error:', error)
        throw createError({ statusCode: 500, message: error.message })
    }
})
