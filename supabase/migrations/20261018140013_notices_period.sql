-- 餵藥事項可設定期間：NULL 代表不限
alter table public.notices
  add column if not exists start_date date,
  add column if not exists end_date date;
