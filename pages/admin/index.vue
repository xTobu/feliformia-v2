<template>
    <ClientOnly>
        <div id="admin-index">
            <h1>管理後台</h1>

            <div class="menu-list">
                <NuxtLink to="/admin/cats" class="menu-item">
                    <div class="menu-icon">🐱</div>
                    <div class="menu-content">
                        <div class="menu-title">貓咪管理</div>
                        <div class="menu-desc">新增、編輯、排序貓咪資料</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>

                <NuxtLink to="/admin/notices" class="menu-item">
                    <div class="menu-icon">📋</div>
                    <div class="menu-content">
                        <div class="menu-title">餵藥及特殊飲食管理</div>
                        <div class="menu-desc">
                            新增、編輯、排序特殊照護事項
                        </div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>

                <NuxtLink to="/admin/vote-options" class="menu-item">
                    <div class="menu-icon">🗳️</div>
                    <div class="menu-content">
                        <div class="menu-title">投票選項管理</div>
                        <div class="menu-desc">新增、編輯、排序投票選項</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>

                <NuxtLink to="/admin/profiles" class="menu-item">
                    <div class="menu-icon">👥</div>
                    <div class="menu-content">
                        <div class="menu-title">志工一覽</div>
                        <div class="menu-desc">
                            查看志工名單、編輯名稱與權限
                        </div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>
            </div>

            <!-- 新版：跟上面的舊版並行，資料表各自獨立（cat_profiles、diet_items…），讓大家慢慢換過來 -->
            <div class="section-label">新版值班記錄（試行中）</div>
            <div class="menu-list">
                <NuxtLink to="/admin/cat-profiles" class="menu-item">
                    <div class="menu-icon">🐱</div>
                    <div class="menu-content">
                        <div class="menu-title">貓咪管理</div>
                        <div class="menu-desc">新增、編輯、排序貓咪與位置</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>

                <NuxtLink to="/admin/diet" class="menu-item">
                    <div class="menu-icon">🍚</div>
                    <div class="menu-content">
                        <div class="menu-title">飲食管理</div>
                        <div class="menu-desc">乾乾、罐罐、補充與其他飲食</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>

                <NuxtLink to="/admin/medical" class="menu-item">
                    <div class="menu-icon">💊</div>
                    <div class="menu-content">
                        <div class="menu-title">醫療管理</div>
                        <div class="menu-desc">吃藥、醫療與其他照護事項</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>

                <NuxtLink to="/admin/required" class="menu-item">
                    <div class="menu-icon">✅</div>
                    <div class="menu-content">
                        <div class="menu-title">值班收尾管理</div>
                        <div class="menu-desc">每一班離開前一定要勾完的事</div>
                    </div>
                    <div class="menu-arrow">→</div>
                </NuxtLink>
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
