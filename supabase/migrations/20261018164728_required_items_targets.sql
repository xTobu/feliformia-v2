-- 收尾項目加回對象：某隻貓、全員、貓屋（整間屋子，跟貓無關）或某個位置。
-- 跟飲食、醫療一樣：cat_id 有值 = 那隻貓；location 有值 = 那個位置；兩個都空 = 全員。
-- 「貓屋」只有收尾能選，所以這張表的 location 清單多一個
alter table public.required_items
  add column cat_id bigint references public.cat_profiles (id) on delete cascade,
  add column location text,
  add constraint required_items_location_check
    check (location in ('貓屋', '客廳', '房間', '倉庫', '隔離區')),
  add constraint required_items_target_check
    check (cat_id is null or location is null);

create index required_items_cat_id_idx on public.required_items (cat_id);

-- 已經建好的收尾項目原本不分對象，都是整間屋子的事
update public.required_items set location = '貓屋' where cat_id is null and location is null;

-- 已經建立的班，快照裡的收尾項目也補上（測試站的測試資料）
update public.shifts s
   set tasks = (
         select jsonb_object_agg(
                  key,
                  case when value ->> 'kind' = 'required' and not (value ? 'location')
                       then value || '{"cat_id": null, "location": "貓屋"}'::jsonb
                       else value
                  end)
           from jsonb_each(s.tasks)
       )
 where tasks <> '{}'::jsonb;
