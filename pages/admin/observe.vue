<template>
    <ClientOnly>
        <CareItemsAdmin
            title="觀察管理"
            table="observe_items"
            :categories="OBSERVE_CATEGORIES"
            :category-groups="OBSERVE_GROUPS"
            title-is-category
            :main-field="{
                key: 'content',
                label: '說明',
                placeholder: '例如：看罐罐剩多少',
                optionalFor: OBSERVE_CATEGORIES,
                optionalPlaceholder: '例如：看罐罐剩多少（選填）',
            }"
            empty-group-text="沒有要拍的"
            :with-photos="false"
        />
    </ClientOnly>
</template>

<script setup>
// 觀察管理（observe_items）：值班時要拍照的事。剛到（拍剩食、拍貓砂）在觀察分頁提醒，
// 離開（拍留餐）在備餐分頁提醒。不用打勾：這一班、這隻貓、那個分頁的照片有對應類型
// （拍剩食→剩食、拍貓砂→貓砂、拍留餐→留餐）就算完成，說明都是選填，
// 沒拍的算進那個分頁的數字，下一班也看得到（規則在 composables/observeItems.js）
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '觀察管理',
});
</script>
