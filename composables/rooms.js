// 貓屋的房間／區域。貓咪管理選房間、飲食與醫療管理選「不屬於單一貓咪」的項目都用這份
export const ROOMS = ['客廳', '小房間', '倉庫', '隔離區'];

// 非貓咪項目的排序：全員 → 房間（照 ROOMS 的順序）→ 手動輸入的其他名稱。
// 後台與值班表都是「貓咪在前，這些在後」
export function placeRank(name) {
    if (name === '全員') return 0;
    const room = ROOMS.indexOf(name);
    return room >= 0 ? 1 + room : 100;
}
