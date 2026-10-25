import { supabase } from '~/server/utils/supabase'

// 照護項目（飲食、醫療、收尾；觀察不用）的附圖：公開 bucket care-item-photos（同頭像，網址照路徑組）。
// 檔案放在「<表名>/」底下：大圖 <uuid>.jpg、縮圖 <uuid>_thumb.jpg。寫入只有管理員（server/api/care-items/*）
export const CARE_PHOTO_BUCKET = 'care-item-photos'
export const CARE_ITEM_TABLES = ['diet_items', 'medical_items', 'required_items']
export const MAX_CARE_ITEM_PHOTOS = 6

export const careItemStorage = () => supabase.storage.from(CARE_PHOTO_BUCKET)
export const careThumbOf = (path) => path.replace(/\.jpg$/, '_thumb.jpg')

// 路徑是不是這幾張表底下的大圖（不是縮圖、沒有 ..）
export const isCareItemPhotoPath = (path) =>
    typeof path === 'string' &&
    CARE_ITEM_TABLES.some((t) => path.startsWith(`${t}/`)) &&
    path.endsWith('.jpg') &&
    !path.endsWith('_thumb.jpg') &&
    !path.includes('..')
