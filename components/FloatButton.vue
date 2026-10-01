<template>
        <button class="btn__float" @click="drawer = !drawer">
            <img v-if="!drawer" src="~/assets/img/ic-menu.svg" alt="" />
            <img v-else src="~/assets/img/ic-close.svg" alt="" />
        </button>

        <el-drawer
            v-model="drawer"
            size="450px"
            :with-header="false"
            direction="btt"
        >
            <div class="drawer__content">
                <ul>
                    <!-- <li class="red" @click="toggleDialogNotice()">
                        # 注意事項
                    </li> -->
 
                    <li class="red" @click="open('/regular')">
                        <Icon icon="mdi:silverware-fork-knife" width="17" /> <span>飲食與如廁紀錄</span>
                    </li>
                    <li class="red" @click="open('/medicine')">
                        <Icon icon="fa-solid:syringe" width="17" /> <span>用藥與特殊照護</span>
                    </li>
                    <li class="red" @click="goto('/vote')"><Icon icon="mdi:vote" width="17" /> <span>值班投票</span></li>
                    <li class="red" @click="openTodo"><Icon icon="mdi:bell-ring" width="17" /> <span>今日活動提醒</span></li>
                    <li @click="open('/weekly')"><img src="~/assets/img/calendar_02.svg" alt="" /> <span>卯咪飲食週表</span></li>
                    <li @click="open('/weekly-medicine')"><img src="~/assets/img/calendar_01.svg" alt="" /> <span>卯咪餵藥週表</span></li>
                    <li
                        @click="
                            open(
                                'https://docs.google.com/spreadsheets/d/1VcvoYrlp9nwFBrtnJSG4XV8035rh0w-Rxk_x1aKbDwA/edit#gid=0'
                            )
                        "
                    >
                        <Icon icon="mdi:information" width="17" /> <span>貓咪簡介 / 飲食 / 習慣需知</span>
                    </li>
                    <li class="blue" @click="goto('/')"><Icon icon="mdi:home" width="17" /> <span>首頁</span></li>
                </ul>
            </div>
        </el-drawer>

        <el-dialog
            v-model="showDialogMind"
            title="注意事項"
            class="mind-dialog"
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

        <!-- 今日活動提醒。名單規則與每日 LINE 提醒共用（server/utils/roster.js），
             所以這裡看到的跟大哥私訊的內容一定一致 -->
        <el-dialog
            v-model="showDialogTodo"
            :title="`🔔 今日活動 ${todayText}`"
            class="todo-dialog"
            width="90%"
            :show-close="false"
        >
            <p class="todo-state" v-if="todoLoading">載入中...</p>
            <p class="todo-state" v-else-if="!todos.length">今天您沒有活動</p>

            <ul class="todo-list" v-else>
                <li v-for="todo in todos" :key="todo.id">
                    <span class="todo-time">{{ todo.time }}</span>
                    <span class="todo-text">{{ todo.text }}</span>
                </li>
            </ul>

            <template #footer>
                <span class="dialog-footer">
                    <button @click="showDialogTodo = false">關閉</button>
                </span>
            </template>
        </el-dialog>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { marked } from 'marked';

const router = useRouter();
const route = useRoute();

const { $dayjs } = useNuxtApp();

const drawer = ref(false);
const showDialogMind = ref(false);
const minds = ref([]);

// 今日待辦提醒
const showDialogTodo = ref(false);
const todoLoading = ref(false);
const todos = ref([]);

// 放標題上，彈窗開著跨過午夜時才不會搞錯是哪一天
const todayText = computed(() => $dayjs().format('MM/DD(dd)'));

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

function openTodo() {
    // 先收抽屜再開彈窗，不然兩層疊在一起
    drawer.value = false;
    showDialogTodo.value = true;
    GetTodos();
}

// 每次開啟都重抓 —— 活動會變，不像注意事項可以快取。
// 回傳 [{ id, time: '09:00 ~ 09:15', text: '[體驗] 內容' }]，
// 只包含「我」有份的活動（負責人、或當天早／晚班的值班人員）。
async function GetTodos() {
    todoLoading.value = true;

    try {
        todos.value = await $fetch('/api/calendar/today');
    } catch (e) {
        console.error('GetTodos error:', e);
        todos.value = [];
    } finally {
        todoLoading.value = false;
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
    margin: 0 auto;
    padding: 0px;

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
        display: flex;
        align-items: center;
        gap: 10px;
        color: #5a5c5f;
        padding: 16px;
        border-bottom: 1px solid #ababab66;

        &.red {
            color: #b43a39;
        }

        &.pink {
            color: #e8a598;
        }
        &.blue {
            color: #6da2c2;
        }
    }
}

.md {
    text-align: left;
}

.todo-state {
    margin: 0;
    padding: 24px 0;
    color: #c0c4cc;
    font-size: 14px;
    text-align: center;
}

.todo-list {
    list-style: none;
    margin: 0;
    padding: 0;
    text-align: left;

    li {
        display: flex;
        flex-direction: column;
        gap: 2px;

        // 用留白分隔，不用分隔線 —— 跟大哥私訊的排版一致
        & + li {
            margin-top: 18px;
        }
    }

    .todo-time {
        color: #657181;
        font-size: 13px;
        // 等寬數字，時間才不會左右跳動
        font-variant-numeric: tabular-nums;
    }

    .todo-text {
        color: #5a5c5f;
        word-break: break-word;
    }
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

<style lang="scss">
/* el-dialog 會 teleport 到 body，scoped 的樣式選不到 .el-dialog 本身，
   所以這塊不加 scoped。class 名稱夠獨特，不會影響其他 dialog。
   兩個 dialog 都是 width="90%"，手機維持滿版，桌機才封頂。 */

/* 短行清單，窄一點比較集中 */
.todo-dialog {
    max-width: 400px;
}

/* 放 markdown 長文，太窄會讓每行字數太少不好讀 */
.mind-dialog {
    max-width: 560px;
}
</style>
