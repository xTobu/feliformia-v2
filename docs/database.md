# Database Schema

## Tables

### profiles
用戶資料表

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK, 對應 auth.users |
| nickname | TEXT | 顯示名稱 |
| is_admin | BOOLEAN | 是否為管理員，預設 FALSE |
| is_active | BOOLEAN | 是否啟用，預設 TRUE。**`false` 會被 `requireUser()` 擋掉**，所有 API 都進不去（見下方「API 端點權限」） |
| line_user_id | TEXT | UNIQUE，LINE 的 userId。靠 webhook 綁定取得，用來發活動提醒（見 [line-notify.md](line-notify.md)） |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

---

### vote_options
投票選項設定

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| name | TEXT | 選項名稱（醫療、灌食、值班、快閃/協助）。**行事曆只把「值班」「快閃/協助」當成值班人員** —— 名單寫死在 `pages/calendar.vue` 與 `server/utils/roster.js` 的 `DUTY_OPTION_NAMES`，改名會讓它失效 |
| has_time_range | BOOLEAN | 是否需要時間區間（醫療需要） |
| is_exclusive | BOOLEAN | 是否排他（目前未使用） |
| sort_order | INTEGER | 排序 |
| is_active | BOOLEAN | 是否啟用 |

---

### votes
投票記錄

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | 流水號 |
| user_id | UUID | FK → auth.users |
| week_start | DATE | 該週週一日期 |
| is_pass | BOOLEAN | 本週是否 Pass |
| data | JSONB | 投票資料（結構見下方） |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

**PK**: (user_id, week_start)

> `votes` **沒有** nickname 欄位。要顯示投票者名字得用 `user_id` 對 `/api/users/list`
> （`/vote` 的 `getNickname()`、`/calendar` 的 `userMap` 都是這樣做）。

#### data JSONB 結構

```
votes.data
├── [date: "2025-12-22"]
│   ├── morning
│   │   └── [option_id]
│   │       ├── checked: boolean
│   │       ├── time_start?: string  (has_time_range 才有)
│   │       └── time_end?: string
│   └── night
│       └── [option_id]
│           ├── checked: boolean
│           ├── time_start?: string
│           └── time_end?: string
└── [date: "2025-12-23"]
    └── ...
```

範例：

```json
{
  "2025-12-22": {
    "morning": {
      "uuid-option-1": {
        "checked": true,
        "time_start": "09:00",
        "time_end": "10:00"
      }
    },
    "night": {
      "uuid-option-2": {
        "checked": true
      }
    }
  }
}
```

---

### calendar_events
行事曆（`/calendar`）

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| date | DATE | 活動日期 |
| time_start | TEXT | 開始時間 'HH:mm'，15 分鐘刻度 |
| time_end | TEXT | 結束時間 'HH:mm'，不做防呆 |
| type | TEXT | 類型 key，見 `pages/calendar.vue` 的 typeList（**沒有** CHECK 約束） |
| notify_roles | JSONB | `['morning','night','owner']` 的子集合 |
| owners | JSONB | profiles.id 的陣列（可多人），僅 notify_roles 含 'owner' 時才有值 |
| content | TEXT | 備註內容，必填 |
| created_by | UUID | FK → auth.users |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |
| deleted_at | TIMESTAMPTZ | 軟刪除時間，NULL 表示未刪除 |
| deleted_by | UUID | FK → auth.users，誰刪的 |

**軟刪除**：所有查詢都帶 `.is('deleted_at', null)`，不做實體 DELETE。

**早晚班人員不存在這張表**，依 `date` 對到 `votes` 即時計算（見 `pages/calendar.vue` 的 `roster()`）。
存一份會跟投票結果不同步。

建表 SQL：[docs/sql/calendar_events.sql](sql/calendar_events.sql)

---

### notices
餵藥及特殊飲食事項（`/admin/notices` 管理）

| Column | Type | Description |
|--------|------|-------------|
| id | — | PK |
| name | TEXT | 貓咪名字 |
| treatment | TEXT | 事項，必填 |
| reason | TEXT | 原因，可 NULL |
| shift | TEXT | `morning` / `night` / `both` |
| order | INTEGER | 排序（後台拖拉） |
| start_date | DATE | 療程開始日，NULL 代表不限 |
| end_date | DATE | 療程結束日（含當天），NULL 代表不限 |

**`medicines.cats` 是快照，不是參照。** 某個 date + shift 的紀錄**第一次被打開**時，
`server/api/medicine/index.get.js` 才會把當下符合班別、期間的事項整份複製進去，
之後就不再跟 `notices` 同步。所以修改事項內容或期間，**已經被打開過的班別不會跟著變**，
從下一個還沒建立的班別開始才會生效。

過了 `end_date` 的事項不會自動刪除，後台會標成「已結束」，改期間就能重新使用。

---

## 新版值班系統（試行中）

跟上面的 `cats`、`notices`、`medicines`、`regulars` **並行**，資料各自獨立、不互通，讓大家慢慢換過來。
建表在 `supabase/migrations/*_create_care_tables.sql`，位置清單在 `composables/locations.js`
（資料庫有 check 擋，兩邊要一起改）。

| 表 | 頁面 | 說明 |
|---|---|---|
| `cat_profiles` | `/admin/cat-profiles` | 貓咪。`id` 沿用舊 `cats` 的 id（一次性複製）；`location` 只能是客廳／房間／倉庫／隔離區；排序 `sort_order` |
| `diet_items` | `/admin/diet` | 飲食。`category` 乾乾／罐罐／補充／其他，`content` |
| `medical_items` | `/admin/medical` | 醫療。`category` 醫療／吃藥，`treatment`、`reason` |
| `required_items` | `/admin/required` | 值班收尾：這一班離開前一定要勾完的清單。`content`；對象可選貓、全員、**貓屋**或位置，每項都整班勾一次 |
| `shifts` | `/shift` | 值班記錄，一班一筆（unique date + shift）。`reports` 是每個分頁、每個人各自的回報 |
| `shift_comments` | `/shift` | 每隻貓、每個分頁的留言，只新增不覆寫 |

**三張事項表的共同欄位**：`shift` 是 `morning` / `night` / `both`，`start_date` / `end_date` 空代表不限。
三張都有對象：`cat_id` 有值 = 那隻貓；`location` 有值 = 那個位置；兩個都空 = 全員
（不能同時有值）。收尾的 `location` 多一個「貓屋」（整間屋子、跟貓無關的事，例如倒垃圾）。
後台與值班表的排序都是：貓咪 → 全員 → 貓屋 → 位置（`composables/locations.js` 的 `placeRank`）。
刪掉一隻貓會連帶刪掉牠的事項與留言（on delete cascade），不會變成全員。

**權限**：全部登入可讀。`cat_profiles` 與三張事項表只有管理員能寫（`is_admin()`，前端後台直接寫）；
`shifts`、`shift_comments` 沒有寫入 policy，一律走 `server/api/shift/*`（service key）。

### shifts 的快照與局部更新

`cats`、`tasks` 是這一班的快照，存成**以 id 為 key 的物件**（不是陣列），結構見 `server/utils/shift.js` 開頭。
當天（台灣時間）的班每次載入都用後台最新設定重建，再把已填的資料併回去（`syncWithSettings`）；過去的班保持當時的樣子。
上一班離開時放風的貓，這一班記 `prev_released: true`（貓沒關籠，觀察分頁不用登記吃喝排泄）。
這個值記在這一班自己身上：當天的班每次載入會照上一班現在的記錄重算，有變才寫回（`persistPrevReleased`）。

醫療、吃藥、收尾打勾時記下 `done_by`（登入者暱稱）與 `done_at`，畫面顯示「✓ 阿明 21:40」。
`reports` 是 `{ 分頁: { user_id: { name, text, at } } }`：每個分頁、每個人各一段，用登入身分（沒有「填表志工」）。
每個人只能改自己那一段，名字與時間由 server 填（`server/api/shift/update.post.js`）。
下一班在**同一個分頁**上方看到上一班的回報（`components/ShiftReportBlock.vue`，可摺疊，這台裝置會記住），
收尾分頁另外列沒勾完的項目。每個分頁的「LINE 發送至群組」只發那個分頁、這一班所有人的回報（標作者），不合在一起。舊格式的回報放在 `legacy` 底下，顯示為「（舊資料）」。

存檔不是整筆覆寫：前端每改一格只送那一格（例如 `cats.12.medical.5`、`reports.care.<user_id>`），
`/api/shift/update` 呼叫資料庫函式 `shift_apply` 套用，同一班的請求會排隊。
**兩個人同時改不同的貓或項目不會互相覆蓋**；同一格才是後存的贏。
`shift_apply` 只開放給 service_role，前端不能直接呼叫。

---

## Realtime

需啟用 Realtime 的表：
- `votes` - 讓多用戶即時看到彼此的投票
- `calendar_events` - 讓多用戶即時看到彼此的行事曆異動
- `medicines`、`regulars` - 舊版餵藥與例行紀錄的即時同步
- `shifts`、`shift_comments` - 新版值班記錄表的即時同步與留言

（現在都由 `supabase/migrations/` 管理，下面的 SQL 只是參考）

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
```

> 注意：`calendar_events` 是軟刪除，所以刪除在 Realtime 眼中是 UPDATE 不是 DELETE，訂閱要聽 `*`。

---

## RLS Policies

### votes
- SELECT: 所有登入用戶可讀取所有投票
- INSERT/UPDATE: 只能操作自己的投票 (`auth.uid() = user_id`)
- DELETE: 只能刪除自己的投票

### profiles
- SELECT: 所有登入用戶可讀取
- INSERT/UPDATE: 只能操作自己的資料

### vote_options
- SELECT: 所有登入用戶可讀取
- INSERT/UPDATE/DELETE: 僅管理員（或關閉）

### calendar_events
- SELECT: 所有登入用戶可讀取（給 Realtime 訂閱用）
- INSERT/UPDATE/DELETE: 無 policy。寫入一律走 server API，用 service key 繞過 RLS

---

## API 端點權限

Server API 用 **service key** 連 Supabase，**會繞過上面所有 RLS**。
所以每一支端點都必須自己驗身分 —— RLS 擋不住它們。

驗證 helper 在 [server/utils/auth.js](../server/utils/auth.js)：

| helper | 擋什麼 | 回傳 |
|---|---|---|
| `requireUser(event)` | 沒登入 → 401；`is_active = false` → 403 | user id（`user.sub`） |
| `requireAdmin(event)` | 同上，再加不是管理員 → 403 | user id |

兩個 helper 共用內部的 `authenticate()`，所以**不管呼叫哪一個，
`profiles` 都只查一次** —— 每支 API 固定一次 round-trip，不會疊加。

`is_active` 只在**明確是 `false`** 時才擋。欄位是 `null`、或 `profiles`
整列不存在都放行：早期的 row 沒有這個欄位，當成停用會讓老帳號全部進不來。

前端 `middleware/auth.js` 與 `middleware/admin.js` 也會查同一個欄位
（走 `useProfile().ensureActive()`），停用的人直接登出並導到
`/login?inactive=1` 顯示原因。**那是體驗層，不是安全層** ——
真正的防線是上面兩個 server helper，中介層只是避免使用者看到一連串 403。

> ⚠️ `serverSupabaseUser()` 回的是 **JWT claims**，使用者 id 在 `user.sub`
> **不是** `user.id`。要寫 `updated_by` 之類的欄位時用 helper 的回傳值就對了。

### 現況

| 端點 | 權限 |
|---|---|
| `calendar/list`、`calendar/today` | `requireUser` |
| `calendar/update`、`calendar/delete`、`calendar/notify` | `requireAdmin` |
| `calendar/remind` | `CRON_SECRET`（排程專用，見 line-notify.md） |
| `line/webhook` | LINE 簽章驗證 |
| `line/message/push` | `requireUser` |
| `users/list`、`volunteer/list` | `requireUser` |
| `admin/profiles` | `requireAdmin` |
| `medicine/*`、`regular/*` | `requireUser` |
| `mind/list` | `requireUser` |
| `auth/verify-answer` | **刻意公開** —— 登入前的問答關卡，此時還沒有身分 |

**新增端點時預設加 `requireUser`**，確定要公開才例外，並在程式碼裡註明理由。

> `medicine/index` 與 `regular/index` 雖然是 GET，但查不到當天記錄時會
> 順手 INSERT 一筆。它們不是唯讀的，別因為是 GET 就以為不用擋。
