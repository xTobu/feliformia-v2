<template>
    <div>
        <div class="user-bar" v-if="user">
            <NuxtLink to="/" class="site-name">Feliformia</NuxtLink>
            <div class="user-actions">
                <span class="user-name">Hi, {{ displayName }}</span>
                <!-- 後台：打開後台選單（components/AdminMenu.vue），從下方滑出 -->
                <button v-if="isAdmin" type="button" class="admin-tag" @click="adminMenuOpen = !adminMenuOpen">後台</button>
                <!-- 設定、登出都收在選單裡（components/SiteMenu.vue） -->
                <button class="menu-btn" aria-label="選單" @click="menuOpen = !menuOpen">
                    <Icon icon="mdi:menu" width="18" />
                </button>
            </div>
        </div>
        <div class="wrapper">
            <slot />
        </div>
        <Footer />

        <!-- 掛在 layout 而不是各頁面，這樣每一頁都有選單，
             「今日活動提醒」的自動跳出也才涵蓋得到整站。
             未登入時不掛 —— 它裡面的 API 都需要身分。 -->
        <SiteMenu v-if="user" />
        <AdminMenu v-if="user && isAdmin" />
    </div>
</template>

<script setup>
import Footer from '~/components/Footer.vue';
import SiteMenu from '~/components/SiteMenu.vue';
import { Icon } from '@iconify/vue';

const user = useSupabaseUser();
const { displayName, isAdmin, loadProfile } = useProfile();
const menuOpen = useState('site-menu-open', () => false);
const adminMenuOpen = useState('admin-menu-open', () => false);

onMounted(() => {
    if (user.value) {
        loadProfile();
    }
});

watch(user, (newUser) => {
    if (newUser) {
        loadProfile();
    }
});
</script>

<style lang="scss">
$red: #b33a39;
$grey: #657181;
$blue: #6da2c2;
$light_grey: #f5f7f8;
$brown: #8e8783;

.user-bar {
    background: #f5f7f8;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e0e0e0;

    .site-name {
        font-size: 14px;
        font-weight: 600;
        color: $blue;
        text-decoration: none;
        margin-bottom: 0;
    }

    .user-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .user-name {
        font-size: 13px;
        color: $grey;
    }

    // 管理員才看得到的後台入口，跟選單鈕同色系，不搶眼。全域 button 有 width: 100%、高度，這裡蓋回來
    .admin-tag {
        width: auto;
        height: auto;
        margin: 0;
        cursor: pointer;
        padding: 3px 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        color: $grey;
        font-size: 12px;
        line-height: 1.5;
        text-decoration: none;

        &:hover {
            background: #f0f0f0;
        }
    }

    // 全域 button 有 width: 100%、padding，這裡蓋回來
    .menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        color: $grey;
        cursor: pointer;

        &:hover {
            background: #f0f0f0;
        }
    }
}

body,
html {
    padding-right: 0px !important;
    height: initial !important;
    width: 100%;
    overflow-x: hidden;
    font-family: 'Noto Sans TC', 'Helvetica Neue', Helvetica, sans-serif;
    text-align: center;
    font-size: 15px;
    min-height: 100vh;
    position: relative;
    margin: 0;
}

* {
    box-sizing: border-box;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0);
}

.wrapper {
    width: 100%;
    max-width: 450px;
    margin: 0 auto;
    padding: 16px;
}

.W20 {
    width: 20%;
}
.W25 {
    width: 25%;
}
.W33 {
    width: 33%;
}
.W50 {
    width: 50%;
}
.W67 {
    width: 67%;
}
.W75 {
    width: 75%;
}
.W100 {
    width: 100%;
}

.f12 {
    font-size: 12px;
}
.f15 {
    font-size: 15px;
    line-height: 1.5;
}
.f19 {
    font-size: 19px;
    line-height: 1.3;
}

.bg_cover {
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
}

.f_white {
    color: #fff;
}
.f_grey {
    color: $grey;
}
.f_red {
    color: $red;
}
.f_blue {
    color: $blue;
}
.bg_red {
    background-color: $red;
}
.bg_blue {
    background-color: $blue;
}
.f_b {
    font-weight: bold;
}
.t_center {
    text-align: center;
}
.t_left {
    text-align: left;
}

.d_flex {
    display: flex !important;
    flex-wrap: wrap;
    justify-content: space-between;
    .W50 {
        width: calc(50% - 10px) !important;
        margin-bottom: 16px;
    }
    &.j_start {
        justify-content: start;
    }
}

.d_none {
    display: none;
}
.mb0 {
    margin-bottom: 0 !important;
}
.mb20 {
    margin-bottom: 20px;
}
.mb {
    display: none;
}
.pc {
    display: inline-block;
}
.ham {
    display: none;
}

form {
    padding-bottom: 30px;
}

button,
input,
select {
    -webkit-appearance: none;
    background-color: #fff;
    border: none;
    border-radius: 4px;
    border: 1px solid #ccc;
    padding: 0 10px;
    width: 100%;
    color: #606266;
    font-size: 14px;
    &:focus,
    &.active {
        outline: none;
    }
}


a {
    text-decoration: underline;
    margin-bottom: 15px;
    color: $red;
}

.btn {
    background-color: $red;
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    padding: 0 20px;
    line-height: 50px;
    text-decoration: none;
    margin-bottom: 20px;
    border-radius: 30px;
    border: none;
    cursor: pointer;
}

.record_item {
    align-items: center;
    padding: 32px 25px 10px 10px;
    border-bottom: 1px solid #ccc;
    position: relative;
    &:nth-child(even) {
        background-color: #f4f5f5;
    }
    &:first-child {
        border-top: 1px solid #ccc;
    }
    .name {
        display: inline-block;
        padding: 0 13px;
        position: absolute;
        left: 0;
        top: 0;
        background-color: #8e8783;
        color: #fff;
        font-size: 13px;
        line-height: 20px;
        height: 23px;
    }

    .warning {
        position: absolute;
        height: 20px;
        left: -10px;
        top: -10px;
        z-index: 1;
    }

    .detail {
        width: 100%;
        > div {
            margin-bottom: 10px;
        }
        > .d_flex {
            p {
                width: 40px;
            }
            > div {
                width: calc(100% - 45px);
            }
        }
    }
}

.ps {
    text-align: left;
    line-height: 1.5;
    padding: 10px 0;
}

// Element Plus 樣式覆蓋

.el-dialog__header {
    span {
        font-weight: 500;
        color: #6da2c2;
    }
}

.el-dialog__footer {
    text-align: center !important;
}
.el-select-dropdown {
    max-width: 70%;
}
.el-select-dropdown__item {
    text-align: left;
}

@media screen and (max-width: 600px) {
    .mb {
        display: inline-block;
    }
    .pc {
        display: none;
    }
}
</style>
