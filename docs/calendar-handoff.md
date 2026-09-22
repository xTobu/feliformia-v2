# 行事曆 — 交接文件

`/calendar`（[pages/calendar.vue](../pages/calendar.vue)）

目前狀態：**已接 Supabase，功能完整可用。**
（第一版由前一位工程師完成純切版，後端與串接已補上。）

---

## 1. 這頁是什麼

給志工登記「非值班類」的活動與備註：志工體驗、物資贈送、出車、發文、其他。
月曆上一眼看得出哪幾天有活動、以及**哪些活動還沒有人**（紅色虛線框）。

畫面分兩塊：

- 上半部 `el-calendar` 月曆，每格顯示當天所有活動的色塊
- 下半部表單，新增／編輯／刪除單筆活動

---

## 2. 已確認的決策（含原因）

| 決策 | 原因 |
|---|---|
| 用 Element Plus 的 `el-calendar`，**不裝 ant-design-vue** | 專案只有 element-plus 2.13。多裝一套 UI 庫會多 300KB+ 且兩套 reset 樣式會打架。原始需求是想用 antd 的行事曆元件，評估後改用 el-calendar |
| **不發 LINE 通知**，只顯示名單 | 第一版先確認版面與流程。`/api/line/message/push` 已存在，之後要接很容易 |
| 讀 `votes` 走 supabase client，寫 `calendar_events` 走 server API | 讀取 `votes` 的 RLS 本來就開給登入者（`/vote` 也是這樣讀），不必多包一層 API。寫入要擋未登入、要 service key，走 server API 比較穩 |
| 結束時間**只能選開始時間之後** | `el-time-select` 的 `min-time` 綁 `formData.timeStart`。改了開始時間後若結束時間變得不合法，`onTimeStartChange()` 會清掉它。（`/vote` 沒擋，但這頁擋） |
| 活動時間 06:00–23:45，15 分鐘刻度 | 不需要精準到分鐘，也沒人半夜來貓屋。用 `el-time-select` 的 `start="06:00"` + `step="00:15"` |
| 早晚班名單是**算出來的，不存** | 名單來源是 `votes`，存一份會不同步 |

---

## 3. 資料結構

一筆活動（前端形狀）：

```js
{
    recordId: 'b1f2...',              // calendar_events.id (uuid)
    date: '2026-09-03',               // YYYY-MM-DD
    timeStart: '18:00',               // HH:mm，15 分鐘刻度
    timeEnd: '20:00',
    type: 'volunteer',                // 見下表
    notifyRoles: ['morning'],         // 'morning' | 'night' | 'owner' 的子集合
    owners: [],                       // profiles.id 的陣列，只有 notifyRoles 含 'owner' 才有值
    content: '虎嚕媽打掃體驗',          // 必填
}
```

### 類型 `type`

| value | label | 顏色 | 實務上通常掛 |
|---|---|---|---|
| `volunteer` | 體驗 | `#409eff` 藍 | 早班／晚班 |
| `supplies` | 物資 | `#67c23a` 綠 | 早班／晚班 |
| `dispatch` | 出車 | `#e6a23c` 橘 | 負責人 |
| `post` | 社群 | `#7c5cf0` 紫 | 負責人 |
| `other` | 其他 | `#303133` 黑 | 混合 |

> label 改過名（志工體驗→體驗、物資贈送→物資、發文→社群），
> **但 `value` 沒動** —— DB 存的還是 `volunteer` / `supplies` / `post`，
> 所以只是顯示文字，不需要搬資料。

體驗與物資多半只掛早晚班，而排班要等日期接近才會催投票，
所以這兩類**經常處於「還沒有人」的狀態**，月曆上會是紅色虛線框。這是正常的，不是 bug。

### 提示對象 `notifyRoles`

畫面上這欄的標題是「**活動人員**」。三個角色各自獨立，可複選。
表單下方的區塊是 `v-if` 綁 `notifyRoles`：

- 只勾「負責人」→ 不會出現早晚班資訊
- 只勾早晚班 → 不會出現負責人欄位

`owners` 只在勾了 `'owner'` 時才存值，送出時會清成 `[]`（`Submit()` 的 `payload`）。
**可複選**，存的是 `profiles.id` 陣列而不是名字 —— 志工改暱稱時不會對不上。
名單來自 `/api/volunteer/list`（已過濾 `is_active === false`）。

> `owners` 在 DB 是 `jsonb` 不是 `uuid[]`，跟旁邊的 `notify_roles` 一致。
> jsonb 沒有外鍵保護，但 id 只會從 `/api/volunteer/list` 來，
> 顯示時對 `userMap` 查，查不到會顯示「未命名」而不是壞掉。


---

## 4. 核心邏輯

### 4.1 `roster(date, shift)` — 當班名單

本頁最核心的函式。回傳字串陣列，格式 `選項名稱 - 暱稱`，例如 `['值班 - 小貝', '快閃/協助 - Summer']`。

照 [pages/vote.vue](../pages/vote.vue) 的算法從 `votes` 撈：

```js
// votes.data[date][shift][optionId].checked === true 的人
// option 名稱來自 vote_options（依 sort_order 排序、is_active）
// 要跳過 is_pass 的人
// 日期直接用 data 的 key，不要比對 week_start（原因見 7.4）
```

> ⚠️ `votes` **沒有 nickname 欄位**（舊版 database.md 寫錯了，已修正）。
> 名字要用 `user_id` 對 `/api/users/list` 建出來的 `userMap`，
> 跟 `/vote` 的 `getNickname()` 同一套做法。
> `volunteerList` 不能拿來做這件事 —— 它過濾掉了停用的志工，
> 而停用的志工可能還留著舊投票。

`votes` 表面上是以 `week_start` 分列的週資料，但**實際日期在 `data` 的 key 上**，
`roster()` 只看 key、不比對 `week_start`（理由見 [7.4](#74-votesweek_start-有不少是星期二不能拿來精準比對)）。
`loadVotes()` 只負責用區間把可能相關的列撈進來，前後各多抓一週當緩衝。

`vote_options` 有 `shift` 欄位（`'both' | 'morning' | 'night'`），缺值時視同 `both`（vote.vue 就是這樣處理的）。

資料結構詳見 [docs/database.md](database.md)。

### 4.2 送出檢查與紅色邊框

`validate()` 一次檢查全部五個必填欄位，回傳 `{ 欄位: 訊息 }`，
**不在第一個錯誤就停** —— 否則使用者要按五次送出才知道有五個欄位沒填。

結果存進 `errors`，每個 `.field` 綁 `:class="{ invalid: errors.xxx }"`，
`ElMessage` 只報 `FIELD_ORDER` 裡的第一個（照畫面由上而下，不依賴物件 key 順序）。

紅框在欄位一有值時就消失，靠一個 deep watch `formData`，不用等重新送出。
`resetForm()` 與 `editEvent()` 會清掉 `errors`。

樣式寫在 `.field.invalid`：這頁沒有用 `el-form-item`，
所以 Element Plus 內建的 `.is-error` 用不上，得自己蓋 `box-shadow`。
要蓋三種 wrapper：

```scss
:deep(.el-input__wrapper)     // el-date-picker
:deep(.el-select__wrapper)    // el-select、以及 el-time-select（它不是 input wrapper）
:deep(.el-textarea__inner)    // el-input type="textarea"
```

`&:hover / &.is-focus / &.is-hovering` 也要一起蓋，不然滑過或聚焦時會被還原成灰藍色。

「負責人」**不納入檢查** —— 勾了負責人卻沒指定人是合法的，
月曆上會用紅色虛線框表示「還沒有人」（見 4.3）。

### 4.3 `isUnstaffed(ev)` — 紅色虛線框

符合任一條件就回 `true`：

- 勾了負責人但 `owners` 是空的
- 勾了早班但那天早班沒人
- 勾了晚班但那天晚班沒人

用**每筆活動自己的 `ev.date`** 判斷，不是表單當下選的日期。
所以把活動改到別天、那天剛好沒人，框就會跟著出現。

套用在兩個地方：月曆格子的 `.tag`、日期欄位下方的 `.day-event`。

### 4.4 `cursor` 與 `formData.date` 是兩件事

**這裡踩過坑，接手時請留意。**

| 變數 | 用途 |
|---|---|
| `cursor` | `el-calendar` 的 v-model，只決定**顯示哪個月** |
| `formData.date` | 表單真正在編輯的日期 |

月曆上的藍圈（選取狀態）綁的是 `.cell.picked`，也就是 `formData.date`，
**不是** Element Plus 自己的 `td.is-selected`（那個跟著 `cursor` 跑）。
`td.is-selected` 的背景已經被蓋成 transparent。

原因：「今天」按鈕只把月曆切回本月（`goToday()` 設 `cursor`），
不會改表單已選的日期。如果藍圈綁 `cursor`，按下去畫面會顯示「今天被選了」但表單其實還停在別天，會誤導使用者。

左右箭頭走 `goto(type)` → `calendarRef.selectDate(type)`（Element Plus 的 API），
「今天」則是獨立的 `goToday()`，因為 `selectDate('today')` 會連帶改動 selected day。

#### 換日期時要把表單清乾淨

`pickDate()`（點月曆格子）和 `onDateChange()`（用日期選擇器）都會呼叫 `leaveEditMode()`：

```js
function leaveEditMode() {
    if (formData.value.recordId) resetForm();
}
```

> ⚠️ 曾經這兩個函式只做 `formData.value.recordId = ''`。
> 這樣「點某筆活動編輯 → 改點別天」之後，舊活動的時間／類型／人員／內容
> 還留在表單上，而 `recordId` 已經空了 —— 按下送出就會
> **新增一筆內容一模一樣的活動**，等於默默複製一筆。

只在 `recordId` 有值（正在編輯既有活動）時才清。
還在填新活動的話不清，不然打到一半改個日期就全沒了。

### 4.5 日期下方的活動列表

一列的組成：

```
13:00 ~ 14:00  備註                           小萬、小貝 +2
└─ ev-time ─┘  └─ ev-content ─┘               └─ ev-people ─┘
                flex:1，截斷                   右對齊，最寬 45%
```

類型**不寫在列上**，靠底色表示，對照表在月曆下方的 legend（見 4.6）。

右側名字由 `eventPeople(ev)` 算出，依 `notifyRoles`：

- 勾了負責人 → `ev.owners` 逐個對 `userMap` 取暱稱
- 勾了早班／晚班 → 當天該班別的值班人員
- 同一人重複出現只算一次；完全沒人時顯示「無」

負責人用 `userMap`（`/api/users/list`）而不是 `volunteerList` ——
後者濾掉了停用的志工，舊資料的負責人如果已停用會變成空白。

最多先顯示 `PEOPLE_PREVIEW`（2）個，其餘收在 `+N` 後面，點一下展開、再點「收起」。
展開狀態存在 `expandedPeople`，key 是 `recordId`。

> ⚠️ `+N` 是 `<span>` 不是 `<button>` —— 外層 `.day-event` 已經是 `<button>` 了，
> 巢狀 button 是不合法的 HTML。它靠 `@click.stop` 擋住冒泡，
> 所以點 `+N` 不會連帶打開編輯表單。

> ⚠️ 展開時 `.ev-people` 要 `flex-basis: 100%` 整塊掉到第二行。
> 不這樣做的話名字會把 `.ev-content` 擠到只剩兩三個字（手機寬度下特別明顯）。

月曆格子裡的色塊**不走這套**，還是用 `eventLabel()`（內容為空時退回類型名稱）。

### 4.6 權限

| 動作 | 誰可以做 |
|---|---|
| 看 | 所有登入者 |
| 新增／編輯／刪除 | **只有管理員** |

一般志工是**唯讀**：表單欄位全部 `:disabled`，送出按鈕不顯示，
改成一行提示「唯讀：只有管理員可以新增、編輯或刪除活動」。

表單對唯讀使用者是**漸進顯示**的，不然給他一張什麼都不能填的表單只會造成困惑：

| 狀態 | 看得到什麼 |
|---|---|
| 沒選日期也沒選活動 | 表單整個不顯示 |
| 選了日期 | 日期欄位 ＋ 當天活動列表 |
| 選了活動 | 全部欄位（唯讀）＋ 唯讀提示 |

```js
// 表單本身
v-if="!readOnly || formData.date || formData.recordId"
// 日期以外的欄位
const showDetailFields = computed(() => !readOnly.value || !!formData.value.recordId);
```

管理員不受影響，表單一直都在。

前端的 `canEdit`（看 `useProfile()` 的 `isAdmin`）**只決定欄位能不能動、按鈕要不要出現**，
改個 JS 變數就繞過去了。真正擋得住的是後端：

```js
// server/utils/auth.js
requireUser(event)    // 未登入 → 401
requireAdmin(event)   // 非管理員 → 403（查 profiles.is_admin）
```

- `update.post.js`、`delete.post.js`：一律 `requireAdmin`
- `list.get.js`：不擋，登入者都能讀

`readOnly` 多包了一層 `profileLoaded`：

```js
const readOnly = computed(() => profileLoaded.value && !canEdit.value);
```

`isAdmin` 是 `layouts/default.vue` 掛載後才非同步載入的，
不等 `profileLoaded` 的話管理員會先看到一閃而過的「唯讀」提示。

> ⚠️ `server/api/admin/profiles.get.js` 目前**沒有**任何後端權限檢查，
> 只靠 `middleware/admin.js` 擋頁面 —— 直接打那支 API 就拿得到全體志工資料。
> 這是既有的問題，不在本次範圍內，但 `requireAdmin()` 已經寫成通用的，要補很容易。

### 4.7 兩種檢視：月曆與列表

右上角的 `el-switch` 切換 `isListView`，選擇存在 localStorage 的 `calendar-list-view`。

| | 月曆 | 列表 |
|---|---|---|
| 元件 | `el-calendar` | 自己刻的 `.month-list` |
| 月份導覽 | `el-calendar` 的 `#header` slot，走 `goto()` → `calendarRef.selectDate()` | 自己的 `.list-nav`，走 `shiftMonth()` 直接算 `cursor` |
| 範圍 | 月曆格子（含前後月補滿的那幾天） | **只有 `cursor` 那個月** |

> ⚠️ `el-calendar` 是 `v-if` 不是 `v-show`，切到列表時 `calendarRef` 是 `null`。
> 所以列表的導覽**不能**用 `goto()`，要用 `shiftMonth()` 自己算 dayjs。

`monthGroups` 吃的是 `eventsByDate`（來自 `visibleEvents`），
所以**篩選條件在兩種檢視都生效**，看到的筆數一致。
當月沒有活動時顯示「本月沒有活動」。

**日期標題**是 `<button>`，點下去等同在月曆上點那格（走同一支 `pickDate()`）：

```
8  週三                    1 個活動
```

- 大數字是日，右邊是當天筆數
- `today` → **淺紅底 `#fde2e2` + 深紅字 `#b33a39`**
- `picked`（表單正在編輯這一天）→ **藍底白字** + 藍色底線

> 兩個狀態**刻意用不同顏色**，同時成立時 `picked` 蓋過 `today`（規則寫在後面）。
> 配色跟月曆格子的 `.cell.today .num` / `.cell.picked .num` 是同一套，
> 兩種檢視看起來才一致。
- `position: sticky; top: 0` 吸在捲動容器頂端，捲很長也知道讀到哪一天

**`.list-body` 有 `max-height: 50vh` + `overflow-y: auto`**，
資料多的時候在框內捲動，不會把下方表單推到看不見的地方。

> `padding-right: 8px` 是留給捲軸的，不然日期右邊的「N 個活動」會被切掉。

#### 自動捲到今天附近

`scrollListToToday()` 在**切到列表、換月份、第一次載入**時觸發
（**不**在 realtime 重載時觸發 —— 讀到一半被捲走很煩）。

`nearestGroupDate()` 決定捲到哪一天：

- 看的不是當月 → 回 `null`，捲到最上面（「今天」根本不在那個月裡）
- 今天有活動 → 今天
- 否則取**距離今天最近**的那天；距離相同時取**比較晚**的（接下來要發生的比較重要）

> ⚠️ 量位置前要 `await document.fonts?.ready`。
> 這頁用 Google Fonts 的 Noto Sans TC，字體載入會改變卡片高度，
> 只等 `nextTick()` 會量到舊高度 —— 實測會直接捲到底而不是正確位置。

> 位移用 `getBoundingClientRect()` 的差值而不是 `offsetTop`，
> 後者要看有沒有 positioned 祖先，容易踩雷。

列表的每一列是 `.list-item` 卡片，跟月曆下方的 `.day-event` 是**兩套不同的東西**：

```
[社群] 13:00 ~ 14:00        ← 類型 badge ＋ 時間
IG 送養文待發               ← 內容，15px，不截斷、會換行
👤 小萬、小貝 +2             ← 活動人員
```

左側 3px 色條依類型上色，未指定人員時上／右／下變紅色虛線（左側色條保持實心）。

> ⚠️ 色條的規則刻意寫成 `.month-list .list-item.type-x` 多包一層。
> 只寫 `.list-item.type-x` 的話會跟 `.month-list .list-item` 的底色**特異性打平**，
> 變成誰寫在後面誰贏 —— 樣式一重排就默默壞掉。這個坑我踩過。

> `.list-date` 要自己 `text-align: left`，`#calendar` 是置中的。

### 4.8 篩選與類型 legend

**篩選**（月曆左上的 Filter icon）

點 icon 開 `el-dialog`，三個條件：

| 條件 | 控制項 | 比對 |
|---|---|---|
| 活動人員 | 多選 | `eventPeopleIds(ev)` 與所選集合有交集 |
| 類型 | 多選 | `ev.type` 在所選集合裡 |
| 內容 | 文字 | `ev.content` 包含關鍵字，不分大小寫；只有空白視為不篩 |

**條件之間 AND，單一條件內多選是 OR。**
例如「活動人員=小萬、小貝」+「類型=社群」= 小萬或小貝參與的社群活動。

`eventPeopleIds(ev)` 用 **user id** 比對不是暱稱（會撞名），
內容是 `owners` + 當天早晚班名單，依 `notifyRoles` 決定取哪幾項。
`eventPeople()`（列表右側顯示的名字）也改成走它 —— 先去重 id 再轉暱稱，
反過來做的話兩個同名的人會被併成一個。

**`filter` 與 `filterDraft` 是兩個東西。** 因為有「套用」按鈕：
`filterDraft` 是 modal 裡編輯中的草稿，改到一半關掉 modal 不該影響畫面；
按下套用才複製進 `filter`，並寫進 localStorage 的 `calendar-filter`。
`openFilter()` 開啟時是**深拷貝**，不然在 modal 裡改多選會直接動到已套用的條件。

「清除」只清草稿、不關 modal，使用者還是要按「套用」才生效。

`hasActiveFilter` 為真時 icon 旁邊顯示「篩選中」。
**這個提示不能省** —— 篩選開著但看不出來的話，使用者會以為活動憑空消失。

「只看我的」是活動人員欄位右邊的小灰字捷徑，點了把 `filterDraft.people` 設成 `[myId]`。

> ⚠️ `el-dialog` 的 label 會被 Element Plus 算一個固定寬度（剛好包住文字），
> 裡面的 `.label-row` 就撐不滿，「只看我的」會黏在標題右邊而不是推到最右。
> 要 `:deep(.el-form-item__label) { width: 100% }`。

> ⚠️ dialog 沒有被 teleport 到 body，還在頁面 root 底下（帶 `data-v`），
> 所以 `:deep()` 打得到。footer 的按鈕一樣中了全域 `button { width: 100% }`，
> 要 `.el-button { width: auto !important }`。

**類型 legend**（月曆下方，靠右）

五個類型的顏色對照。配色只定義在 SCSS 的 `$types` map 一處，
`@each` 迴圈同時產生 `.tag`、`.day-event`、`.legend-item` 三種選擇器，
所以改顏色只要改 map。

---

## 5. 資料來源

Mock 已全部移除。現在頁面的四個資料來源：

| 資料 | 來源 |
|---|---|
| `events` | `GET /api/calendar/list?start=&end=`（依月曆顯示範圍） |
| `roster(date, shift)` | supabase client 直接讀 `votes` + `vote_options`（見 4.1） |
| `userMap` | `GET /api/users/list`，把 `votes.user_id` 轉成暱稱 |
| `volunteerList` | `GET /api/volunteer/list`，`value` 是 `profiles.id` |
| `Submit()` / `DeleteEvent()` | `POST /api/calendar/update`、`POST /api/calendar/delete` |

### 顯示範圍與換月

月曆格子會補滿前後月份，所以查詢範圍要含頭尾那幾天 —— `displayRange()` 負責算：

```js
start = 該月 1 號所屬週的週一
end   = 該月最後一天所屬週的週日
```

`watch` 盯著 `cursor` 的 `YYYY-MM`，換月就 `loadRange()` 重查 `events` 與 `votes`。

`votes` 是以 `week_start`（週一）為 key 的週資料，所以 `loadVotes()` 會把顯示範圍
換算成一串週一，用 `.in('week_start', weeks)` 一次撈回來。

### Realtime

訂閱 `calendar_events` 整張表，收到變更就 debounce 300ms 後重載當前範圍。

聽的是 `event: '*'` 而不是分別聽 INSERT/UPDATE/DELETE —— 因為**軟刪除在 Realtime
眼中是 UPDATE 不是 DELETE**，只聽 DELETE 會漏掉。

`votes` 的變動（有人投票了、紅框該消失）**不即時同步**，要換月或重新整理才會更新。
要做的話再加一個 `votes` 的 channel 即可。

---

## 6. 後端

### Table `calendar_events`

建表 SQL：[docs/sql/calendar_events.sql](sql/calendar_events.sql)
**⚠️ 這份會先 `drop table` 再重建，現有資料會全部消失。**
欄位說明：[docs/database.md](database.md)

重點：

- **軟刪除**：`deleted_at` / `deleted_by`，所有查詢帶 `.is('deleted_at', null)`
- `type` 有 CHECK 約束，新增類型要同步改 `pages/calendar.vue` 的 `typeList`
- 早晚班人員不存進這張表，依 `date` 對到 `votes` 即時算
- RLS 只開 `select`（給 Realtime 訂閱用），寫入走 service key

### API

`server/api/calendar/`，照 `server/api/regular/` 的慣例：

| 檔案 | 說明 |
|---|---|
| `list.get.js` | query `start` / `end`，過濾軟刪除，snake_case → camelCase |
| `update.post.js` | 有 `recordId` 就 update、沒有就 insert |
| `delete.post.js` | 軟刪除，不是真的 DELETE |

寫入端都用 `serverSupabaseUser(event)` 擋未登入。

> 注意：這版 `@nuxtjs/supabase` 的 `serverSupabaseUser` 回傳的是 **JWT claims**
> （內部是 `auth.getClaims()`），所以取 user id 要用 `user.sub`，不是 `user.id`。
> `server/api/regular/update.post.js` 也是這樣寫的。

---

## 7. 踩過的坑

### 7.1 `button { width: 100% }` 會把 el-tag 的文字擠不見

[layouts/default.vue](../layouts/default.vue) 有全域規則：

```scss
button, input, select { width: 100%; ... }
```

而 Element Plus 的 `.el-tag__close` 是 `<button>` 元素。它被撐成滿版後，
旁邊的 `.el-tag__content`（有 `min-width: 0; overflow: hidden`）就被壓成 0 寬度，
**標籤只剩下 × 看不到文字**。

本頁的解法（[pages/vote.vue](../pages/vote.vue) 也踩過同一個坑）：

```scss
:deep(.el-tag__close) { width: auto; }
```

只要用到可關閉的 `el-tag`（多選 select 的標籤）就會中。
之後如果想一勞永逸，可以移到 [assets/css/element-variables.css](../assets/css/element-variables.css)。

### 7.2 月曆要從週一開始，得改 dayjs 的 locale

`el-calendar` 的星期排序是讀 `dayjs.localeData().firstDayOfWeek()`，
而 dayjs 的 `zh-tw` locale **沒有定義 `weekStart`**，預設會變成週日開頭。

解法在 [plugins/dayjs.js](../plugins/dayjs.js)：

```js
dayjs.extend(updateLocale)
dayjs.updateLocale('zh-tw', { weekStart: 1 })
```

這是全域設定，會影響 `startOf('week')` / `endOf('week')`。
改之前確認過專案沒有其他地方用到這兩個 API，`/vote` 是自己手算週一的。

### 7.3 多選的 select 高度

`.el-select__wrapper` 要用 `min-height` 不能用 `height`，
標籤換到第二行時才不會被裁掉。

### 7.4 `votes.week_start` 有不少是「星期二」，不能拿來精準比對

**這是接後端時踩到最大的坑。**

`/vote` 存檔時送的明明是週一字串（`initWeek()` 手算的），但資料庫裡實際長這樣：

```
2025-12-02  星期二  ← data 的 key 卻是 2025-12-01（星期一）
2025-12-09  星期二
2025-12-22  星期一  ← 只有這筆是對的
2025-12-23  星期二
2025-12-30  星期二
2026-01-06  星期二
2026-01-13  星期二
2026-01-26  星期一
```

已確認 `week_start` 是 `date` 型別（不會時區轉換），寫入讀出一致，
所以是**既有資料本身就偏移了一天**，推測是早期從 Airtable／NocoDB 搬過來時造成的。

實測影響：如果 `roster()` 用 `week_start === 該日的週一` 來比對，
39 筆值班紀錄只找得到 **1 筆**。

解法：**完全不比對 `week_start`**。`votes.data` 本來就是以真實日期當 key，
直接 `vote.data[date][shift][optionId].checked` 就好。
`loadVotes()` 只負責用區間把可能相關的列撈進來（前後各多抓一週當緩衝）。

> 這個偏移也代表 `/vote` 自己可能有讀不到舊投票的問題（它是 `.eq('week_start', 週一)`）。
> 不在本次範圍內，但值得另外查。

---

### 7.5 `ElMessage` 沒有被 auto-import，提示全部是啞的

專案只在 [plugins/element-plus.js](../plugins/element-plus.js) 做 `app.use(ElementPlus)`，
那只註冊**元件**，不會讓 `ElMessage` 這個**函式**變成可用的識別字。
Nuxt 的 auto-import 也沒涵蓋它（`.nuxt/` 裡查不到任何註冊）。

結果是 `ElMessage.error('請選擇日期')` 直接丟 `ReferenceError`，
**驗證沒過時畫面上完全沒反應**，使用者只會以為按鈕壞了。
存檔成功時的 `ElMessage.success` 也一樣炸，而且會被自己的 `catch` 再炸一次。

解法就是明確 import：

```js
import { ElMessage } from 'element-plus';
```

`/regular`、`/medicine` 也踩到同一個坑，已一併補上。
CSS 不用另外處理，`element-plus/dist/index.css` 本來就在 `nuxt.config.js` 全域載入。

---

## 8. 還沒做的事

- [x] 建表 + 三支 API + 前端串接（見第 5、6 節）
- [x] 換月份時依範圍重新查資料
- [x] Realtime（訂閱 `calendar_events`，見第 5 節）
- [ ] LINE 通知：目前只顯示名單，沒有推播。要做的話可接 `/api/line/message/push`，
      決定是送出時自動發、還是比照 `/regular` 給一顆手動發送按鈕
- [ ] 重複性活動（每週／每月）目前沒有支援
- [x] 權限：新增／編輯／刪除限管理員，一般志工唯讀（見 4.6）
- [ ] `votes` 變動時紅色虛線框不會即時更新，要換月或重新整理
- [ ] `votes.week_start` 的資料偏移（見 7.4）沒有修，只是繞過。`/vote` 可能也受影響

---

## 9. 相關檔案

| 檔案 | 說明 |
|---|---|
| [pages/calendar.vue](../pages/calendar.vue) | 本頁全部內容 |
| [server/api/calendar/](../server/api/calendar/) | list / update / delete 三支 API |
| [server/utils/auth.js](../server/utils/auth.js) | `requireUser()` / `requireAdmin()` |
| [docs/sql/calendar_events.sql](sql/calendar_events.sql) | 建表 SQL（會先 drop 再重建） |
| [pages/index.vue](../pages/index.vue) | 首頁入口連結 |
| [plugins/dayjs.js](../plugins/dayjs.js) | `weekStart: 1`（見 7.2） |
| [pages/vote.vue](../pages/vote.vue) | 值班投票，`roster()` 的算法參考它 |
| [docs/database.md](database.md) | `votes` / `vote_options` / `calendar_events` 的資料結構 |
| [pages/regular.vue](../pages/regular.vue) | 表單頁的既有慣例（自動儲存、realtime、LINE 推播） |
