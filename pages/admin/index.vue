<template>
    <ClientOnly>
        <div id="admin-index">
            <h1>管理後台</h1>

            <!-- 頁面清單在 composables/adminLinks.js（header「後台」選單也用同一份） -->
            <template v-for="section in ADMIN_SECTIONS" :key="section.title">
                <div v-if="section.title" class="section-label">{{ section.title }}</div>
                <div class="menu-list">
                    <NuxtLink v-for="link in section.links" :key="link.to" :to="link.to" class="menu-item">
                        <div class="menu-icon">{{ link.icon }}</div>
                        <div class="menu-content">
                            <div class="menu-title">{{ link.title }}</div>
                            <div class="menu-desc">{{ link.desc }}</div>
                        </div>
                        <div class="menu-arrow">→</div>
                    </NuxtLink>
                </div>
            </template>

            <NuxtLink to="/" class="back-link">← 返回首頁</NuxtLink>
        </div>
    </ClientOnly>
</template>

<script setup>
definePageMeta({
    middleware: 'admin',
    ssr: false,
});

useHead({
    title: '管理後台',
});
</script>

<style lang="scss" scoped>
#admin-index {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    padding-bottom: 80px;
}

.menu-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

// 新版區塊的小標題：標題後面拉一條細線，跟上面的舊版分開
.section-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 28px 0 12px;
    font-size: 15px;
    font-weight: 500;
    color: #4a4542;
    text-align: left;

    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #d8d4d1;
    }
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;

    &:hover {
        border-color: #b33a39;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
}

.menu-icon {
    font-size: 28px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 10px;
}

.menu-content {
    flex: 1;
}

.menu-title {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 4px;
}

.menu-desc {
    font-size: 13px;
    color: #888;
}

.menu-arrow {
    font-size: 18px;
    color: #ccc;
}

.back-link {
    display: inline-block;
    margin-top: 24px;
    color: #657181;
    font-size: 14px;
    text-decoration: none;

    &:hover {
        color: #b33a39;
    }
}
</style>
