-- /vote 有訂閱 votes 的變動，但 publication 一直沒加，別人投票要重新整理才看得到
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes'
  ) then
    alter publication supabase_realtime add table public.votes;
  end if;
end $$;
