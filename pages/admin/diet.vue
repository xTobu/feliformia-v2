<template>
    <ClientOnly>
        <CareItemsAdmin
            title="飲食與待辦"
            :categories="['dry', 'wet', 'supplement', 'diet_other', 'todo']"
            empty-text="尚無貓咪"
            empty-group-text="尚未設定飲食"
            :labels="{ treatment: '內容', reason: '備註' }"
            :placeholders="{
                treatment: '例如：腎處方 1.5 匙＋低磷罐',
                reason: '例如：腎指數偏高',
            }"
        />
    </ClientOnly>
</template>

<script setup>
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '飲食與待辦',
});
</script>
