<template>
    <ClientOnly>
        <div id="admin-index">
            <h1>管理後台</h1>

            <div class="menu-list">
                <NuxtLink to="/admin/vote-options" class="menu-item">
                    <div class="menu-icon">🗳️</div>
                    <div class="menu-content">
                        <div class="menu-title">投票選項管理</div>
                        <div class="menu-desc">新增、編輯、排序投票選項</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>

                <!-- 之後可以加更多管理頁面 -->
                <!--
                <NuxtLink to="/admin/volunteers" class="menu-item">
                    <div class="menu-icon">👥</div>
                    <div class="menu-content">
                        <div class="menu-title">志工管理</div>
                        <div class="menu-desc">管理志工資料與權限</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>
                -->
            </div>

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

    h1 {
        font-size: 18px;
        margin: 0 0 20px 0;
    }
}

.menu-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
