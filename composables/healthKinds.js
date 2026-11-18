// 醫療紀錄（cat_health_records）：一筆有一個類型（kind，單選）與幾個項目（items，可多選）。
// 資料庫有 check 擋類型，改這份也要寫 migration 一起改。

// 類型（單選）。每一筆至少要有一個項目（列表上項目就是標題）
export const HEALTH_TYPES = [
    { key: 'visit', label: '看診', icon: 'mdi:stethoscope' },
    { key: 'emergency', label: '急診', icon: 'mdi:alarm-light-outline' },
    { key: 'revisit', label: '回診', icon: 'mdi:repeat' },
    { key: 'house', label: '貓屋處理', icon: 'mdi:home-heart' },
];

// 預設項目：通常在醫院做的在前，貓屋自己做的（驅蟲、除蚤）接著，最後是症狀（吐血、血便、傷口）。
// 不在這裡的是志工按「＋ 其他」自己加的標籤，存的就是那幾個字
export const HEALTH_ITEMS = ['血檢', '結紮', '預防針', '快篩', '晶片', '洗牙', '拔牙', '驅蟲', '除蚤', '吐血', '血便', '傷口'];

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

// ---- 搜尋與篩選（貓咪檔案的醫療紀錄，視窗在 components/HealthFilterDialog.vue）----
// keyword：描述、項目、類型、陪同者裡有出現（不分大小寫）；空格隔開的幾個字要全部找得到（可以分散在不同欄）；from／to：日期區間，只填一邊也可以；
// kinds／items／companions：同一組選多個，符合其中一個就算；不同組之間要全部符合
export const emptyHealthFilter = () => ({ keyword: '', from: null, to: null, kinds: [], items: [], companions: [] });

export const isHealthFilterEmpty = (f) =>
    !f.keyword.trim() && !f.from && !f.to && !f.kinds.length && !f.items.length && !f.companions.length;

// 關鍵字拆成一個一個字詞（空格、全形空格都算），小寫
export const healthKeywords = (keyword) => keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);

export function matchHealthFilter(record, f) {
    const words = healthKeywords(f.keyword);
    if (words.length) {
        const text = [record.note || '', ...record.items, ...(record.companions || []), healthTypeLabel(record.kind)]
            .join('\n')
            .toLowerCase();
        if (!words.every((w) => text.includes(w))) return false;
    }
    if (f.from && record.date < f.from) return false;
    if (f.to && record.date > f.to) return false;
    if (f.kinds.length && !f.kinds.includes(record.kind)) return false;
    if (f.items.length && !f.items.some((i) => record.items.includes(i))) return false;
    if (f.companions.length && !f.companions.some((c) => (record.companions || []).includes(c))) return false;
    return true;
}

// 時間的快速選項（今天用傳進來的 dayjs 算）。to 是 null＝到現在
export function healthDateRanges(dayjs) {
    const today = dayjs();
    const year = today.year();
    return [
        { key: '3m', label: '近 3 個月', from: today.subtract(3, 'month').format('YYYY-MM-DD'), to: null },
        { key: 'year', label: '今年', from: `${year}-01-01`, to: null },
        { key: 'last', label: '去年', from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    ];
}

// 日期區間顯示的字：剛好是快速選項就用它的名字，不然「2026/01/01 ~ 2026/10/25」「2026/01/01 起」「到 2026/10/25」
export function healthDateRangeLabel(f, ranges) {
    const range = ranges.find((r) => r.from === f.from && r.to === f.to);
    if (range) return range.label;
    const show = (d) => d.replaceAll('-', '/');
    if (f.from && f.to) return `${show(f.from)} ~ ${show(f.to)}`;
    return f.from ? `${show(f.from)} 起` : `到 ${show(f.to)}`;
}
