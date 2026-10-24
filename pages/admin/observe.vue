<template>
    <ClientOnly>
        <CareItemsAdmin
            title="觀察管理"
            table="observe_items"
            :categories="OBSERVE_CATEGORIES"
            :main-field="{
                key: 'content',
                label: '說明',
                placeholder: '例如：拍左眼分泌物',
                optionalFor: ['拍剩食', '拍貓砂'],
                optionalPlaceholder: '例如：看罐罐剩多少（選填）',
            }"
            empty-group-text="沒有要拍的"
        />
    </ClientOnly>
</template>

<script setup>
// 觀察管理（observe_items）：剛到班時要拍照的事，在值班記錄表的觀察分頁提醒。
// 不用打勾：這一班、這隻貓的觀察照片有對應類型（拍剩食→剩食、拍貓砂→貓砂、其他→任何一張）就算完成，
// 沒拍的算進觀察分頁的數字，下一班也看得到（規則在 composables/observeItems.js）
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '觀察管理',
});
</script>
