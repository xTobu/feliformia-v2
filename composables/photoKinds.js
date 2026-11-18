// 🗂️ 照片庫的照片類型（選填、可多選，之後可改；直接上傳的與留言附的都能標）。觀察、醫療、備餐各一組。
// 一個分頁可以分成幾小組，畫面上用分隔線隔開：觀察的剩食、貓砂是「剛到要拍」（觀察管理）的那兩種，放前面自成一組，
// 而且只能擇一（single）：一張照片拍的是剩食就不是貓砂。其他組可以多選。篩選照片時不受擇一限制。
// 備餐的「留餐」是「離開要拍」（觀察管理）的那一種，也放前面自成一組。
// observe：這組的膠囊用暖橘色（跟「剛到要拍／離開要拍」同一家族），其他類型是藍色
// 資料庫有 check 擋（shift_photos.kinds），改這份也要寫 migration 一起改
export const PHOTO_KIND_GROUPS = {
    arrive: [
        { kinds: ['剩食', '貓砂'], single: true, observe: true },
        { kinds: ['嘔吐', '血跡', '毛髮皮膚', '其他'] },
    ],
    care: [{ kinds: ['傷口', '皮膚', '眼耳口鼻', '治療', '用藥', '其他'] }],
    meal: [{ kinds: ['留餐'], observe: true }, { kinds: ['乾乾', '罐罐', '加藥', '其他'] }],
};

export const PHOTO_KINDS = Object.fromEntries(
    Object.entries(PHOTO_KIND_GROUPS).map(([tab, groups]) => [tab, groups.flatMap((g) => g.kinds)])
);

// 觀察管理要拍的那幾種（剩食、貓砂、留餐）：膠囊用暖橘色
const OBSERVE_KINDS = Object.values(PHOTO_KIND_GROUPS).flatMap((groups) =>
    groups.filter((g) => g.observe).flatMap((g) => g.kinds)
);
export const isObserveKind = (kind) => OBSERVE_KINDS.includes(kind);

// 一組類型是不是都屬於這個分頁、沒有重複（篩選用）
export const isPhotoKinds = (tab, kinds) =>
    Array.isArray(kinds) &&
    new Set(kinds).size === kinds.length &&
    kinds.every((kind) => (PHOTO_KINDS[tab] || []).includes(kind));

// 幫一張照片選的類型合不合規則：除了上面，擇一的那組最多只能有一個（上傳、編輯用）
export const isPhotoKindChoice = (tab, kinds) =>
    isPhotoKinds(tab, kinds) &&
    (PHOTO_KIND_GROUPS[tab] || []).every((g) => !g.single || kinds.filter((k) => g.kinds.includes(k)).length <= 1);

// 照規則整理：擇一的那組只留第一個（舊照片在規則之前標了兩個的，編輯時先這樣帶進來）
export const fitPhotoKinds = (tab, kinds) => {
    const singles = (PHOTO_KIND_GROUPS[tab] || []).filter((g) => g.single);
    return kinds.filter((kind) => {
        const group = singles.find((g) => g.kinds.includes(kind));
        return !group || kinds.find((k) => group.kinds.includes(k)) === kind;
    });
};

// 照分頁清單的順序排好（存進資料庫與顯示都用這個順序）
export const sortPhotoKinds = (tab, kinds) =>
    (PHOTO_KINDS[tab] || []).filter((kind) => kinds.includes(kind));
