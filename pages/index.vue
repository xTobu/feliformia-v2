<template>
    <div id="index">
        <h1>貓毛輪值線上表單</h1>
        <NuxtLink v-if="isAdmin" to="/admin" class="admin-link">
            管理後台
        </NuxtLink>
        <NuxtLink class="btn" to="/regular">飲食及如廁紀錄</NuxtLink>
        <NuxtLink class="btn" to="/medicine">餵藥及特殊飲食紀錄</NuxtLink> 
        <div class="or">OR</div>
        <NuxtLink class="btn" to="/vote">值班投票</NuxtLink>
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
    <FloatButton />
</template>

<script setup>
definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '貓毛輪值線上表單',
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
    padding: 20px 20px;
    a {
        display: block;
    }

    .admin-link {
        margin: -10px 0 24px;
        font-size: 13px;
        color: #6da2c2;
    }

    .link {
        color: #b33a39; 
    }
    .or {
        font-size: 13px;
        color:rgb(152, 166, 184);
        margin: 20px 0;
        text-align: center;
        position: relative;
        &::before, &::after {
            content: '';
            position: absolute;
            top: 50%;
            width: calc(50% - 20px);
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
