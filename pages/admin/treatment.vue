<template>
    <ClientOnly>
        <CareItemsAdmin
            title="醫療管理"
            :categories="['medical', 'medication', 'other']"
            empty-text="尚無貓咪"
            :placeholders="{
                treatment: '例如：眼藥水左眼一滴',
                reason: '例如：結膜炎',
            }"
        />
    </ClientOnly>
</template>

<script setup>
// 醫療管理（吃藥、醫療、其他）。飲食的部分在 /admin/diet
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '醫療管理',
});
</script>
