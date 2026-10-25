// 貓咪的搜尋條件（後台貓咪管理、貓咪列表共用，視窗在 components/CatSearch.vue）：
// keyword 比對名稱與暱稱（不分大小寫）；status：all 全部、active 未領養、adopted 已領養
export const CAT_STATUS_OPTIONS = [
    { key: 'all', label: '全部' },
    { key: 'active', label: '未領養' },
    { key: 'adopted', label: '已領養' },
];

export const emptyCatFilter = () => ({ keyword: '', status: 'all' });

export const isCatFilterOn = (f) => !!f.keyword.trim() || f.status !== 'all';

export function matchesCatFilter(cat, f) {
    if (f.status === 'active' && cat.adopted) return false;
    if (f.status === 'adopted' && !cat.adopted) return false;
    const word = f.keyword.trim().toLowerCase();
    return !word || [cat.name, ...(cat.nicknames || [])].some((n) => n.toLowerCase().includes(word));
}
