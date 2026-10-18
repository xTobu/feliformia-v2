// 新版照護系統的位置清單：cat_profiles.location 與事項表的 location 都只能是這幾個
// （資料庫有 check 擋，要改這份也要寫 migration 一起改）
export const LOCATIONS = ['客廳', '房間', '倉庫', '隔離區'];

// 「貓屋」＝整間屋子、跟貓無關的事（倒垃圾、關冷氣）。只有收尾（required_items）能選
export const HOUSE = '貓屋';

// 不屬於單一貓咪的項目怎麼排：全員 → 貓屋 → 位置（照 LOCATIONS 的順序）。
// 後台與值班表都是「貓咪在前，這些在後」
export function placeRank(location) {
    if (!location) return 0;
    if (location === HOUSE) return 1;
    const index = LOCATIONS.indexOf(location);
    return index >= 0 ? 2 + index : 100;
}

// 適用對象的顯示名稱：沒有位置就是全員
export function placeName(location) {
    return location || '全員';
}
