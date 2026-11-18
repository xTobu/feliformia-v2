<template>
    <ClientOnly>
        <CareItemsAdmin
            title="飲食管理"
            table="diet_items"
            :categories="['乾乾', '罐罐', '補充品', '其他']"
            :main-field="{
                key: 'content',
                label: '內容',
                placeholder: '例如：K36 早 2 匙，晚 3 匙',
            }"
            empty-group-text="尚未設定飲食"
        />
    </ClientOnly>
</template>

<script setup>
// 飲食管理（diet_items）。值班記錄表的備餐分頁只看、不打勾。
// 「隨餐藥」2026-11-12 搬到醫療管理（備餐分頁照樣列，跟醫療照護分頁連動打勾）。
// 「放風」（長期固定放風）2026-11-12 搬到觀察管理的離開組
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '飲食管理',
});
</script>
