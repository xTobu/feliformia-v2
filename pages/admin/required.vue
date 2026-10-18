<template>
    <ClientOnly>
        <CareItemsAdmin
            title="值班收尾管理"
            table="required_items"
            with-house
            :main-field="{
                key: 'content',
                label: '收尾項目',
                placeholder: '例如：房間柵欄雙層扣',
            }"
        />
    </ClientOnly>
</template>

<script setup>
// 值班收尾管理（required_items）：這一班離開前一定要勾完的清單。
// 對象可以是某隻貓、全員、貓屋（整間屋子）或某個位置；每一項整班勾一次（全員也是），
// 值班記錄表的「收尾」分頁打勾，會記下誰、幾點勾的
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '值班收尾管理',
});
</script>
