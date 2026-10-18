<template>
    <ClientOnly>
        <CareItemsAdmin
            title="醫療管理"
            :categories="['medication', 'medical', 'other']"
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
// 新版醫療管理（只管醫療、其他）。舊的 /admin/notices（餵藥及特殊飲食管理）保留原樣
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '醫療管理',
});
</script>
