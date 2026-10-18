// 新版照護系統的位置清單：cat_profiles.location 與三張事項表的 location 都只能是這幾個
// （資料庫有 check 擋，要改這份也要寫 migration 一起改）
export const LOCATIONS = ['客廳', '房間', '倉庫', '隔離區'];

// 不屬於單一貓咪的項目怎麼排：全員 → 位置（照 LOCATIONS 的順序）。
// 後台與值班表都是「貓咪在前，這些在後」
export function placeRank(location) {
    if (!location) return 0;
    const index = LOCATIONS.indexOf(location);
    return index >= 0 ? 1 + index : 100;
}

// 適用對象的顯示名稱：沒有位置就是全員
export function placeName(location) {
    return location || '全員';
}
