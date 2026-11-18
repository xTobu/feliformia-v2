-- 舊餵藥紀錄（medicines）的打勾補進已經搬好的 shifts。2026-11-18。
--
-- 20261118071500_regulars_to_shifts 只搬了飲食如廁與回報，每隻貓的 medical 是空的，
-- 所以那些班在醫療照護分頁與貓咪醫療追蹤上是空白的。這一支把打勾補上。
--
-- medicines.cats 是舊 notices 的快照陣列，每一項帶 done
--   { name, treatment, reason, shift, order, start_date, end_date, created_at, done }
-- 正好就是新版 shifts.cats.<cat_id>.medical 的前身（結構見 server/utils/shift.js 開頭）。
--
-- 範圍跟 regulars 那支一致：2026-05-18 起、目前還在的貓（在 cat_profiles 且未領養）。
--
-- 事項的 id 怎麼來：
--   對得上現有 medical_items 的（同一隻貓、treatment 文字一樣）用它的 id 與 category，
--     這樣貓咪醫療追蹤的欄位會跟現在後台的項目對齊。
--   對不上的（這幾年被改掉或刪掉的事項）給一個由 treatment 文字算出來的**負數** id：
--     medical_items 的 id 是正的 identity，所以永遠不會撞號；
--     同一段文字在不同班算出同一個 id，所以追蹤表上會正確併成同一欄。
--     這是刻意保留的 —— shift.js 本來就寫著「後台已刪除或過期、但這班已經打勾的留著當紀錄」。
--
-- done_by / done_at：舊系統的 member 是「那一班誰值班」而不是「誰勾的這一項」，
--   所以勾過的項目一律記成那一班的值班者與建立時間，沒勾的留空。
--   新版值班表 2026-11-12 起已經不顯示誰、幾點了，這兩個欄位只是留著當紀錄。
--
-- 全員的項目（medicines 裡 name = '全員' 的）放在 shifts.tasks 而不是 cats，
--   key 是 medical:<id>，結構見 shift.js 的 tasks 註解。貓咪醫療追蹤（/weekly-medicine）
--   兩種都會列（全員的那欄 source 寫「全員」），所以要分開處理。
--   notices 那支 migration 也是這樣對待「全員」的，兩邊一致。
--   其餘對不到貓又不是「全員」的名字（像「小房間」「插電費洛蒙檢查」，本來就不是貓名）不搬，
--   會在輸出列出來 —— 跟 notices 那支留給使用者手動建的是同一批。
--
-- 安全性（重要）：**只填 medical 目前是空物件的貓**，全員的只填 tasks 還是空物件的班。
--   所以不會蓋掉新制上線後志工真的勾過的任何東西，而且重跑無害（第二次跑就不是空的了）。
--   舊 medicines 表完全不動，/weekly-medicine 還是照原樣讀它。

do $$
declare
    v_from       date := '2026-05-18';   -- 跟 regulars 那支同一個起點
    v_shifts     integer;
    v_tasks      integer;
    v_cells      bigint;
    v_matched    bigint;
    v_synthetic  bigint;
    v_no_shift   bigint;
    v_no_cat     text[];
begin
    -- ── 統計（先算，之後的 update 會讓「medical 是空的」這個條件不再成立）──
    with ent as (
        select m.date, m.shift::text as sh, x as item
          from public.medicines m
          cross join lateral jsonb_array_elements(
                   case when jsonb_typeof(m.cats::jsonb) = 'array' then m.cats::jsonb else '[]'::jsonb end
               ) x
         where m.date >= v_from
    )
    select count(*),
           count(*) filter (where exists (
               select 1 from public.cat_profiles c
                join public.medical_items mi on mi.cat_id = c.id
               where coalesce(c.adopted, false) = false
                 and c.name = btrim(ent.item->>'name')
                 and btrim(mi.treatment) = btrim(ent.item->>'treatment'))),
           count(*) filter (where not exists (
               select 1 from public.shifts s where s.date = ent.date and s.shift = ent.sh)),
           coalesce((select array_agg(distinct btrim(item->>'name'))
                       from ent
                      where not exists (select 1 from public.cat_profiles c
                                         where coalesce(c.adopted, false) = false
                                           and c.name = btrim(ent.item->>'name'))), '{}'::text[])
      into v_cells, v_matched, v_no_shift, v_no_cat
      from ent;

    -- ── 真正的更新 ──
    with ent as (
        select m.date,
               m.shift::text as sh,
               coalesce(nullif(btrim(m.member), ''), '舊資料') as member,
               m."createdTime" as at,
               c.id as cat_id,
               x as item
          from public.medicines m
          cross join lateral jsonb_array_elements(
                   case when jsonb_typeof(m.cats::jsonb) = 'array' then m.cats::jsonb else '[]'::jsonb end
               ) x
          -- 目前還在的貓才搬（同 regulars 那支）
          join public.cat_profiles c
            on coalesce(c.adopted, false) = false
           and c.name = btrim(x->>'name')
         where m.date >= v_from
    ),
    keyed as (
        select e.date, e.sh, e.cat_id, e.item, e.member, e.at,
               mi.id       as mi_id,
               mi.category as mi_category,
               -- 對得上就用真 id；對不上就用文字算出來的穩定負數 id
               coalesce(mi.id, -(abs(hashtext(btrim(e.item->>'treatment'))::bigint) % 1000000000) - 1) as item_id
          from ent e
          left join lateral (
              select mi.id, mi.category
                from public.medical_items mi
               where mi.cat_id = e.cat_id
                 and btrim(mi.treatment) = btrim(e.item->>'treatment')
               order by mi.id
               limit 1
          ) mi on true
    ),
    per_cat as (
        select date, sh, cat_id,
               jsonb_object_agg(item_id::text, jsonb_build_object(
                   'id',        item_id,
                   'category',  coalesce(mi_category, '餵藥'),
                   'treatment', btrim(item->>'treatment'),
                   'reason',    nullif(btrim(coalesce(item->>'reason', '')), ''),
                   'end_date',  item->'end_date',
                   'sort',      case when jsonb_typeof(item->'order') = 'number' then item->'order' else 'null'::jsonb end,
                   'done',      coalesce((item->>'done')::boolean, false),
                   'done_by',   case when coalesce((item->>'done')::boolean, false) then member else null end,
                   'done_at',   case when coalesce((item->>'done')::boolean, false)
                                     then to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end
               )) as medical
          from keyed
         group by date, sh, cat_id
    ),
    per_shift as (
        select date, sh, jsonb_object_agg(cat_id::text, medical) as by_cat
          from per_cat
         group by date, sh
    )
    update public.shifts s
       set cats = (
               select jsonb_object_agg(k, case
                          -- 只填目前是空的：不蓋掉新制志工真的勾過的東西，重跑也無害
                          when p.by_cat ? k and coalesce(v->'medical', '{}'::jsonb) = '{}'::jsonb
                              then jsonb_set(v, '{medical}', p.by_cat -> k)
                          else v
                      end)
                 from jsonb_each(s.cats) as t(k, v)
           )
      from per_shift p
     where s.date = p.date
       and s.shift = p.sh
       and s.cats <> '{}'::jsonb
       -- 這一班至少有一隻貓還是空的才動（避免無意義的寫入）
       and exists (
           select 1 from jsonb_each(s.cats) as t(k, v)
            where p.by_cat ? k and coalesce(v->'medical', '{}'::jsonb) = '{}'::jsonb
       );

    get diagnostics v_shifts = row_count;

    -- ── 全員的項目 → shifts.tasks ──
    with ent as (
        select m.date,
               m.shift::text as sh,
               coalesce(nullif(btrim(m.member), ''), '舊資料') as member,
               m."createdTime" as at,
               x as item
          from public.medicines m
          cross join lateral jsonb_array_elements(
                   case when jsonb_typeof(m.cats::jsonb) = 'array' then m.cats::jsonb else '[]'::jsonb end
               ) x
         where m.date >= v_from
           and btrim(x->>'name') = '全員'
    ),
    keyed as (
        select e.*, mi.id as mi_id, mi.category as mi_category,
               coalesce(mi.id, -(abs(hashtext(btrim(e.item->>'treatment'))::bigint) % 1000000000) - 1) as item_id
          from ent e
          left join lateral (
              select mi.id, mi.category
                from public.medical_items mi
               where mi.cat_id is null and mi.location is null
                 and btrim(mi.treatment) = btrim(e.item->>'treatment')
               order by mi.id
               limit 1
          ) mi on true
    ),
    per_shift as (
        select date, sh,
               jsonb_object_agg('medical:' || item_id::text, jsonb_build_object(
                   'kind',      'medical',
                   'location',  null,
                   'id',        item_id,
                   'category',  coalesce(mi_category, '餵藥'),
                   'treatment', btrim(item->>'treatment'),
                   'reason',    nullif(btrim(coalesce(item->>'reason', '')), ''),
                   'end_date',  item->'end_date',
                   'sort',      case when jsonb_typeof(item->'order') = 'number' then item->'order' else 'null'::jsonb end,
                   'done',      coalesce((item->>'done')::boolean, false),
                   'done_by',   case when coalesce((item->>'done')::boolean, false) then member else null end,
                   'done_at',   case when coalesce((item->>'done')::boolean, false)
                                     then to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end
               )) as tasks
          from keyed
         group by date, sh
    )
    update public.shifts s
       set tasks = p.tasks
      from per_shift p
     where s.date = p.date
       and s.shift = p.sh
       -- 只填空的：不蓋掉新制的 tasks，重跑無害
       and coalesce(s.tasks, '{}'::jsonb) = '{}'::jsonb;

    get diagnostics v_tasks = row_count;
    v_synthetic := v_cells - v_matched;

    raise notice '更新了 % 班的貓咪醫療打勾、% 班的全員項目（% 起）', v_shifts, v_tasks, v_from;
    raise notice '事項格子共 %：% 格對上現有的醫療項目，% 格用算出來的 id（已被改掉或刪掉的事項）',
                 v_cells, v_matched, v_synthetic;
    if v_no_shift > 0 then
        raise notice '% 格因為 shifts 沒有那一天那一班而沒搬', v_no_shift;
    end if;
    if cardinality(v_no_cat) > 0 then
        raise notice '這些名字對不到目前還在的貓（「全員」已另外處理），沒搬：%', v_no_cat;
    end if;
end $$;
