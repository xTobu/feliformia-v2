// 🗂️ 照片牆的照片類型（上傳時選填、可多選，上傳後可改）。觀察、醫療、備餐各一組；留言附的照片沒有類型。
// 資料庫有 check 擋（shift_photos.kinds），改這份也要寫 migration 一起改
export const PHOTO_KINDS = {
    arrive: ['食物', '貓砂', '嘔吐', '血跡', '毛髮皮膚', '其他'],
    care: ['傷口', '皮膚', '眼耳口鼻', '治療', '用藥', '其他'],
    meal: ['乾乾', '罐罐', '加藥', '其他'],
};

// 一組類型是不是都屬於這個分頁、沒有重複
export const isPhotoKinds = (tab, kinds) =>
    Array.isArray(kinds) &&
    new Set(kinds).size === kinds.length &&
    kinds.every((kind) => (PHOTO_KINDS[tab] || []).includes(kind));

// 照分頁清單的順序排好（存進資料庫與顯示都用這個順序）
export const sortPhotoKinds = (tab, kinds) =>
    (PHOTO_KINDS[tab] || []).filter((kind) => kinds.includes(kind));
