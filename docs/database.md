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
| user_id | UUID | FK → auth.users |
| week_start | DATE | 該週週一日期 |
| is_pass | BOOLEAN | 本週是否 Pass |
| data | JSONB | 投票資料（結構見下方） |
| nickname | TEXT | 冗餘欄位，方便查詢顯示 |
| updated_at | TIMESTAMPTZ | 更新時間 |

**PK**: (user_id, week_start)

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

## Realtime

需啟用 Realtime 的表：
- `votes` - 讓多用戶即時看到彼此的投票

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
```

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