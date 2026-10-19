<template>
    <ClientOnly>
        <CareItemsAdmin
            title="醫療管理"
            table="medical_items"
            :categories="['醫療', '餵藥', '外用']"
            :main-field="{
                key: 'treatment',
                label: '事項',
                placeholder: '例如：眼藥水左眼一滴',
            }"
            :reason-field="{
                key: 'reason',
                label: '原因',
                placeholder: '例如：結膜炎',
            }"
        />
    </ClientOnly>
</template>

<script setup>
// 醫療管理（medical_items）：醫療、餵藥（親手讓牠吃下去）、外用（擦、點、噴）。
// 值班記錄表都在醫療分頁，要打勾。拌進飯裡的藥歸飲食管理的「隨餐藥」
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '醫療管理',
});
</script>
