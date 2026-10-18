-- ============================================================
-- 值班留言 shift_comments
-- 用途：/shift 每隻貓、每個分頁各自一串留言，跟著這一班。
--       勾「給下一班」的（for_next）會在下一班同一分頁、同一隻貓出現
--
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上執行
-- 用 if not exists，重跑不會清掉資料
-- ============================================================

-- ---------- 1. 建表 ----------
-- 一則留言一筆、只新增：不放進 shifts 的 jsonb，是因為那邊整筆覆寫，多人同時留言會互相蓋掉
create table if not exists public.shift_comments (
    id          bigint generated always as identity primary key,
    shift_id    bigint not null references public.shifts (id) on delete cascade,
    cat_id      bigint not null references public.cats (id) on delete cascade,
    tab         text not null,                       -- arrive / care / meds / leave / todo
    body        text not null,
    for_next    boolean not null default false,      -- 給下一班看
    author_name text,                                -- 留言當下的暱稱，之後改暱稱不影響舊留言
    created_by  uuid references auth.users (id) on delete set null,
    created_at  timestamptz not null default now()
);

create index if not exists shift_comments_shift_idx on public.shift_comments (shift_id);

-- ---------- 2. RLS ----------
-- 寫入一律走 server API（service key），前端只需要讀取權限給 Realtime 用
alter table public.shift_comments enable row level security;

drop policy if exists "shift_comments_select" on public.shift_comments;
create policy "shift_comments_select" on public.shift_comments
    for select to authenticated using (true);

-- ---------- 3. Realtime ----------
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'shift_comments'
    ) then
        alter publication supabase_realtime add table public.shift_comments;
    end if;
end $$;
