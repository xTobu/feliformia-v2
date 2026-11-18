// 照片傳到 Storage：值班照片（shift-photos，照片牆與留言頻道）與頭像（avatars）共用
export function usePhotoUpload() {
    const config = useRuntimeConfig();
    const supabase = useSupabaseClient();

    // 傳一個檔到一次性上傳網址，回報傳了多少（0～1）。
    // 跟 supabase-js 的 uploadToSignedUrl 送一樣的請求，只是改用 XMLHttpRequest 才拿得到上傳進度；
    // 萬一失敗就退回 supabase-js 再傳一次（只是沒有進度）
    const { url: SUPABASE_URL, key: SUPABASE_KEY } = config.public.supabase;
    function putWithProgress(bucket, path, token, blob, onProgress) {
        return new Promise((resolve, reject) => {
            const form = new FormData();
            form.append('cacheControl', '3600');
            form.append('', blob);
            const xhr = new XMLHttpRequest();
            xhr.open(
                'PUT',
                `${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`
            );
            xhr.setRequestHeader('apikey', SUPABASE_KEY);
            xhr.setRequestHeader('x-upsert', 'false');
            xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
            xhr.onload = () =>
                xhr.status >= 200 && xhr.status < 300
                    ? resolve()
                    : reject(new Error(`upload ${xhr.status}: ${xhr.responseText}`));
            xhr.onerror = () => reject(new Error('upload network error'));
            xhr.send(form);
        });
    }

    async function uploadFile(path, token, blob, onProgress, bucket = 'shift-photos') {
        try {
            await putWithProgress(bucket, path, token, blob, onProgress);
        } catch (e) {
            console.warn('XHR upload failed, retry with supabase-js:', e);
            const { error } = await supabase.storage
                .from(bucket)
                .uploadToSignedUrl(path, token, blob, { contentType: 'image/jpeg' });
            if (error) throw error;
        }
        onProgress(1);
    }

    return { uploadFile };
}
