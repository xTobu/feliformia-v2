import { supabase } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/auth'
import { PHOTO_COLUMNS, PHOTO_TABS, cleanNote, photoPrefix, withSignedUrls } from '~/server/utils/photos'
import { isPhotoKindChoice, sortPhotoKinds } from '~/composables/photoKinds'

// 照片傳完之後記一筆。路徑一定要是剛才發的那一組（班 id/貓 id/ 底下），
// 名字由 server 從 profiles 帶，之後改暱稱也不影響。batch：同一次上傳的照片共用的 id（留言頻道併成一筆）
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async (event) => {
    const userId = await requireUser(event)

    const { shiftId, catId, tab, kinds = [], note, path, thumbPath, width, height, size, batch } = await readBody(event)
    const prefix = photoPrefix(shiftId, catId)
    const int = (v) => (Number.isInteger(v) && v > 0 ? v : null)
    if (
        !shiftId ||
        !catId ||
        !PHOTO_TABS.includes(tab) ||
        typeof path !== 'string' ||
        typeof thumbPath !== 'string' ||
        !path.startsWith(prefix) ||
        !thumbPath.startsWith(prefix) ||
        path.includes('..') ||
        thumbPath.includes('..') ||
        !isPhotoKindChoice(tab, kinds) ||
        (batch != null && !UUID.test(batch))
    ) {
        throw createError({ statusCode: 400, message: '資料格式錯誤' })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle()

    const { data, error } = await supabase
        .from('shift_photos')
        .insert({
            shift_id: shiftId,
            cat_id: catId,
            tab,
            kinds: sortPhotoKinds(tab, kinds),
            note: cleanNote(note),
            path,
            thumb_path: thumbPath,
            width: int(width),
            height: int(height),
            size: int(size),
            uploaded_by: userId,
            author_name: profile?.nickname || null,
            upload_batch: batch || null,
        })
        .select(PHOTO_COLUMNS)
        .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    const [row] = await withSignedUrls([data])
    return row
})
