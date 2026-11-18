<template>
    <ClientOnly>
        <CareItemsAdmin
            title="觀察管理"
            table="observe_items"
            :categories="OBSERVE_PRESETS"
            category-free
            :tab-field="{
                key: 'tab',
                label: '分頁',
                options: OBSERVE_TABS,
                lockedFor: OBSERVE_TAB_LOCKED,
            }"
            title-is-category
            :main-field="{
                key: 'content',
                label: '說明',
                placeholder: '例如：看罐罐剩多少',
                optionalFor: true,
                optionalPlaceholder: '例如：看罐罐剩多少（選填）',
            }"
            empty-group-text="沒有要拍的"
            :with-photos="false"
        />
    </ClientOnly>
</template>

<script setup>
// 觀察管理（observe_items）：值班時要做的事，是貓名旁的膠囊，點了打勾。
// 類別可以自己新增（下拉的四個只是建議），每一項自己選要出現在哪個分頁（飲食如廁／備餐）。
// 說明都是選填，只在後台看。規則在 composables/observeItems.js。
// 「放風」是特例：不是膠囊，期間內新開的班備餐的放風按鈕預設打開，所以分頁鎖在備餐
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '觀察管理',
});
</script>
