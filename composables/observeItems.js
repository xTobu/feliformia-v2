// 觀察管理（observe_items）：剛到班時要拍照的事，例如觀察幾天剩下的飯、貓砂。
// 不用打勾：這一班、這隻貓的觀察照片有對應類型就算完成（直接上傳的、留言附的都算；「其他」有任何一張就算）。
// 前端（卡片、分頁數字）與 server（前班未完成）都用這份判斷
export const OBSERVE_CATEGORIES = ['拍剩食', '拍貓砂', '其他'];

// 類別 → 觀察照片的類型（composables/photoKinds.js）；上傳時也預先選好
export const OBSERVE_PHOTO_KIND = { 拍剩食: '剩食', 拍貓砂: '貓砂' };

// photos：這一班、這隻貓的觀察照片（照片庫裡的，含留言附的）
export function isObserveDone(category, photos) {
    const kind = OBSERVE_PHOTO_KIND[category];
    return kind ? photos.some((p) => (p.kinds || []).includes(kind)) : photos.length > 0;
}
