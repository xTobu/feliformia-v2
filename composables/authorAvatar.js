// 留言作者沒上傳頭像時：用名字第一個字當頭像，底色照名字固定（留言頻道與貓咪檔案共用，同一個人兩邊同色）
const AVATAR_COLORS = [
    ['#d9e6ee', '#3f7ea3'],
    ['#e8e2dc', '#6b625d'],
    ['#e3ecdf', '#4f7243'],
    ['#efe0e6', '#8a4a63'],
    ['#e6e2f0', '#5b5190'],
    ['#f3e6d6', '#8a5a1f'],
];

export const authorInitial = (name) => (name || '？').trim().charAt(0);

export function authorAvatarStyle(name) {
    const sum = [...(name || '')].reduce((total, ch) => total + ch.codePointAt(0), 0);
    const [background, color] = AVATAR_COLORS[sum % AVATAR_COLORS.length];
    return { background, color };
}
