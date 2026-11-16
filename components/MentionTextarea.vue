<template>
    <div class="mt-wrap">
        <el-input
            ref="inputRef"
            type="textarea"
            :model-value="modelValue"
            :disabled="disabled"
            :autosize="autosize"
            :placeholder="placeholder"
            @update:model-value="onInput"
            @keydown="onKeydown"
            @blur="onBlur"
        />

        <!-- 選單送到 body：回報卡片 .my-report 有 overflow: hidden（為了切齊圓角），
             留在原地會被裁掉，只看得到前幾列。改用 fixed 定位，位置自己算（見 place()） -->
        <Teleport to="body">
        <div
            v-if="open && options.length"
            ref="panelEl"
            class="mt-panel"
            :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }"
        >
            <button
                v-for="(opt, i) in options"
                :key="opt.key"
                type="button"
                class="mt-opt"
                :class="{ on: i === active }"
                @mousedown.prevent="choose(opt)"
            >
                {{ opt.name }}
            </button>
        </div>
        </Teleport>
    </div>
</template>

<script setup>
// 回報輸入框的貓名自動完成。打 @ 或全形 ＠ 跳出清單，選了直接貼上貓名。
// 只列貓，不列志工 —— 回報是寫給下一班看貓的狀況，不是點名。
//
// @ 純粹是喚出清單的按鍵，不留在文字裡，也不包任何符號 —— 回報就是一般的話，
// 只是不用自己打字、也不會打錯名字。
// 「被提及」欄（server/api/cats/timeline.get.js）本來就是搜名字的字串，
// 所以貼上去的名字一樣偵測得到。
const props = defineProps({
    modelValue: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    autosize: { type: Object, default: () => ({ minRows: 3, maxRows: 12 }) },
    // 這一班的貓 [{ cat_id, name }]，頁面上已經有了就不用另外抓
    cats: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'input', 'blur']);

const MAX = 8;
const TRIGGERS = ['@', '＠'];

const inputRef = ref(null);
const panelEl = ref(null);
const open = ref(false);
const active = ref(0);
const query = ref('');
const at = ref(-1); // 觸發的那個 @ 在字串裡的位置

const textareaEl = () => inputRef.value?.textarea || null;

// 選單要貼在游標那一行，不是整個框的下面（框有三行以上，貼底下會離很遠）。
// textarea 沒有辦法直接問「游標在第幾個像素」，所以複製一個樣式一模一樣的
// 隱藏 div，把游標前的文字放進去、後面接一個標記 span，量那個 span 的位置。
// 因為是 teleport 到 body 的 fixed 定位，算出來的要是「相對視窗」的座標。
const pos = reactive({ top: 0, left: 0, width: 0 });
const MIRROR_COPY = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'textTransform', 'wordSpacing', 'textIndent',
];

function place() {
    const el = textareaEl();
    if (!el) return;

    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const mirror = document.createElement('div');

    for (const key of MIRROR_COPY) mirror.style[key] = style[key];
    Object.assign(mirror.style, {
        position: 'absolute',
        visibility: 'hidden',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        top: '0',
        left: '0',
    });

    mirror.textContent = el.value.slice(0, el.selectionStart);
    const marker = document.createElement('span');
    // 空的 span 量不到位置，塞一個零寬字元撐著
    marker.textContent = '\u200b';
    mirror.appendChild(marker);

    document.body.appendChild(mirror);
    const top = marker.offsetTop;
    document.body.removeChild(mirror);

    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
    const borderTop = parseFloat(style.borderTopWidth) || 0;

    pos.left = rect.left;
    pos.width = rect.width;
    // 減掉 scrollTop：框自己捲過之後，游標的視覺位置會往上移
    pos.top = rect.top + borderTop + top - el.scrollTop + lineHeight + 4;
}

const candidates = computed(() => props.cats.map((c) => ({ key: c.cat_id, name: c.name })));

const options = computed(() => {
    const q = query.value.toLowerCase();
    const list = q ? candidates.value.filter((c) => c.name.toLowerCase().includes(q)) : candidates.value;
    return list.slice(0, MAX);
});

// 游標往前找觸發的 @：中間不能有空白或換行（那就不是在打標記了），
// 而且 @ 前面不能貼著字（避免 email、a@b 這種被誤判）
function detect() {
    const el = textareaEl();
    if (!el) return close();

    const caret = el.selectionStart;
    const text = props.modelValue.slice(0, caret);

    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (/\s/.test(ch)) break;
        if (!TRIGGERS.includes(ch)) continue;

        const before = i > 0 ? text[i - 1] : '';
        if (before && !/\s/.test(before)) break;

        at.value = i;
        query.value = text.slice(i + 1);
        active.value = 0;
        place();
        open.value = true;
        return;
    }
    close();
}

function close() {
    open.value = false;
    at.value = -1;
    query.value = '';
}

// fixed 定位不會跟著頁面捲動，開著的時候要自己重算。
// capture 是為了連內層捲動的容器也聽得到
const reposition = () => open.value && place();

onMounted(() => {
    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    window.addEventListener('resize', reposition, { passive: true });
});

onBeforeUnmount(() => {
    window.removeEventListener('scroll', reposition, { capture: true });
    window.removeEventListener('resize', reposition);
});

function onInput(value) {
    emit('update:modelValue', value);
    emit('input', value);
    nextTick(detect);
}

function choose(opt) {
    const el = textareaEl();
    const caret = el ? el.selectionStart : props.modelValue.length;
    const before = props.modelValue.slice(0, at.value);
    const after = props.modelValue.slice(caret);
    // @ 只是觸發鍵，選完只留名字本身 —— 後面不補空白，
    // 中文句子裡多一個空白（「餅乾 今天沒吃」）看起來很突兀
    const inserted = opt.name;

    const next = before + inserted + after;
    emit('update:modelValue', next);
    emit('input', next);
    close();

    nextTick(() => {
        const pos = before.length + inserted.length;
        el?.focus();
        el?.setSelectionRange(pos, pos);
    });
}

// 用方向鍵移動時，選到的項目要捲進可視範圍 —— 一次只看得到五列，
// 不捲的話按到第六個就看不到自己選在哪。
// block: 'nearest' 只捲剛好夠的距離，不會把清單跳到中間
function scrollActiveIntoView() {
    nextTick(() => panelEl.value?.children[active.value]?.scrollIntoView({ block: 'nearest' }));
}

function onKeydown(e) {
    // ⚠️ 中文輸入法正在選字時，Enter 與方向鍵是在操作候選字，不是在選我們的選項。
    // 不擋的話打「@餅」還沒選完字就按 Enter，會直接把選單的項目插進去。
    // isComposing 在部分瀏覽器／輸入法上不可靠，所以連 keyCode 229 一起擋
    if (e.isComposing || e.keyCode === 229) return;

    if (!open.value || !options.value.length) {
        // 選單沒開的時候，方向鍵與 Enter 要留給 textarea 本來的行為
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        active.value = (active.value + 1) % options.value.length;
        scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active.value = (active.value - 1 + options.value.length) % options.value.length;
        scrollActiveIntoView();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        choose(options.value[active.value]);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
    }
}

function onBlur(e) {
    close();
    emit('blur', e);
}
</script>

<style lang="scss" scoped>
// 一列的高度。選單高度直接由它算，改列高不用再去調 max-height
$row: 38px;

.mt-wrap {
    position: relative;
}

.mt-panel {
    position: fixed;
    z-index: 3000;
    // 一次看到五列，第六列以後用捲的。
    // 要加上下邊框那 2px —— 全站是 border-box，max-height 把邊框算進去，
    // 不補的話會差一點點，最後一列只露出一半
    max-height: $row * 5 + 2px;
    overflow-y: auto;
    border: 1px solid #e4e2e0;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 6px 18px rgb(0 0 0 / 12%);
}

.mt-opt {
    display: flex;
    align-items: center;
    width: 100%;
    height: $row;
    padding: 0 12px;
    border: 0;
    border-radius: 0;
    background: none;
    cursor: pointer;
    text-align: left;

    &.on,
    &:hover {
        background: #f3f6f8;
    }
}

.mt-opt {
    color: #303133;
    font-size: 14px;
}
</style>
