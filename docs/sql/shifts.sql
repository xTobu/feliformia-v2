-- ============================================================
-- 值班記錄 shifts
-- 用途：/shift 頁面。一個班（date + shift）一筆，
--       合併觀察（吃喝排泄）、醫療（醫療事項）、備餐（乾乾、罐罐、補充、其他、放風）
--
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上執行
-- 用 if not exists，重跑不會清掉資料
-- ============================================================

-- ---------- 1. 建表 ----------
create table if not exists public.shifts (
    id          bigint generated always as identity primary key,

    date        date not null,
    shift       text not null check (shift in ('morning', 'night')),

    -- 這一班第一次被打開時，從 cats / notices 複製的快照，之後不再跟後台同步。
    -- 每隻貓一個物件，結構見 docs/database.md 的 shifts 段落
    cats        jsonb not null default '[]'::jsonb,
    -- 不屬於單一貓咪的項目（全員、小房間…），同樣是快照
    tasks       jsonb not null default '[]'::jsonb,

    note        text,                                    -- 值班回報
    member      text,                                    -- 填表志工（名字，跟 regulars / medicines 一致）

    -- 指向 auth.users 而不是 profiles，理由同 calendar_events
    updated_by  uuid references auth.users (id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    -- 兩個人同時打開同一班時，只會有一個人建立成功，另一個重新讀取
    unique (date, shift)
);

-- ---------- 2. RLS ----------
-- 寫入一律走 server API（service key 繞過 RLS，權限在 server/utils/auth.js 擋），
-- 前端只需要讀取權限，給 Realtime 訂閱用。
alter table public.shifts enable row level security;

drop policy if exists "shifts_select" on public.shifts;
create policy "shifts_select" on public.shifts
    for select to authenticated using (true);

-- ---------- 3. Realtime ----------
-- 讓同一班的多位志工即時看到彼此的修改
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'shifts'
    ) then
        alter publication supabase_realtime add table public.shifts;
    end if;
end $$;
