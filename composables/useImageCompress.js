// 照片上傳前在手機上自動壓縮（志工不用做任何事）：讀一次原圖，畫成兩份 JPEG
//   大圖：最長邊 1600px、品質 0.8，約 300KB，全螢幕看得清楚
//   縮圖：最長邊 400px、品質 0.75，約 30KB，列表用
// 手機原圖常常 3～5MB；iPhone 的 HEIC 在這一步也會轉成 JPEG

const FULL = { maxSide: 1600, quality: 0.8 };
const THUMB = { maxSide: 400, quality: 0.75 };

// 照片的方向：createImageBitmap 會照 EXIF 轉正；不支援的瀏覽器退回 <img>（現代瀏覽器也會自動轉正）
async function decode(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            // 有些格式 createImageBitmap 讀不了，改用 <img>
        }
    }
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('無法讀取這張照片'));
        };
        img.src = url;
    });
}

function render(source, { maxSide, quality }) {
    const srcW = source.naturalWidth || source.width;
    const srcH = source.naturalHeight || source.height;
    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error('照片壓縮失敗'))),
            'image/jpeg',
            quality
        );
    });
}

// 回傳 { full: { blob, width, height }, thumb: { blob, width, height } }
export async function compressPhoto(file) {
    const source = await decode(file);
    try {
        const full = await render(source, FULL);
        const thumb = await render(source, THUMB);
        return { full, thumb };
    } finally {
        source.close?.();
    }
}
