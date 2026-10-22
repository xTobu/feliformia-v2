// 頭像：公開 bucket（avatars），網址照路徑組出來就好，不用 server 發。
// 上傳：手機裁好的 512×512 JPEG → server 發一次性上傳網址 → 直接傳到 Storage → server 記下路徑、刪舊檔
export function useAvatar() {
    const config = useRuntimeConfig();
    const { uploadFile } = usePhotoUpload();

    const avatarUrl = (path) =>
        path ? `${config.public.supabase.url}/storage/v1/object/public/avatars/${path}` : null;

    // target：'me' 或 'cat'（要帶 catId）。回傳新的路徑
    async function uploadAvatar({ target, catId, blob }) {
        const slot = await $fetch('/api/avatar/upload-url', { method: 'POST', body: { target, catId } });
        await uploadFile(slot.path, slot.token, blob, () => {}, 'avatars');
        const res = await $fetch('/api/avatar/save', { method: 'POST', body: { target, catId, path: slot.path } });
        return res.avatar_path;
    }

    async function removeAvatar({ target, catId }) {
        await $fetch('/api/avatar/save', { method: 'POST', body: { target, catId, path: null } });
    }

    return { avatarUrl, uploadAvatar, removeAvatar };
}
