-- 沒登入的人不該讀得到餵藥與例行紀錄。
-- /medicine、/regular 的即時同步是登入後才訂閱，走 authenticated 的 select policy。
drop policy if exists "Allow anon to read medicines" on public.medicines;
drop policy if exists "Allow anon to read regulars" on public.regulars;
