<template>
    <ClientOnly>
        <CareItemsAdmin
            title="醫療管理"
            table="medical_items"
            :categories="['醫療', '吃藥']"
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
// 醫療管理（medical_items）。吃藥在值班記錄表的吃藥分頁，醫療在醫療分頁，都要打勾
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '醫療管理',
});
</script>
