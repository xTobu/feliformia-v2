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
// 觀察管理（observe_items）：值班時要做的事。剛到（拍剩食、拍貓砂）在飲食如廁分頁、離開（拍留餐）在備餐分頁，
// 是貓名旁的膠囊，點了打勾；說明都是選填，只在後台看（規則在 composables/observeItems.js）。
// 離開組的「放風」是長期固定放風（2026-11-12 從飲食管理搬過來）：不是膠囊，期間內新開的班備餐的放風按鈕預設打開
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '觀察管理',
});
</script>
