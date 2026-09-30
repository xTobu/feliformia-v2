-- ============================================================
-- 行事曆 calendar_events
-- 用途：/calendar 頁面的活動與備註
--
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上執行
--
-- ⚠️⚠️⚠️  這份腳本會先 DROP 再重建，表裡現有的資料會全部消失。  ⚠️⚠️⚠️
-- 只在可以重來的環境執行。正式環境要保留資料的話，
-- 請先把下面那行 drop 註解掉，改寫搬遷腳本。
-- ============================================================

drop table if exists public.calendar_events cascade;

-- ---------- 1. 建表 ----------
create table public.calendar_events (
    id           uuid primary key default gen_random_uuid(),

    date         date not null,                          -- 活動日期
    time_start   text not null,                          -- 'HH:mm'，15 分鐘刻度
    time_end     text not null,                          -- 'HH:mm'，只能晚於 time_start（前端擋）

    type         text not null,                          -- 見 pages/calendar.vue 的 typeList
    notify_roles jsonb not null default '[]'::jsonb,      -- ['morning','night','owner'] 的子集合
    owners       jsonb not null default '[]'::jsonb,      -- profiles.id 的陣列（負責人可多選），
                                                          -- 僅 notify_roles 含 'owner' 時才有值。
                                                          -- 用 jsonb 而不是 uuid[]，跟 notify_roles 一致。
                                                          -- 沒有外鍵保護，但 id 只會從 /api/volunteer/list 來，
                                                          -- 顯示時對 userMap 查，查不到會顯示「未命名」而不是壞掉
    content      text not null,                          -- 備註內容，必填

    -- created_by / deleted_by 指向 auth.users 而不是 profiles：
    -- profiles 是註冊時由前端 upsert 的，萬一那步失敗會有 auth user 但沒有 profile，
    -- 指向 profiles 會讓新增活動直接失敗。auth.users 是母集合，不會漏。
    created_by   uuid references auth.users (id) on delete set null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    -- 軟刪除：不真的 DELETE，保留誰刪的、什麼時候刪
    deleted_at   timestamptz,
    deleted_by   uuid references auth.users (id) on delete set null
);

-- 註：type 刻意「不」加 CHECK 約束。
-- 類型會隨貓屋的實務一直增加（領藥、帶看…），每次都要改 DB 太麻煩。
-- 唯一的真相來源是 pages/calendar.vue 的 typeList；
-- 代價是資料庫擋不住打錯的 type，那筆活動在畫面上會沒有顏色。
--
-- 早期版本有這個約束。既有的資料庫要拿掉的話，單獨跑：
--   alter table public.calendar_events
--       drop constraint if exists calendar_events_type_check;

-- ---------- 2. 索引 ----------
-- 主要查詢是「依日期區間撈未刪除的活動」
create index calendar_events_date_idx
    on public.calendar_events (date)
    where deleted_at is null;

-- ---------- 3. RLS ----------
-- 寫入一律走 server API（service key 繞過 RLS，權限在 server/utils/auth.js 擋），
-- 前端只需要讀取權限：給 Realtime 訂閱與未來可能的直接查詢用。
alter table public.calendar_events enable row level security;

create policy "calendar_events_select" on public.calendar_events
    for select to authenticated using (true);

-- ---------- 4. Realtime ----------
-- 讓多位志工即時看到彼此的新增／修改／刪除。
-- 注意：軟刪除在 Realtime 眼中是 UPDATE 不是 DELETE，訂閱要聽 '*'。
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'calendar_events'
    ) then
        alter publication supabase_realtime add table public.calendar_events;
    end if;
end $$;
