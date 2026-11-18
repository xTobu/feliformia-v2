<template>
    <div id="index">
        <h1>貓毛照護管理平台</h1>
        <NuxtLink v-if="isAdmin" to="/admin" class="admin-link">
            管理後台
        </NuxtLink>
        <!-- 2026-11-17 起首頁只放三個入口，不分區：新版值班記錄表、值班投票、行事曆。
             貓咪列表、舊版的飲食與如廁紀錄、餵藥及特殊飲食紀錄從首頁拿掉（右上選單還在） -->
        <div class="entries">
            <NuxtLink class="btn" to="/shift">值班紀錄</NuxtLink>
            <NuxtLink class="btn" to="/vote">值班投票</NuxtLink>
            <NuxtLink class="btn" to="/calendar">行事曆</NuxtLink>
        </div>
        <!-- <a
            href="/weekly"
            target="_blank"
            class="link"
            >卯咪健康週表</a
        >
        <a href="/weekly-medicine" target="_blank" class="link"
            >卯咪餵藥週表</a
        >
       
        <a
            href="https://docs.google.com/spreadsheets/d/1VcvoYrlp9nwFBrtnJSG4XV8035rh0w-Rxk_x1aKbDwA/edit#gid=0"
            target="_blank"
            class="link"
            >貓咪簡介 / 飲食 / 習慣需知</a
        > -->
        
    </div>
</template>

<script setup>
definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '貓毛照護管理平台',
});

const { isAdmin } = useProfile();
</script>

<style lang="scss" scoped>
#index {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    max-width: 450px;
    margin: 0 auto;
    padding: 0 20px 30px;
    a {
        display: block;
    }

    // 管理後台：標題下的淡藍小膠囊（只有管理員看得到）。蓋掉全域 a 的 display: block、底線、下邊距
    .admin-link {
        display: inline-block;
        margin: 0;
        padding: 2px 12px;
        border: 1px solid #b9d3e3;
        border-radius: 999px;
        background: #eef5f9;
        color: #4a7fa0;
        font-size: 13px;
        line-height: 20px;
        text-decoration: none;
    }

    .link {
        color: #b33a39; 
    }

    // 三個入口跟標題（管理後台連結）之間留白，原本由分區小標題撐開
    .entries {
        margin-top: 30px;
    }
    .or {
        font-size: 13px;
        color:rgb(152, 166, 184);
        margin: 30px 0 20px;
        text-align: center;
        position: relative;
        &::before, &::after {
            content: '';
            position: absolute;
            top: 50%;
            width: calc(50% - 40px);
            height: 1px;
            background-color:rgb(218, 225, 235);
        }
        &::before {
            left: 0;
        }
        &::after {
            right: 0;
        }
    }
}
</style>
