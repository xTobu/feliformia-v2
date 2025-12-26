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
        <NuxtLink v-if="isAdmin" to="/admin" class="admin-link">
            管理後台
        </NuxtLink>
    </div>
</template>

<script setup>
definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '貓毛輪值線上表單',
});

const user = useSupabaseUser();
const supabase = useSupabaseClient();
const isAdmin = ref(false);

// 取得 user id（相容不同版本）
const getUserId = () => user.value?.id || user.value?.sub;

async function checkAdmin() {
    const userId = getUserId();
    if (!userId) {
        isAdmin.value = false;
        return;
    }

    const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

    isAdmin.value = data?.is_admin || false;
}

onMounted(() => {
    if (getUserId()) {
        checkAdmin();
    }
});

watch(user, (newUser) => {
    if (newUser?.id || newUser?.sub) {
        checkAdmin();
    } else {
        isAdmin.value = false;
    }
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

    .admin-link {
        margin-top: 40px;
        font-size: 13px;
        color: #657181;
    }
}
</style>
