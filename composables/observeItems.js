// 觀察管理（observe_items）：值班時要做的事，是貓名旁的膠囊，點了打勾。
//
// 2026-11-18 改版：以前類別限定「拍剩食、拍貓砂、拍留餐、放風」四個，並且用「剛到／離開」
// 兩組隱形地決定膠囊出現在哪個分頁。現在類別可以自己新增（例如「拍胰島素」），
// 分頁改成項目自己的 tab 欄位（arrive = 飲食如廁、meal = 備餐），後台直接選。
//
// 「放風」仍是特例：它不是膠囊、不用勾，只讓期間內新開的班備餐的放風按鈕預設打開
// （server/utils/shift.js 的 RELEASE），所以不放進班的快照。
//
// 打勾記在那一班、那隻貓的 cats[id].observe_done[項目 id] = { done_by, done_at }，
// 全員／位置的項目也是每隻貓各勾各的。
// 前端（膠囊）與 server（/api/shift/previous 的前班未完成）都用這份判斷。

// 值班表的分頁。標籤跟 pages/shift/[[tab]].vue 的 TAB_LABELS 一致
export const OBSERVE_TABS = [
    { value: 'arrive', label: '飲食如廁' },
    { value: 'meal', label: '備餐' },
];

// 後台新增項目時下拉的建議選項。不是白名單 —— 打字就能新增別的
export const OBSERVE_PRESETS = ['拍剩食', '拍貓砂', '拍留餐', '放風'];

// 放風只能放備餐（它決定的是備餐分頁的放風按鈕）
export const OBSERVE_TAB_LOCKED = { 放風: 'meal' };

// 類別 → 照片的類型（composables/photoKinds.js）；上傳時也預先選好。
// 只有原本那三個有對應，自訂類別沒有（2026-11-12 起改打勾制，不靠照片判斷）
export const OBSERVE_PHOTO_KIND = { 拍剩食: '剩食', 拍貓砂: '貓砂', 拍留餐: '留餐' };

// 2026-11-18 以前的班，快照裡的項目沒有 tab 欄位，照當時的剛到／離開規則判斷
const LEGACY_TAB = { 拍留餐: 'meal', 放風: 'meal' };

// 這一項在哪個分頁。吃項目物件（有 tab 就用它），也吃單純的類別字串（舊資料）
export function observeTabOf(item) {
    if (typeof item === 'string') return LEGACY_TAB[item] || 'arrive';
    return item?.tab || LEGACY_TAB[item?.category] || 'arrive';
}

// 以前的「其他」類別（已經拿掉，舊的班快照裡可能還有）：膠囊上寫說明、有任何一張照片就算
export const isObserveOther = (category) => category.endsWith('其他');

// photos：那一班、這隻貓、那個分頁的照片（照片庫裡的，含留言附的）；ticked：observe_done 裡這一項
export function isObserveDone(category, photos = [], ticked = null) {
    if (ticked) return true;
    const kind = OBSERVE_PHOTO_KIND[category];
    if (kind) return photos.some((p) => (p.kinds || []).includes(kind));
    // 以前的「其他」：有任何一張照片就算
    if (isObserveOther(category)) return photos.length > 0;
    // 自訂類別：沒有對應的照片類型可以判斷，只看打勾。
    // （以前是 return photos.length > 0，那會讓這隻貓在這個分頁隨便有張照片就算完成）
    return false;
}
