-- 補上 regulars_to_shifts 跳過的那幾班。2026-11-18。
--
-- 20261118071500_regulars_to_shifts 的條件是「只插入 shifts 還沒有的 (date, shift)」，
-- 為的是不蓋掉新制志工真的填過的東西。但上線當天（2026-11-18）早班兩邊都有資料：
-- 志工早上在舊的 /regular 填了 9 隻貓，部署之後有人打開新版 /shift 建出一筆空殼，
-- migration 看到那一筆就整班跳過，舊資料因此沒搬過來。
--
-- 這一支改成**逐格**比對，不再整班二選一：
--   每一隻貓的 intake 還是「到班預設值」（server/utils/shift.js 的 defaultIntake、
--   composables/intake.js 的 isIntakeTouched 同一套條件）才填舊的；
--   只要有人動過任何一格就整隻跳過。
--   回報也一樣：新版 arrive 那段是空的才填舊的。
--
-- 範圍寫成整個窗口而不是只針對今天，萬一還有別的班也被跳過就一併補上。
-- 重跑無害（填過之後就不是預設值了）。放風、醫療不碰（醫療由 medicines_to_shifts 處理）。

do $$
declare
    v_from  date := '2026-05-18';
    v_cats  integer;
    v_notes integer;
begin
    -- ── 1. 每隻貓的飲食如廁 ──
    with ent as (
        select r.date, r.shift::text as sh, c.id as cat_id, x as item
          from public.regulars r
          cross join lateral jsonb_array_elements(
                   case when jsonb_typeof(r.cats::jsonb) = 'array' then r.cats::jsonb else '[]'::jsonb end
               ) x
          -- 對應規則與 regulars_to_shifts 一致：先用數字 recordId，再退回名字；只收目前還在的貓
          join public.cat_profiles c
            on coalesce(c.adopted, false) = false
           and c.id = coalesce(
                   (select c1.id from public.cat_profiles c1
                     where c1.id = case when x->'cat'->>'recordId' ~ '^[0-9]+$'
                                        then (x->'cat'->>'recordId')::bigint end),
                   (select min(c2.id) from public.cat_profiles c2
                     where coalesce(c2.adopted, false) = false
                       and c2.name = btrim(x->>'name') having count(*) = 1)
               )
         where r.date >= v_from
           and r.shift::text in ('morning', 'night')
    ),
    -- 這一格新版還沒人動過（七個欄位全是到班預設值）才要填
    todo as (
        select e.date, e.sh, e.cat_id, e.item
          from ent e
          join public.shifts s on s.date = e.date and s.shift = e.sh
         where s.cats ? e.cat_id::text
           and coalesce((s.cats -> e.cat_id::text -> 'intake' ->> 'feed')::boolean, true) is true
           and coalesce((s.cats -> e.cat_id::text -> 'intake' ->> 'feed_detail')::numeric, 0) = 0
           and coalesce((s.cats -> e.cat_id::text -> 'intake' ->> 'can')::boolean, false) is false
           and coalesce((s.cats -> e.cat_id::text -> 'intake' ->> 'can_detail')::numeric, 0) = 0
           and coalesce((s.cats -> e.cat_id::text -> 'intake' ->> 'urine')::boolean, false) is false
           and coalesce((s.cats -> e.cat_id::text -> 'intake' ->> 'feces')::boolean, false) is false
           and (s.cats -> e.cat_id::text -> 'intake' ->> 'feces_warning') is null
           -- 舊的那一格本身要有人填過，不然等於白寫
           and (coalesce((e.item->>'feed_detail')::numeric, 0) <> 0
                or coalesce((e.item->>'can')::boolean, false)
                or coalesce((e.item->>'can_detail')::numeric, 0) <> 0
                or coalesce((e.item->>'urine')::boolean, false)
                or coalesce((e.item->>'feces')::boolean, false)
                or e.item->>'feces_warning' is not null
                or coalesce((e.item->>'feed')::boolean, true) is false)
    ),
    per_shift as (
        select date, sh,
               jsonb_object_agg(cat_id::text, jsonb_build_object(
                   'feed',          case when jsonb_typeof(item->'feed') = 'boolean' then item->'feed' else 'true'::jsonb end,
                   'feed_detail',   case when jsonb_typeof(item->'feed_detail') = 'number' then item->'feed_detail' else '0'::jsonb end,
                   'can',           case when jsonb_typeof(item->'can') = 'boolean' then item->'can' else 'false'::jsonb end,
                   'can_detail',    case when jsonb_typeof(item->'can_detail') = 'number' then item->'can_detail' else '0'::jsonb end,
                   'urine',         case when jsonb_typeof(item->'urine') = 'boolean' then item->'urine' else 'false'::jsonb end,
                   'feces',         case when jsonb_typeof(item->'feces') = 'boolean' then item->'feces' else 'false'::jsonb end,
                   'feces_warning', case when jsonb_typeof(item->'feces_warning') = 'string' then item->'feces_warning' else 'null'::jsonb end
               )) as by_cat
          from todo
         group by date, sh
    )
    update public.shifts s
       set cats = (
               select jsonb_object_agg(k, case
                          when p.by_cat ? k then jsonb_set(v, '{intake}', p.by_cat -> k)
                          else v
                      end)
                 from jsonb_each(s.cats) as t(k, v)
           )
      from per_shift p
     where s.date = p.date and s.shift = p.sh;

    get diagnostics v_cats = row_count;

    -- ── 2. 回報：新版 arrive 那段是空的才填舊的 ──
    update public.shifts s
       -- 用 care_system 建的 jsonb_deep_set：reports 是 {} 的時候中間那層 arrive 會自動補出來。
       -- 直接 jsonb_set('{arrive,_shared}') 的話，父層不存在它會原封不動回傳，什麼都不會寫進去
       set reports = public.jsonb_deep_set(
               coalesce(s.reports, '{}'::jsonb),
               array['arrive', '_shared'],
               jsonb_build_object(
                   'name', coalesce(nullif(btrim(r.member), ''), '舊資料'),
                   'text', btrim(r.note),
                   'at', to_char(r."createdTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ))
      from public.regulars r
     where r.date = s.date
       and r.shift::text = s.shift
       and r.date >= v_from
       and coalesce(btrim(r.note), '') <> ''
       and coalesce(btrim(s.reports -> 'arrive' -> '_shared' ->> 'text'), '') = '';

    get diagnostics v_notes = row_count;

    raise notice '補了 % 班的飲食如廁、% 班的回報（% 起，只填還沒人動過的格子）', v_cats, v_notes, v_from;
end $$;
