// 頭像：公開 bucket（avatars），網址照路徑組出來就好，不用 server 發。
// 上傳：手機裁好的 512×512 JPEG → server 發一次性上傳網址 → 直接傳到 Storage → server 記下路徑、刪舊檔。
// 原圖（壓過的）與框的範圍也留著，之後點頭像可以重新調整位置（components/AvatarCropper.vue）
export function useAvatar() {
    const config = useRuntimeConfig();
    const { uploadFile } = usePhotoUpload();

    const avatarUrl = (path) =>
        path ? `${config.public.supabase.url}/storage/v1/object/public/avatars/${path}` : null;

    // target：'me' 或 'cat'（要帶 catId）。blob：裁好的頭像。
    // source：{ blob } 新選的照片（壓過的原圖，要一起傳）或 { path } 沿用已經在 Storage 的原圖；crop：在原圖上框的範圍。
    // 回傳 { avatar_path, avatar_source_path, avatar_crop }
    async function uploadAvatar({ target, catId, blob, source = null, crop = null }) {
        const slot = await $fetch('/api/avatar/upload-url', {
            method: 'POST',
            body: { target, catId, withSource: !!source?.blob },
        });
        await uploadFile(slot.path, slot.token, blob, () => {}, 'avatars');
        let sourcePath = source?.path || null;
        if (source?.blob) {
            await uploadFile(slot.sourcePath, slot.sourceToken, source.blob, () => {}, 'avatars');
            sourcePath = slot.sourcePath;
        }
        return $fetch('/api/avatar/save', {
            method: 'POST',
            body: { target, catId, path: slot.path, sourcePath, crop },
        });
    }

    async function removeAvatar({ target, catId }) {
        await $fetch('/api/avatar/save', { method: 'POST', body: { target, catId, path: null } });
    }

    return { avatarUrl, uploadAvatar, removeAvatar };
}
