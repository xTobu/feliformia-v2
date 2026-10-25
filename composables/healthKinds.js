// 醫療紀錄（cat_health_records）：一筆有一個類型（kind，單選）與幾個項目（items，可多選）。
// 資料庫有 check 擋類型，改這份也要寫 migration 一起改。

// 類型（單選）。每一筆至少要有一個項目（列表上項目就是標題）
export const HEALTH_TYPES = [
    { key: 'visit', label: '看診', icon: 'mdi:stethoscope' },
    { key: 'emergency', label: '急診', icon: 'mdi:alarm-light-outline' },
    { key: 'revisit', label: '回診', icon: 'mdi:repeat' },
    { key: 'house', label: '貓屋處理', icon: 'mdi:home-heart' },
];

// 預設項目：通常在醫院做的在前，貓屋自己做的（驅蟲、除蚤）在後。
// 不在這裡的是志工按「＋ 其他」自己加的標籤，存的就是那幾個字
export const HEALTH_ITEMS = ['血檢', '結紮', '預防針', '快篩', '晶片', '洗牙', '拔牙', '驅蟲', '除蚤'];

export const MAX_HEALTH_ITEMS = 20;
export const MAX_HEALTH_ITEM_LENGTH = 20;
export const MAX_COMPANIONS = 10;
export const MAX_COMPANION_LENGTH = 20;

const typeOf = (key) => HEALTH_TYPES.find((t) => t.key === key);
export const healthTypeLabel = (key) => typeOf(key)?.label || '';
export const healthTypeIcon = (key) => typeOf(key)?.icon || '';
export const isPresetItem = (item) => HEALTH_ITEMS.includes(item);

// 項目整理：去空白、去重複、預設的照清單順序排前面，自己加的照原本順序接在後面
export function sortHealthItems(items) {
    const clean = [...new Set((items || []).map((i) => String(i).trim()).filter(Boolean))];
    return [...HEALTH_ITEMS.filter((i) => clean.includes(i)), ...clean.filter((i) => !isPresetItem(i))];
}
