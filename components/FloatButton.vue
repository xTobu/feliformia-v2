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
                <li
                    v-for="todo in todos"
                    :key="todo.id"
                    :class="`type-${todo.type}`"
                >
                    <span class="todo-time">{{ todo.time }}</span>
                    <span class="todo-detail">
                        <span class="todo-tag">{{ todo.label }}</span>
                        <span class="todo-text">{{ todo.content }}</span>
                    </span>
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

const { get: getStorage, set: setStorage } = useLocalStorage();

// 今日活動提醒
const showDialogTodo = ref(false);
const todoLoading = ref(false);
const todos = ref([]);

// 自動跳出的門檻（台灣時間），跟每日 LINE 提醒同一個時間 ——
// 這個彈窗等於是沒綁 LINE 的人的備援。
const AUTO_OPEN_HOUR = 8;

// 存「最後一次自動跳出的日期」而不是布林值，換一天就自然失效
const AUTO_SHOWN_KEY = 'todo-auto-shown';

// 同一個 SPA session 裡只檢查一次，換頁時不要重打 API
const autoChecked = useState('todo-auto-checked', () => false);

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

// 每天第一次開站時自動跳出來一次。
//
// 條件全部成立才跳：這個 session 還沒檢查過、已經過了早上八點、
// 今天還沒自動跳過、而且他今天真的有活動。
//
// ⚠️ 沒有活動時**不標記** —— 不然早上八點開過一次（那時還沒人排班），
// 下午被加了一筆活動，就再也不會提醒他了。
//
// ⚠️ 手動從選單打開（openTodo）**不標記** —— 自己點開不應該消耗掉
// 今天自動跳出的那一次。
async function autoOpenTodo() {
    if (autoChecked.value) return;
    autoChecked.value = true;

    if (!useSupabaseUser().value) return;

    if ($dayjs().hour() < AUTO_OPEN_HOUR) return;

    const today = $dayjs().format('YYYY-MM-DD');
    if (getStorage(AUTO_SHOWN_KEY, null) === today) return;

    // 先靜默抓資料再決定開不開，避免跳出一個空的或還在載入的彈窗
    await GetTodos();
    if (!todos.value.length) return;

    setStorage(AUTO_SHOWN_KEY, today);
    showDialogTodo.value = true;
}

onMounted(autoOpenTodo);

// 每次開啟都重抓 —— 活動會變，不像注意事項可以快取。
// 回傳 [{ id, time, type, label, content }]，
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
    width: 40px;
    height: 40px;
    bottom: 25px;
    right: 25px;
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

    // 一筆一張卡。多筆活動時光靠留白分不太出來，給個邊界好掃讀
    li {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px 12px;
        border: 1px solid #e4e7ed;
        // 左側色條標出類型，跟 /calendar 的列表同一個做法
        border-left: 4px solid #dcdfe6;
        border-radius: 10px;
        background: #fff;

        & + li {
            margin-top: 10px;
        }
    }

    // 時間是這個提醒最關鍵的資訊（幾點要到），所以比內容更重
    .todo-time {
        color: #303133;
        font-size: 18px;
        font-weight: 600;
        line-height: 1.3;
        // 等寬數字，時間才不會左右跳動
        font-variant-numeric: tabular-nums;
    }

    .todo-detail {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 6px;
    }

    .todo-tag {
        flex-shrink: 0;
        padding: 0 6px;
        border-radius: 4px;
        font-size: 11px;
        line-height: 1.6;
        color: #303133;
        background: #f4f4f5;
    }

    .todo-text {
        color: #5a5c5f;
        font-size: 14px;
        line-height: 1.5;
        word-break: break-word;
    }
}

// 類型色票沿用 pages/calendar.vue 的 $type-colors（前景色 / 底色）。
// 新增活動類型時三個地方要一起補：calendar.vue 的 typeList、
// server/utils/constant.js 的 CalendarTypeLabel，還有這裡。
$todo-type-colors: (
    'volunteer': #409eff #ecf5ff,
    'supplies': #67c23a #f0f9eb,
    'dispatch': #e6a23c #fdf6ec,
    'medicine': #13c2c2 #e6fffb,
    'viewing': #eb2f96 #fff0f6,
    'post': #7c5cf0 #f1eefe,
    'other': #303133 #f4f4f5
);

@each $name, $pair in $todo-type-colors {
    $fg: nth($pair, 1);
    $bg: nth($pair, 2);

    .todo-list li.type-#{$name} {
        border-left-color: $fg;

        .todo-tag {
            color: $fg;
            background: $bg;
        }
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
