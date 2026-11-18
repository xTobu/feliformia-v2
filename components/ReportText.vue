<template>
    <span class="report-text"><template
        v-for="(part, i) in parts"
        :key="i"
    ><span v-if="part.hit" class="rt-name">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></span>
</template>

<script setup>
// 回報內文，把指定的名字標成藍字。
//
// names 由呼叫端決定要標誰 —— 貓咪檔案只標「現在看的這隻貓」，
// 不是所有貓都標。整篇都標的話反而看不出這一班為什麼跟這隻貓有關。
//
// 名字是純文字（@ 只是輸入時的自動完成，不留任何符號），所以這裡拿字串比對。
// 好處是手打的名字一樣標得到；代價是改名之後舊回報就認不出來了。
const props = defineProps({
    text: { type: String, default: '' },
    // 要標起來的名字，例如 [貓名, ...暱稱]
    names: { type: Array, default: () => [] },
});

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pattern = computed(() => {
    // 一個字的名字不標 —— 在句子裡太容易誤中（「黑」「妹」）。
    // 長的排前面，比對時才不會先吃掉「餅」而漏了「餅乾」
    const list = [...new Set((props.names || []).map((n) => (n || '').trim()).filter((n) => n.length > 1))]
        .sort((a, b) => b.length - a.length);

    return list.length ? new RegExp(list.map(escape).join('|'), 'g') : null;
});

const parts = computed(() => {
    const text = props.text || '';
    const re = pattern.value;
    if (!re) return [{ text, hit: false }];

    const out = [];
    let last = 0;

    for (const m of text.matchAll(re)) {
        if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
        out.push({ text: m[0], hit: true });
        last = m.index + m[0].length;
    }

    if (last < text.length) out.push({ text: text.slice(last), hit: false });
    return out;
});
</script>

<style lang="scss" scoped>
// 跟換行一起保留：回報是 textarea 寫的
.report-text {
    white-space: pre-wrap;
    word-break: break-word;
}

.rt-name {
    color: #2a6f97;
    font-weight: 500;
}
</style>
