<template>
    <div>
        <button class="btn__float" @click="drawer = !drawer">
            <img v-if="!drawer" src="~/assets/img/ic-menu.svg" alt="" />
            <img v-else src="~/assets/img/ic-close.svg" alt="" />
        </button>

        <el-drawer
            v-model="drawer"
            size="40%"
            :with-header="false"
            direction="btt"
        >
            <div class="drawer__content">
                <ul>
                    <li class="red" @click="toggleDialogNotice()">
                        # 注意事項
                    </li>
                    <li class="red" @click="open('/regular')">
                        # 飲食及如廁紀錄
                    </li>
                    <li class="red" @click="open('/medicine')">
                        # 餵藥及特殊飲食表
                    </li>
                    <li @click="open('/weekly')">卯咪飲食週表</li>
                    <li @click="open('/weekly-medicine')">卯咪餵藥週表</li>
                    <li
                        @click="
                            open(
                                'https://docs.google.com/spreadsheets/d/1VcvoYrlp9nwFBrtnJSG4XV8035rh0w-Rxk_x1aKbDwA/edit#gid=0'
                            )
                        "
                    >
                        貓咪簡介 / 飲食 / 習慣需知
                    </li>
                    <li @click="goto('/')">首頁</li>
                </ul>
            </div>
        </el-drawer>

        <el-dialog
            v-model="showDialogMind"
            title="注意事項"
            width="90%"
            :show-close="false"
        >
            <p v-if="minds.length === 0">LOADING...</p>
            <div
                class="md"
                v-for="(mind, index) in minds"
                :key="`${mind.Id}${index}`"
                v-html="markdownToHtml(mind.note)"
            ></div>

            <template #footer>
                <span class="dialog-footer">
                    <button @click="toggleDialogNotice()">關閉</button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { marked } from 'marked';

const router = useRouter();
const route = useRoute();

const drawer = ref(false);
const showDialogMind = ref(false);
const minds = ref([]);

function open(url) {
    window.open(url, '_blank').focus();
    drawer.value = false;
}

function goto(path) {
    if (path !== route.path) {
        router.push(path);
    }
    drawer.value = false;
}

function markdownToHtml(markdown) {
    return marked(markdown);
}

function toggleDialogNotice() {
    showDialogMind.value = !showDialogMind.value;
    if (minds.value.length === 0) {
        GetNotice();
    }
}

async function GetNotice() {
    try {
        const data = await $fetch('/api/mind/list');
        minds.value = data;
    } catch (e) {
        console.error('GetNotice error:', e);
    }
}
</script>

<style lang="scss" scoped>
.btn__float {
    cursor: pointer;
    position: fixed;
    width: 50px;
    height: 50px;
    bottom: 30px;
    right: 30px;
    color: transparent;
    border-radius: 50px;
    text-align: center;
    padding: 0;
    border: 0;
    z-index: 2099;
    transition: bottom 0.4s;

    > img {
        width: 100%;
    }
}

.drawer__content {
    width: 100%;
    max-width: 450px;
    margin: 0 auto;
    padding: 0px 32px;

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
    }

    li {
        cursor: pointer;
        text-align: left;
        color: #5a5c5f;
        padding: 16px;
        border-bottom: 1px solid #ababab66;

        &.red {
            color: #b43a39;
        }
    }
}

.md {
    text-align: left;
}

.dialog-footer {
    > button {
        width: 80px;
        height: 40px;
        border-radius: 10px;
        background-color: #b43a39;
        font-size: 14px;
        color: #fff;
    }
}
</style>
