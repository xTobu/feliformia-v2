// 照護項目（飲食、醫療、收尾；觀察不用）的附圖：公開 bucket care-item-photos，網址照路徑組（同頭像）。
// photos 存大圖路徑，縮圖是同名加 _thumb（server/utils/careItemPhotos.js）
export const MAX_CARE_ITEM_PHOTOS = 6

export function useCareItemPhotos() {
    const config = useRuntimeConfig();
    const base = `${config.public.supabase.url}/storage/v1/object/public/care-item-photos/`;
    const photoUrl = (path) => base + path;
    const thumbUrl = (path) => base + path.replace(/\.jpg$/, '_thumb.jpg');
    return { photoUrl, thumbUrl };
}
