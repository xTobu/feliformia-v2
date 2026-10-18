<template>
    <ClientOnly>
        <CareItemsAdmin
            title="值班收尾管理"
            table="required_items"
            :targeted="false"
            :main-field="{
                key: 'content',
                label: '收尾項目',
                placeholder: '例如：房間柵欄雙層扣',
            }"
            empty-group-text="尚未設定收尾項目"
        />
    </ClientOnly>
</template>

<script setup>
// 值班收尾管理（required_items）：這一班離開前一定要勾完的清單，不跟著貓。
// 值班記錄表的「收尾」分頁打勾，會記下誰、幾點勾的
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '值班收尾管理',
});
</script>
