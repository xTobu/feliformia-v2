<template>
    <!-- 後台選單：由 header 的「後台」打開（layouts/default.vue），跟全站選單一樣從下方滑出。
         頁面清單在 composables/adminLinks.js，跟 /admin 首頁同一份 -->
    <el-drawer v-model="drawer" size="auto" class="site-menu-drawer" :with-header="false" direction="btt">
        <ul class="admin-menu">
            <template v-for="section in ADMIN_SECTIONS" :key="section.title">
                <li v-if="section.title" class="section">{{ section.title }}</li>
                <li v-for="link in section.links" :key="link.to" :class="{ active: route.path === link.to }" @click="goto(link.to)">
                    <span class="icon">{{ link.icon }}</span>
                    <span>{{ link.title }}</span>
                </li>
            </template>
            <li class="home" @click="goto('/admin')">
                <span class="icon">🛠️</span>
                <span>後台首頁</span>
            </li>
        </ul>
    </el-drawer>
</template>

<script setup>
const router = useRouter();
const route = useRoute();

// 開關狀態跟 header 的「後台」共用
const drawer = useState('admin-menu-open', () => false);

function goto(path) {
    if (path !== route.path) router.push(path);
    drawer.value = false;
}
</script>

<style lang="scss" scoped>
// 跟全站選單（SiteMenu）同樣的一列一項
.admin-menu {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid #ababab66;
        color: #5a5c5f;
        text-align: left;
        cursor: pointer;

        &.active {
            color: #6da2c2;
        }

        &.home {
            color: #657181;
        }
    }

    // 區塊小標題（新版值班記錄）：灰底小字，不能點
    .section {
        padding: 8px 16px;
        background: #f5f3f1;
        color: #8e8783;
        font-size: 13px;
        cursor: default;
    }

    .icon {
        width: 22px;
        font-size: 17px;
        text-align: center;
    }
}
</style>
