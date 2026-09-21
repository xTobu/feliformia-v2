-- ============================================================
-- 行事曆與備註區 calendar_events
-- 用途：/calendar 頁面的活動與備註
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上執行
-- 可重複執行（全部都有 if not exists / drop 保護）
-- ============================================================

-- ---------- 1. 建表 ----------
create table if not exists public.calendar_events (
    id           uuid primary key default gen_random_uuid(),

    date         date not null,                          -- 活動日期
    time_start   text not null,                          -- 'HH:mm'，15 分鐘刻度
    time_end     text not null,                          -- 'HH:mm'，不做早於開始的防呆（與 /vote 一致）

    type         text not null,                          -- volunteer / supplies / dispatch / post / other
    notify_roles jsonb not null default '[]'::jsonb,      -- ['morning','night','owner'] 的子集合
    owner        uuid references public.profiles (id) on delete set null,
                                                         -- 僅 notify_roles 含 'owner' 時才有值
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

-- 類型白名單。日後要新增類型，記得同步 pages/calendar.vue 的 typeList
alter table public.calendar_events
    drop constraint if exists calendar_events_type_check;
alter table public.calendar_events
    add constraint calendar_events_type_check
    check (type in ('volunteer', 'supplies', 'dispatch', 'post', 'other'));

-- ---------- 2. 索引 ----------
-- 主要查詢是「依日期區間撈未刪除的活動」
create index if not exists calendar_events_date_idx
    on public.calendar_events (date)
    where deleted_at is null;

-- ---------- 3. RLS ----------
-- 寫入一律走 server API（service key 繞過 RLS），
-- 前端只需要讀取權限：給 Realtime 訂閱與未來可能的直接查詢用。
alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select" on public.calendar_events;
create policy "calendar_events_select" on public.calendar_events
    for select to authenticated using (true);

-- ---------- 4. Realtime ----------
-- 讓多位志工即時看到彼此的新增／修改／刪除。
-- 注意：軟刪除在 Realtime 眼中是 UPDATE 不是 DELETE。
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
