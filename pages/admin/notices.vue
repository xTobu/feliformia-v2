<template>
    <ClientOnly>
        <CareItemsAdmin
            title="特殊醫療管理"
            :categories="['medical', 'other']"
            empty-text="尚無特殊醫療事項"
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
