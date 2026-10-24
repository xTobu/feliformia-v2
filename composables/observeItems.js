// 觀察管理（observe_items）：值班時要拍照的事，分兩組：
//   剛到（觀察分頁）：拍剩食、拍貓砂——看上一班留下的飯吃了多少、貓砂
//   離開（備餐分頁）：拍留餐——這一班留給下一班的飯
// 不用打勾：這一班、這隻貓、那個分頁的照片有對應類型就算完成（直接上傳的、留言附的都算）。
// 前端（卡片、分頁數字）與 server（前班未完成）都用這份判斷
export const OBSERVE_GROUPS = [
    { label: '剛到', tab: 'arrive', categories: ['拍剩食', '拍貓砂'] },
    { label: '離開', tab: 'meal', categories: ['拍留餐'] },
];

export const OBSERVE_CATEGORIES = OBSERVE_GROUPS.flatMap((g) => g.categories);

// 類別 → 照片的類型（composables/photoKinds.js）；上傳時也預先選好
export const OBSERVE_PHOTO_KIND = { 拍剩食: '剩食', 拍貓砂: '貓砂', 拍留餐: '留餐' };

// 這個類別在哪個分頁拍（arrive／meal）
export const observeTabOf = (category) => OBSERVE_GROUPS.find((g) => g.categories.includes(category))?.tab || 'arrive';

// 以前的「其他」類別（已經拿掉，舊的班快照裡可能還有）：膠囊上寫說明、有任何一張照片就算
export const isObserveOther = (category) => category.endsWith('其他');

// photos：這一班、這隻貓、那個分頁的照片（照片庫裡的，含留言附的）
export function isObserveDone(category, photos) {
    const kind = OBSERVE_PHOTO_KIND[category];
    return kind ? photos.some((p) => (p.kinds || []).includes(kind)) : photos.length > 0;
}
