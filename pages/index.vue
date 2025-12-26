<template>
    <div id="index">
        <h1 class="f_grey">貓毛輪值線上表單</h1>
        <NuxtLink class="btn" to="/regular">飲食及如廁紀錄</NuxtLink>
        <NuxtLink class="btn" to="/medicine">餵藥及特殊飲食紀錄</NuxtLink>
        <NuxtLink class="btn" to="/vote">值班投票</NuxtLink>
        <a
            href="/weekly"
            target="_blank"
            style="color: #b33a39; margin-top: 40px"
            >卯咪健康週表</a
        >
        <a href="/weekly-medicine" target="_blank" style="color: #b33a39"
            >卯咪餵藥週表</a
        >
        <a
            href="https://docs.google.com/spreadsheets/d/1VcvoYrlp9nwFBrtnJSG4XV8035rh0w-Rxk_x1aKbDwA/edit#gid=0"
            target="_blank"
            style="color: #b33a39"
            >貓咪簡介 / 飲食 / 習慣需知</a
        >
    </div>
</template>

<script setup>
definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '貓毛輪值線上表單',
});
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
}
</style>
