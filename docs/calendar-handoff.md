# 行事曆與備註區 — 交接文件

`/calendar`（[pages/calendar.vue](../pages/calendar.vue)）

目前狀態：**純前端切版完成，完全沒有接 API，所有資料都是頁面內的 mock。**
後端與串接由下一位工程師接手。

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
| 頁面不碰任何 API | 後端獨立處理，前端只負責切版 |
| 結束時間**不做防呆** | 與 `/vote` 一致，那邊也沒擋。可以選早於開始時間的結束時間 |
| 活動時間只到 15 分鐘刻度 | 不需要精準到分鐘。用 `el-time-select` 的 `step="00:15"` |
| 早晚班名單是**算出來的，不存** | 名單來源是 `votes`，存一份會不同步 |

---

## 3. 資料結構

一筆活動（前端形狀）：

```js
{
    recordId: 'mock-202609-3-18:00',  // 接 API 後換成 DB 的 id
    date: '2026-09-03',               // YYYY-MM-DD
    timeStart: '18:00',               // HH:mm，15 分鐘刻度
    timeEnd: '20:00',
    type: 'volunteer',                // 見下表
    notifyRoles: ['morning'],         // 'morning' | 'night' | 'owner' 的子集合
    owner: '',                        // 只有 notifyRoles 含 'owner' 才有值
    content: '虎嚕媽打掃體驗',          // 必填
}
```

### 類型 `type`

| value | label | 顏色 | 實務上通常掛 |
|---|---|---|---|
| `volunteer` | 志工體驗 | `#409eff` 藍 | 早班／晚班 |
| `supplies` | 物資贈送 | `#67c23a` 綠 | 早班／晚班 |
| `dispatch` | 出車 | `#e6a23c` 橘 | 負責人 |
| `post` | 發文 | `#7c5cf0` 紫 | 負責人 |
| `other` | 其他 | `#303133` 黑 | 混合 |

志工體驗與物資贈送多半只掛早晚班，而排班要等日期接近才會催投票，
所以這兩類**經常處於「還沒有人」的狀態**，月曆上會是紅色虛線框。這是正常的，不是 bug。

### 提示對象 `notifyRoles`

三個角色各自獨立，可複選。表單下方的區塊是 `v-if` 綁 `notifyRoles`：

- 只勾「負責人」→ 不會出現早晚班資訊
- 只勾早晚班 → 不會出現負責人欄位

`owner` 只在勾了 `'owner'` 時才存值，送出時會清掉（`Submit()` 的 `payload`）。

---

## 4. 核心邏輯

### 4.1 `roster(date, shift)` — 當班名單

**接 API 時要改寫的重點函式。** 回傳字串陣列，格式 `選項名稱 - 暱稱`，例如 `['值班 - 小貝', '快閃/協助 - Summer']`。

正式邏輯應該照 [pages/vote.vue](../pages/vote.vue) 的算法從 `votes` 撈：

```js
// votes.data[date][shift][optionId].checked === true 的人
// option 名稱來自 vote_options（依 sort_order 排序、is_active）
// 要跳過 is_pass 的人
// week_start 是該日所屬週的「週一」
```

`votes` 是以 `week_start`（週一）為 key 的週資料，所以查某一天要先換算出那週的週一。
`vote_options` 有 `shift` 欄位（`'both' | 'morning' | 'night'`），缺值時視同 `both`（vote.vue 就是這樣處理的）。

資料結構詳見 [docs/database.md](database.md)。

### 4.2 `isUnstaffed(ev)` — 紅色虛線框

符合任一條件就回 `true`：

- 勾了負責人但 `owner` 是空的
- 勾了早班但那天早班沒人
- 勾了晚班但那天晚班沒人

用**每筆活動自己的 `ev.date`** 判斷，不是表單當下選的日期。
所以把活動改到別天、那天剛好沒人，框就會跟著出現。

套用在兩個地方：月曆格子的 `.tag`、日期欄位下方的 `.day-event`。

### 4.3 `cursor` 與 `formData.date` 是兩件事

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

---

## 5. Mock data 在哪、怎麼換掉

`<script setup>` 裡有一整塊用註解框起來的區域：

```
/* ===== Mock data（純切版用，不接任何 API）===== */
...
/* ===== Mock data 結束 ===== */
```

要換掉的四個點：

| Mock | 換成 |
|---|---|
| `MOCK_EVENTS` + `buildMockEvents()` → `events` | GET 活動列表（依月曆顯示範圍的起訖日期查） |
| `roster(date, shift)` | 依日期從 `votes` 算當班名單（見 4.1） |
| `volunteerList` | GET 志工名單，可直接用現成的 `/api/volunteer/list` |
| `Submit()` / `DeleteEvent()` 裡的陣列操作 | POST 新增／更新／刪除 |

Mock 的 `MOCK_MORNING_DAYS` / `MOCK_NIGHT_DAYS` 是「那幾號有人投票」的假設，
故意讓其他日子沒人，好讓紅色虛線框在切版時看得到。接 API 後整個拿掉。

目前 `onMounted` 一次產生**前後各兩個月**的 mock 活動。
接 API 後應該改成 watch `cursor` 的月份變化、依範圍重新查：

```js
// 月曆格子會補滿前後月份，所以查詢範圍要含頭尾那幾天
const rangeStart = 該月 1 號所屬週的週一
const rangeEnd   = 該月最後一天所屬週的週一 + 6 天
```

> 注意：現在沒有這個 watch，所以往前／往後翻超過兩個月會是空的。這是 mock 階段的預期行為。

---

## 6. 建議的後端（尚未實作，僅供參考）

### Table `calendar_events`

```sql
create table if not exists public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    date date not null,
    time_start text not null,          -- 'HH:mm'
    time_end text not null,
    type text not null,                -- volunteer / supplies / dispatch / post / other
    notify_roles jsonb not null default '[]'::jsonb,
    owner text,                        -- 僅 notify_roles 含 owner 時才存
    content text not null,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists calendar_events_date_idx on public.calendar_events (date);

alter table public.calendar_events enable row level security;

-- 寫入走 server API（service key 繞過 RLS），前端只需要讀取
create policy "calendar_events_select" on public.calendar_events
    for select to authenticated using (true);
```

早晚班人員**不要存進這張表**，依 `date` 對到 `votes` 即時算。

### API

照專案現有慣例（`server/api/regular/`、`server/api/volunteer/`）：

- `server/utils/supabase.js` 的 service client 做讀寫
- 寫入端用 `serverSupabaseUser(event)` 擋未登入
- 回傳時把 snake_case 轉成前端的 camelCase（`time_start` → `timeStart`）

建議三支：`list.get.js`（帶 `start` / `end` query）、`update.post.js`（有 `recordId` 就 update、沒有就 insert）、`delete.post.js`。

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

---

## 8. 還沒做的事

- [ ] 建表 + 三支 API + 前端串接（見第 5、6 節）
- [ ] 換月份時依範圍重新查資料（目前只有 mock 的前後兩個月）
- [ ] LINE 通知：目前只顯示名單，沒有推播。要做的話可接 `/api/line/message/push`，
      決定是送出時自動發、還是比照 `/regular` 給一顆手動發送按鈕
- [ ] 重複性活動（每週／每月）目前沒有支援
- [ ] 沒有做權限區分，任何登入者都能編輯／刪除任何一筆

---

## 9. 相關檔案

| 檔案 | 說明 |
|---|---|
| [pages/calendar.vue](../pages/calendar.vue) | 本頁全部內容 |
| [pages/index.vue](../pages/index.vue) | 首頁入口連結 |
| [plugins/dayjs.js](../plugins/dayjs.js) | `weekStart: 1`（見 7.2） |
| [pages/vote.vue](../pages/vote.vue) | 值班投票，`roster()` 的算法參考它 |
| [docs/database.md](database.md) | `votes` / `vote_options` 的資料結構 |
| [pages/regular.vue](../pages/regular.vue) | 表單頁的既有慣例（自動儲存、realtime、LINE 推播） |
