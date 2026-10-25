// 新版貓咪管理（cat_profiles）的選項。資料庫有 check 擋（sex、coat_length），改這份也要寫 migration 一起改。
// 花色（coats）是預設清單＋編輯時「＋ 其他」自己打的（每個最多 10 字），資料庫不限定
export const COAT_COLORS = ['虎斑', '白底虎斑', '橘貓', '黑貓', '白貓', '灰貓', '賓士', '乳牛', '三花', '玳瑁', '橘白', '灰白'];
export const MAX_COAT_LENGTH = 10;
export const CAT_SEXES = ['公', '母'];
export const COAT_LENGTHS = ['短毛', '長毛'];

// 兩個日期（YYYY-MM-DD）之間滿幾個月
function fullMonths(from, to) {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

const todayText = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());

// 幾個月 → 「1 歲 3 個月」／「8 個月」
const monthsText = (months) => {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return years ? `${years} 歲${rest ? ` ${rest} 個月` : ''}` : `${rest} 個月`;
};

// 生日（預估）→ 大約幾歲：「約 1 歲 3 個月」，不滿 1 歲「約 8 個月」。沒填或在未來回空字串
export function catAgeText(birthMonth, today = todayText()) {
    if (!birthMonth) return '';
    const months = fullMonths(birthMonth, today);
    return months < 0 ? '' : `約 ${monthsText(months)}`;
}

// 入住多久：不滿 2 個月寫天數，之後寫「1 年 3 個月」／「5 個月」
export function stayText(arrivedOn, today = todayText()) {
    if (!arrivedOn || arrivedOn > today) return '';
    const days = Math.round((Date.parse(today) - Date.parse(arrivedOn)) / 86400000);
    if (days < 60) return `${days} 天`;
    const months = fullMonths(arrivedOn, today);
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return years ? `${years} 年${rest ? ` ${rest} 個月` : ''}` : `${months} 個月`;
}
