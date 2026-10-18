-- cats、notices、vote_options 原本登入就能改，改成登入可讀、只有管理員能寫。
-- 前端會直接寫這三張表的只有 /admin 底下的頁面；其他地方走 server API（service key 不受 RLS 限制）。

-- security definer：policy 裡直接查 profiles 會再套一次 profiles 的 RLS，用函式繞開
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- cats
drop policy if exists "Allow authenticated users full access to cats" on public.cats;
create policy "Authenticated users can read cats" on public.cats
  for select to authenticated using (true);
create policy "Admins can insert cats" on public.cats
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update cats" on public.cats
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete cats" on public.cats
  for delete to authenticated using (public.is_admin());

-- notices
drop policy if exists "Allow authenticated users full access to notices" on public.notices;
create policy "Authenticated users can read notices" on public.notices
  for select to authenticated using (true);
create policy "Admins can insert notices" on public.notices
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update notices" on public.notices
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete notices" on public.notices
  for delete to authenticated using (public.is_admin());

-- vote_options：讀取沿用原本的 "Allow authenticated users to read vote_options"
drop policy if exists "Allow authenticated users to manage vote_options" on public.vote_options;
create policy "Admins can insert vote_options" on public.vote_options
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update vote_options" on public.vote_options
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete vote_options" on public.vote_options
  for delete to authenticated using (public.is_admin());
