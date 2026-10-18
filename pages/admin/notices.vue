<template>
    <ClientOnly>
        <CareItemsAdmin
            title="特殊醫療管理"
            :categories="['medical', 'other']"
            non-cat-position="bottom"
            empty-text="尚無貓咪"
            :placeholders="{
                treatment: '例如：眼藥水左眼一滴',
                reason: '例如：結膜炎',
            }"
        />
    </ClientOnly>
</template>

<script setup>
// 網址沿用 /admin/notices，舊書籤不會壞
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '特殊醫療管理',
});
</script>
