<template>
    <!-- 暫時的測試頁（不要 commit）：在 iPhone 選影片，看網頁讀得到什麼（長度、解析度、每秒幾格、大小、格式），
         照預定規則（60 秒內、不要 4K、不要慢動作）會不會被擋。不上傳、不碰資料庫 -->
    <div class="vt">
        <h1>影片檢查測試</h1>
        <p class="hint">規則：60 秒內、長邊不超過 1920（擋 4K）、每秒不超過 60 格（擋慢動作）。只在手機上讀，不會上傳。</p>
        <label class="pick">
            選影片（可多選）
            <input type="file" accept="video/*" multiple hidden @change="pick" />
        </label>

        <div v-for="v in videos" :key="v.key" class="card">
            <div class="top">
                <img v-if="v.thumb" :src="v.thumb" alt="" class="thumb" />
                <div v-else class="thumb empty">{{ v.thumbError || '截圖中' }}</div>
                <div class="name">
                    <b :class="v.ok === false ? 'bad' : v.ok ? 'good' : ''">
                        {{ v.ok == null ? '檢查中…' : v.ok ? '✓ 可以上傳' : '✗ 會被擋' }}
                    </b>
                    <div class="file">{{ v.name }}</div>
                </div>
            </div>
            <table>
                <tr v-for="row in v.rows" :key="row[0]">
                    <td>{{ row[0] }}</td>
                    <td :class="row[2] === false ? 'bad' : ''">{{ row[1] }}</td>
                </tr>
            </table>
            <details v-if="v.keys.length">
                <summary>影片裡的 Apple 標記（{{ v.keys.length }}）</summary>
                <div v-for="k in v.keys" :key="k" class="key">{{ k }}</div>
            </details>
            <div v-if="v.error" class="bad">{{ v.error }}</div>
        </div>
    </div>
</template>

<script setup>
definePageMeta({ ssr: false });
useHead({ title: '影片檢查測試' });

const videos = ref([]);

function pick(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    for (const file of files) {
        const v = reactive({
            key: crypto.randomUUID(),
            name: file.name,
            rows: [],
            keys: [],
            thumb: null,
            thumbError: null,
            ok: null,
            error: null,
        });
        videos.value.unshift(v);
        inspect(file, v);
    }
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function inspect(file, v) {
    let meta = {};
    let box = {};
    try {
        meta = await readWithVideoTag(file, v);
    } catch (e) {
        v.thumbError = '讀不到畫面';
        meta = {};
    }
    try {
        box = await readMp4(file);
    } catch (e) {
        v.error = `解析檔案失敗：${e.message}`;
    }
    v.keys = box.keys || [];

    const duration = meta.duration ?? box.duration;
    const width = meta.width || box.width;
    const height = meta.height || box.height;
    const longSide = Math.max(width || 0, height || 0);
    const fps = box.fps;
    const okDuration = duration != null && duration <= 60.5;
    const okSize = longSide > 0 && longSide <= 1920;
    const okFps = fps == null || fps <= 61;
    v.ok = okDuration && okSize && okFps;

    v.rows = [
        ['長度', duration != null ? `${duration.toFixed(1)} 秒` : '讀不到', okDuration],
        ['解析度', width ? `${width} × ${height}` : '讀不到', okSize],
        ['每秒幾格（平均）', fps ? fps.toFixed(1) : '讀不到', okFps],
        ['每格時間最短～最長', box.fpsRange || '—'],
        ['檔案大小', `${mb(file.size)}（每分鐘約 ${duration ? mb((file.size / duration) * 60) : '—'}）`],
        ['格式（瀏覽器說）', file.type || '空白'],
        ['容器／編碼', [box.brand, box.codec].filter(Boolean).join(' ／ ') || '—'],
        ['moov 在檔案', box.moovAt || '—'],
        ['影片軌數', box.videoTracks != null ? String(box.videoTracks) : '—'],
    ];
}

// 用 <video> 讀長度、解析度，截 0.5 秒的畫面當縮圖（順便看 iPhone 能不能解）
function readWithVideoTag(file, v) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        let meta = null;
        const done = () => URL.revokeObjectURL(url);
        const timer = setTimeout(() => {
            done();
            meta ? resolve(meta) : reject(new Error('timeout'));
        }, 15000);
        video.onloadedmetadata = () => {
            meta = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
            video.currentTime = Math.min(0.5, video.duration / 2);
        };
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            const scale = 240 / Math.max(video.videoWidth, video.videoHeight);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            v.thumb = canvas.toDataURL('image/jpeg', 0.8);
            clearTimeout(timer);
            done();
            resolve(meta);
        };
        video.onerror = () => {
            clearTimeout(timer);
            done();
            reject(new Error('video error'));
        };
        video.src = url;
        video.load();
    });
}

// ---- 讀 MP4／MOV 的 box：只讀檔頭和 moov，不整個載進來 ----
const text4 = (dv, at) => String.fromCharCode(dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3));

async function readMp4(file) {
    const out = {};
    let offset = 0;
    let moov = null;
    while (offset < file.size) {
        const head = new DataView(await file.slice(offset, offset + 16).arrayBuffer());
        if (head.byteLength < 8) break;
        let size = head.getUint32(0);
        const type = text4(head, 4);
        if (size === 1) size = Number(head.getBigUint64(8));
        else if (size === 0) size = file.size - offset;
        if (type === 'ftyp') out.brand = text4(new DataView(await file.slice(offset + 8, offset + 12).arrayBuffer()), 0);
        if (type === 'moov') {
            moov = new DataView(await file.slice(offset, offset + size).arrayBuffer());
            out.moovAt = offset < file.size / 2 ? '前面（邊下載邊播）' : '後面';
            break;
        }
        if (size < 8) break;
        offset += size;
    }
    if (!moov) throw new Error('找不到 moov');

    const CONTAINERS = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta'];
    const tracks = [];
    let current = null;
    function walk(start, end) {
        let at = start;
        while (at + 8 <= end) {
            let size = moov.getUint32(at);
            const type = text4(moov, at + 4);
            let header = 8;
            if (size === 1) {
                size = Number(moov.getBigUint64(at + 8));
                header = 16;
            } else if (size === 0) size = end - at;
            if (size < 8) break;
            const body = at + header;
            if (type === 'trak') {
                current = {};
                tracks.push(current);
            }
            if (CONTAINERS.includes(type)) walk(body, at + size);
            else if (type === 'meta') {
                // MP4 的 meta 多 4 bytes 版本；QuickTime 的沒有（後面直接是 hdlr）
                const qt = text4(moov, body + 4) === 'hdlr';
                walk(qt ? body : body + 4, at + size);
            } else if (type === 'hdlr' && current) current.handler = text4(moov, body + 8);
            else if (type === 'tkhd' && current) {
                current.width = moov.getUint32(at + size - 8) / 65536;
                current.height = moov.getUint32(at + size - 4) / 65536;
            } else if (type === 'mdhd' && current) {
                const v1 = moov.getUint8(body) === 1;
                current.timescale = moov.getUint32(body + (v1 ? 20 : 12));
                current.duration = v1 ? Number(moov.getBigUint64(body + 24)) : moov.getUint32(body + 16);
            } else if (type === 'stsd' && current) current.codec = text4(moov, body + 12);
            else if (type === 'stts' && current) {
                const n = moov.getUint32(body + 4);
                let samples = 0;
                let min = Infinity;
                let max = 0;
                for (let i = 0; i < n; i++) {
                    const count = moov.getUint32(body + 8 + i * 8);
                    const delta = moov.getUint32(body + 12 + i * 8);
                    samples += count;
                    if (delta) {
                        min = Math.min(min, delta);
                        max = Math.max(max, delta);
                    }
                }
                current.samples = samples;
                current.minDelta = min;
                current.maxDelta = max;
            }
            at += size;
        }
    }
    walk(8, moov.byteLength);

    const videoTracks = tracks.filter((t) => t.handler === 'vide');
    out.videoTracks = videoTracks.length;
    const t = videoTracks[0];
    if (t?.timescale) {
        out.duration = t.duration / t.timescale;
        out.fps = t.samples / out.duration;
        out.width = t.width;
        out.height = t.height;
        out.codec = t.codec;
        if (t.minDelta !== Infinity) {
            const f = (d) => (t.timescale / d).toFixed(1);
            out.fpsRange = t.minDelta === t.maxDelta ? `固定 ${f(t.minDelta)} 格／秒` : `${f(t.maxDelta)} ～ ${f(t.minDelta)} 格／秒`;
        }
    }

    // Apple 的標記（例如慢動作會有 playback-intent 之類的 key）：直接在 moov 裡找字串
    const latin = new TextDecoder('latin1').decode(new Uint8Array(moov.buffer));
    out.keys = [...new Set(latin.match(/com\.apple\.[a-z0-9.\-]+/gi) || [])];
    return out;
}
</script>

<style lang="scss" scoped>
.vt {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    color: #3d3936;
    font-size: 14px;
}

h1 {
    margin: 0 0 6px;
    font-size: 20px;
}

.hint {
    margin: 0 0 12px;
    color: #8a7f78;
    font-size: 13px;
}

.pick {
    display: block;
    margin-bottom: 16px;
    padding: 12px;
    border-radius: 10px;
    background: #6da2c2;
    color: #fff;
    font-weight: 600;
    text-align: center;
}

.card {
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid #e4e0dd;
    border-radius: 12px;
}

.top {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
}

.thumb {
    width: 96px;
    height: 72px;
    border-radius: 8px;
    background: #f0eeec;
    object-fit: cover;

    &.empty {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #a8a29e;
        font-size: 12px;
    }
}

.name {
    min-width: 0;
    flex: 1;

    .file {
        color: #8a7f78;
        font-size: 12px;
        word-break: break-all;
    }
}

table {
    width: 100%;
    border-collapse: collapse;

    td {
        padding: 3px 0;
        text-align: left;
        border-top: 1px solid #f0eeec;
        vertical-align: top;

        &:first-child {
            width: 42%;
            color: #8a7f78;
        }
    }
}

details {
    margin-top: 8px;
    font-size: 12px;

    .key {
        color: #6b625d;
        word-break: break-all;
    }
}

.good {
    color: #2f8a4c;
}

.bad {
    color: #c0392b;
}
</style>
