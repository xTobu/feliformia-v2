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
| `meal` | 主食 | 飲食管理 `/admin/diet` |
| `with_meal` | 隨餐 | 飲食管理 `/admin/diet` |
| `medical` | 醫療 | 特殊醫療管理 `/admin/notices` |
| `other` | 其他 | 特殊醫療管理 `/admin/notices` |

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | PK |
| name | TEXT | 顯示用名稱。對得到貓時是貓名（取冒號前），對不到時是「全員」「小房間」這類標籤 |
| cat_id | BIGINT | FK → cats.id，可 NULL。NULL 代表不屬於單一貓咪 |
| category | TEXT | 見上表，預設 `medical`，有 CHECK 約束 |
| treatment | TEXT | 內容，必填 |
| reason | TEXT | 原因／備註，可 NULL |
| shift | TEXT | `morning` / `night` / `both` |
| order | INTEGER | 排序（後台拖拉）。**兩個後台各自從 1 編**，數字會重疊，只有同一個 category 群裡的相對順序有意義 |
| start_date | DATE | 期間開始日，NULL 代表不限 |
| end_date | DATE | 期間結束日（含當天），NULL 代表不限 |

**`medicines.cats` 是快照，不是參照。** 某個 date + shift 的紀錄**第一次被打開**時，
`server/api/medicine/index.get.js` 才會把當下符合班別、期間的項目整份複製進去，
之後就不再跟 `notices` 同步。所以修改內容或期間，**已經被打開過的班別不會跟著變**，
從下一個還沒建立的班別開始才會生效。快照**不含主食**（`meal`）。

`regulars` 也一樣是快照：貓名旁的飲食備註取自當下符合班別、期間的主食，
串成一行；該貓沒有主食時退回 `cats.diet_note`（過渡期用，見 `server/api/regular/index.get.js`）。

過了 `end_date` 的項目不會自動刪除，後台會標成「已結束」，改期間就能重新使用。

---

### shifts
值班記錄（`/shift`）。一個班（date + shift）一筆，合併到班、照護、離班。
`/regular`、`/medicine` 維持原樣，跟這張表**不互通**。

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | PK |
| date | DATE | 日期 |
| shift | TEXT | `morning` / `night` |
| cats | JSONB | 每隻貓這一班的快照（結構見下方） |
| tasks | JSONB | 不屬於單一貓咪的項目（全員、小房間…）的快照 |
| note | TEXT | 值班回報，下一班到班時會看到 |
| member | TEXT | 填表志工名字 |
| updated_by | UUID | FK → auth.users，Realtime 用來忽略自己的更新 |
| created_at / updated_at | TIMESTAMPTZ | |

**UNIQUE** (date, shift)。建表 SQL：[docs/sql/shifts.sql](sql/shifts.sql)

#### cats JSONB 結構

```
[{
  cat_id, name, room,
  intake:    { feed, feed_detail, can, can_detail, urine, feces, feces_warning },  // 到班，欄位同 regulars
  medical:   [{ notice_id, treatment, reason, end_date, done }],                 // 照護：醫療＋其他
  meals:     [{ notice_id, treatment, reason }],                                 // 離班：主食
  with_meal: [{ notice_id, treatment, reason, end_date, done }],                 // 離班：隨餐
  released:  false                                                               // 離班：放風（離開時沒關籠）
}]
```

`tasks` 是 `[{ notice_id, name, category, treatment, reason, end_date, done }]`，
`category` 為 `with_meal` 的放離班分頁最上面，其他放照護分頁最下面。

**也是快照**：這一班第一次被打開時（`server/api/shift/index.get.js`）從未領養的 `cats`
與符合班別、期間的 `notices` 建立，之後不再同步。貓沒有主食時，`meals` 退回 `cats.diet_note`。

**放風**：下一班用 `/api/shift/previous`（唯讀，不會建立記錄）讀前一班的 `released`，
在到班分頁標「上一班放風」。

**整筆覆寫**：存檔時整個 `cats` / `tasks` 一起寫回。兩人同時改不同的貓，後存的會蓋掉先存的。

---

## Realtime

需啟用 Realtime 的表：
- `votes` - 讓多用戶即時看到彼此的投票
- `calendar_events` - 讓多用戶即時看到彼此的行事曆異動
- `shifts` - 讓同一班的志工即時看到彼此的值班記錄

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
