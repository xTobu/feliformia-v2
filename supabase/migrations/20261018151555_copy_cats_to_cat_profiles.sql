-- 一次性：把舊 cats 複製到 cat_profiles，沿用原本的 id，新舊對得起來。
-- 之後兩邊各自獨立，舊版改貓咪不會同步過來。
-- 不帶 diet_note（飲食改在 diet_items 管理，先為空）與 reminder（不保留）。
insert into public.cat_profiles (id, name, location, adopted, sort_order, created_at)
overriding system value
select
  id,
  name,
  case when room in ('客廳', '房間', '倉庫', '隔離區') then room end,
  coalesce(adopted, false),
  "order",
  created_at
from public.cats
where name is not null;

-- 自動編號接在最大的 id 後面，之後新增才不會撞號
select setval(
  pg_get_serial_sequence('public.cat_profiles', 'id'),
  coalesce((select max(id) from public.cat_profiles), 1),
  (select count(*) > 0 from public.cat_profiles)
);
