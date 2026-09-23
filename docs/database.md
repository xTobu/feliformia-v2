# Database Schema

## Tables

### profiles
用戶資料表

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK, 對應 auth.users |
| nickname | TEXT | 顯示名稱 |
| is_admin | BOOLEAN | 是否為管理員，預設 FALSE |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

---

### vote_options
投票選項設定

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| name | TEXT | 選項名稱（醫療、灌食、值班、快閃/協助） |
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

## Realtime

需啟用 Realtime 的表：
- `votes` - 讓多用戶即時看到彼此的投票
- `calendar_events` - 讓多用戶即時看到彼此的行事曆異動

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
