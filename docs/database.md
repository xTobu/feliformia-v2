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
飲食與特殊醫療項目。兩個後台共用這張表，靠 `category` 分開
（共用元件 `components/CareItemsAdmin.vue`）：

| category | 中文 | 後台 |
|---|---|---|
| `dry` | 乾乾 | 飲食與待辦 `/admin/diet` |
| `wet` | 罐罐 | 飲食與待辦 `/admin/diet` |
| `supplement` | 補充 | 飲食與待辦 `/admin/diet` |
| `diet_other` | 其他 | 飲食與待辦 `/admin/diet`（value 跟醫療的 `other` 分開） |
| `todo` | 待辦 | 飲食與待辦 `/admin/diet`（值班要做、要打勾的事，例如小房間柵欄） |
| `medication` | 吃藥 | 醫療管理 `/admin/treatment` |
| `medical` | 醫療 | 醫療管理 `/admin/treatment` |
| `other` | 其他 | 醫療管理 `/admin/treatment` |

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | PK |
| name | TEXT | 顯示用名稱。對得到貓時是貓名（取冒號前），對不到時是「全員」「小房間」這類標籤 |
| cat_id | BIGINT | FK → cats.id，可 NULL。NULL 代表不屬於單一貓咪 |
| category | TEXT | 見上表，預設 `medical`。**刻意不加 CHECK 約束**（同 calendar_events.type）：類別會隨實務增加，真相來源是 `components/CareItemsAdmin.vue` 的 `ALL_CATEGORIES`；打錯的值不會出現在任何一頁 |
| treatment | TEXT | 內容，必填 |
| reason | TEXT | 原因／備註，可 NULL |
| shift | TEXT | `morning` / `night` / `both` |
| order | INTEGER | 排序（後台拖拉）。**兩個後台各自從 1 編**，數字會重疊，只有同一個 category 群裡的相對順序有意義 |
| start_date | DATE | 期間開始日，NULL 代表不限 |
| end_date | DATE | 期間結束日（含當天），NULL 代表不限 |

**`medicines.cats` 是快照，不是參照。** 某個 date + shift 的紀錄**第一次被打開**時，
`server/api/medicine/index.get.js` 才會把當下符合班別、期間的項目整份複製進去，
之後就不再跟 `notices` 同步。所以修改內容或期間，**已經被打開過的班別不會跟著變**，
從下一個還沒建立的班別開始才會生效。快照**不含乾乾、罐罐**（`dry`、`wet`）。

`regulars` 也一樣是快照：貓名旁的飲食備註取自當下符合班別、期間的乾乾、罐罐，
串成一行；該貓兩者都沒有時退回 `cats.diet_note`（過渡期用，見 `server/api/regular/index.get.js`）。

過了 `end_date` 的項目不會自動刪除，後台會標成「已結束」，改期間就能重新使用。

---

### shifts
值班記錄（`/shift`）。一個班（date + shift）一筆，合併觀察、醫療、吃藥、備餐、待辦五個分頁
（分頁 value 是 `arrive` / `care` / `meds` / `leave` / `todo`，網址參數 `?tab=` 用的就是這個）。
醫療、吃藥兩個分頁讀同一份 `cats[].medical`，依 `category` 是否為 `medication` 分開。
`/regular`、`/medicine` 維持原樣，跟這張表**不互通**。

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | PK |
| date | DATE | 日期 |
| shift | TEXT | `morning` / `night` |
| cats | JSONB | 每隻貓這一班的快照（結構見下方） |
| tasks | JSONB | 不屬於單一貓咪的項目（全員、小房間…）的快照 |
| note | TEXT | 值班回報，下一班在觀察分頁會看到 |
| member | TEXT | 填表志工名字 |
| updated_by | UUID | FK → auth.users，Realtime 用來忽略自己的更新 |
| created_at / updated_at | TIMESTAMPTZ | |

**UNIQUE** (date, shift)。建表 SQL：[docs/sql/shifts.sql](sql/shifts.sql)

#### cats JSONB 結構

```
[{
  cat_id, name, room,
  intake:    { feed, feed_detail, can, can_detail, urine, feces, feces_warning },  // 觀察，欄位同 regulars
  medical:   [{ notice_id, category, treatment, reason, end_date, done }],       // 醫療分頁（醫療、其他）＋吃藥分頁（吃藥）
  meals:     [{ notice_id, category, treatment, reason }],                       // 備餐：乾乾、罐罐（只看）
  with_meal: [{ notice_id, category, treatment, reason, end_date, done }],       // 備餐：補充、其他（只看；done 沿用欄位但畫面不再打勾）
  todos:     [{ notice_id, category, treatment, reason, end_date, done }],       // 待辦分頁（打勾）
  released:  false                                                               // 備餐：放風（離開時沒關籠）
}]
```

`tasks` 是 `[{ notice_id, name, category, treatment, reason, end_date, done }]`，
飲食類的 tasks（乾乾、罐罐、補充、其他）在備餐分頁**併進每隻適用的貓**：
`name` 是「全員」→ 每隻貓；`name` 等於某個房間（`cats.room`，清單在 `composables/rooms.js`）→ 那個房間的貓。
備餐分頁只看、不打勾，同類別併成一列（乾乾一列、罐罐一列…）；沒有任何貓適用的飲食項目
（例如房間裡還沒有貓）列在貓的後面。
**待辦**有自己的分頁（備餐右邊）：貓自己的待辦列在貓的卡片；全員、房間的待辦（例如小房間柵欄）
整班做一次，不併進每隻貓，用 task 自己的 `done`，列在貓的後面。

**非貓咪項目的排序**（後台與值班表一致）：貓咪在前，然後全員 → 房間（照 `ROOMS` 順序）→ 手動輸入的名稱
（`placeRank`，在 `composables/rooms.js`）。
非飲食類的 tasks（醫療、其他…）放醫療分頁最下面，整班共用一個 `done`。
藥一律歸醫療管理（曾經有過的 `meal_med` 醫藥已併入 `medication` 吃藥）。
`meals` / `with_meal` 是沿用的舊 key 名；更早建立的班裡，`category` 可能是舊值 `meal` / `with_meal` 或不存在，畫面要有預設文字。

**快照，但當天的班會同步**：這一班第一次被打開時（`server/api/shift/index.get.js`）從未領養的 `cats`
與符合班別、期間的 `notices` 建立。之後：

- **當天（台灣時間）的班**：每次載入都用後台最新設定重建，再把這班已填的資料併回去
  （`syncWithSettings`）。觀察、放風照舊；項目照 `notice_id` 保留「完成」；
  後台已刪除但已打勾的項目留著，沒打勾的拿掉；乾乾、罐罐一律用最新的；
  建立後才領養的貓，有填過資料才留著。合併結果不在讀取時寫回，下一次存檔才整筆存回。
- **過去的班**：不再同步，保持當時的樣子。
- 不論哪一天，貓的順序都照貓咪管理**目前**的順序重排（`sortByCatOrder`）。

貓沒有乾乾、罐罐時，`meals` 退回 `cats.diet_note`。

> 這跟 `medicines` / `regulars` 不同：那兩張表建立後就完全不同步。

**放風**：下一班用 `/api/shift/previous`（唯讀，不會建立記錄）讀前一班的 `released`，
在觀察分頁標「上一班放風」。

**整筆覆寫**：存檔時整個 `cats` / `tasks` 一起寫回。兩人同時改不同的貓，後存的會蓋掉先存的。

---

### shift_comments
值班留言（`/shift`）。每隻貓、每個分頁（`tab`）各自一串，跟著這一班（`shift_id`）。
點貓名旁的 💬 從下方滑出面板留言；按鈕上的數字是這一班、這個分頁的留言數。

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | PK |
| shift_id | BIGINT | FK → shifts.id，刪班會一起刪 |
| cat_id | BIGINT | FK → cats.id。只有貓咪卡片能留言 |
| tab | TEXT | `arrive` / `care` / `meds` / `leave` / `todo` |
| body | TEXT | 內容 |
| for_next | BOOLEAN | 給下一班看：下一班**同一分頁、同一隻貓**會在面板上方看到「上一班交代」，💬 上有橘點 |
| author_name | TEXT | 留言當下的暱稱 |
| created_by | UUID | FK → auth.users |
| created_at | TIMESTAMPTZ | |

**只新增、不覆寫**：刻意不放進 `shifts` 的 jsonb（那邊整筆覆寫，多人同時留言會互相蓋掉）。
目前不能編輯或刪除。建表 SQL：[docs/sql/shift_comments.sql](sql/shift_comments.sql)

API：`GET /api/shift/comments?date&shift`（這一班全部＋上一班 `for_next`，唯讀）、
`POST /api/shift/comments`（新增一則）。

---

## Realtime

需啟用 Realtime 的表：
- `votes` - 讓多用戶即時看到彼此的投票
- `calendar_events` - 讓多用戶即時看到彼此的行事曆異動
- `shifts` - 讓同一班的志工即時看到彼此的值班記錄
- `shift_comments` - 留言即時出現（只聽 INSERT）

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
| `medicine/*`、`regular/*`、`shift/*` | `requireUser` |
| `mind/list` | `requireUser` |
| `auth/verify-answer` | **刻意公開** —— 登入前的問答關卡，此時還沒有身分 |

**新增端點時預設加 `requireUser`**，確定要公開才例外，並在程式碼裡註明理由。

> `medicine/index`、`regular/index` 與 `shift/index` 雖然是 GET，但查不到當天記錄時會
> 順手 INSERT 一筆。它們不是唯讀的，別因為是 GET 就以為不用擋。
