-- 舊值班紀錄（regulars）最近半年、目前還在的貓咪，搬進新版值班紀錄（shifts）。2026-11-18。
--
-- 為什麼：新制 2026-10-18 才開始記 shifts，/weekly 與貓咪健康紀錄因此看不到更早的資料。
-- 舊的 regulars 從 2025-01-07 就有，而且飲食如廁的欄位跟新版「完全一樣」
-- （server/utils/shift.js 的 defaultIntake：feed、feed_detail、can、can_detail、urine、feces、feces_warning），
-- 所以可以原樣搬過來。
--
-- **只搬 2026-05-18 起**（使用者 2026-11-18 決定只要最近半年）。更早的不搬，原因：
--   2025-03 ～ 2026-04 那段的 cats 陣列裡，name 欄位是「名字：飲食說明」合在一起的顯示字串
--     （例如「烏妮：成幼 2.5匙」），對不到貓；
--   2025-04-24 ～ 04-30 的 cat.recordId 是 Airtable 的字串 id（例如 recTlKicz5zmJSZ8k）；
--   2025-03-01 ～ 04-24 根本沒有 cat.recordId。
--   半年窗口內這三種狀況都沒有，全部是乾淨的數字 recordId。
--   測試站實測：322 班、4815 個貓咪格子，4644 格對得上（96.5%）。
--
-- 對應：
--   date、shift        → date、shift（舊 enum_shift 的 morning/night 直接用；'both' 不搬，會列出來）
--   cats（JSON 陣列）  → cats（以 cat_id 為 key 的物件，shift.js 的快照格式）
--     每隻貓用 cat.recordId 對 cat_profiles.id（舊 cats.id 在 care_system 已沿用過去），
--     對不到的退回用名字比對（同名多於一隻就放棄那一格）
--   note               → reports.arrive._shared.text（飲食如廁分頁的回報）
--   member             → reports.arrive._shared.name（新格式的 name 就是「最後存的人」）
--   createdTime        → created_at，也當回報的時間
--   modifiedTime       → updated_at
--   updated_by         → updated_by
--
-- 搬不了的，照實呈現、不假裝：
--   released / prev_released 一律 false —— 舊系統沒有「這班有沒有放風」這個欄位。
--     使用者 2026-11-18 決定就讓它顯示叉叉，不另外加「沒有資料」的記號。
--   medical / diet / observe 都是空物件 —— 舊系統沒有逐項打勾，醫療追蹤對舊的班會是空白。
--   tasks 空物件。
--   只搬「目前還在的貓咪」（使用者 2026-11-18 決定）：
--     已經從貓咪名單刪掉的（送走、不在了）—— 新系統沒有牠的檔案，搬進去也沒頁面能看；
--     以及已領養的（adopted）—— 跟新版 /shift 一致。
--     這兩種的格子都不搬，那一班的其他貓照搬。測試站對不到的 171 格全是「雷丘（鯉魚）」。
--
-- 安全性：只插入 shifts 還沒有的 (date, shift)，所以重跑無害，
-- 也不會動到新制 2026-10-18 之後已經有人填的班。舊 regulars 表完全不動。

do $$
declare
    v_from      date := '2026-05-18';   -- 最近半年的起點
    v_inserted  integer;
    v_exists    integer;
    v_both      integer;
    v_cells     bigint;
    v_unmatched bigint;
    v_names     text[];
begin
    select count(*) into v_exists
      from public.regulars r
     where r.date >= v_from
       and r.shift::text in ('morning', 'night')
       and exists (select 1 from public.shifts s where s.date = r.date and s.shift = r.shift::text);

    select count(*) into v_both
      from public.regulars r
     where r.date >= v_from
       and (r.shift::text not in ('morning', 'night') or r.shift is null);

    insert into public.shifts (date, shift, cats, tasks, reports, updated_by, created_at, updated_at)
    select r.date,
           r.shift::text,
           coalesce(b.cats, '{}'::jsonb),
           '{}'::jsonb,
           case
               when coalesce(btrim(r.note), '') = '' then '{}'::jsonb
               else jsonb_build_object(
                        'arrive', jsonb_build_object(
                            '_shared', jsonb_build_object(
                                'name', coalesce(nullif(btrim(r.member), ''), '舊資料'),
                                'text', btrim(r.note),
                                'at', to_char(r."createdTime" at time zone 'UTC',
                                              'YYYY-MM-DD"T"HH24:MI:SS"Z"'))))
           end,
           r.updated_by,
           r."createdTime",
           coalesce(r."modifiedTime", r."createdTime")
      from public.regulars r
      left join lateral (
          select jsonb_object_agg(m.cat_id::text, jsonb_build_object(
                     'cat_id',   m.cat_id,
                     'name',     m.name,
                     'location', m.location,
                     'sort',     m.sort,
                     'intake', jsonb_build_object(
                         'feed',          case when jsonb_typeof(m.e->'feed') = 'boolean' then m.e->'feed' else 'false'::jsonb end,
                         'feed_detail',   case when jsonb_typeof(m.e->'feed_detail') = 'number' then m.e->'feed_detail' else '0'::jsonb end,
                         'can',           case when jsonb_typeof(m.e->'can') = 'boolean' then m.e->'can' else 'false'::jsonb end,
                         'can_detail',    case when jsonb_typeof(m.e->'can_detail') = 'number' then m.e->'can_detail' else '0'::jsonb end,
                         'urine',         case when jsonb_typeof(m.e->'urine') = 'boolean' then m.e->'urine' else 'false'::jsonb end,
                         'feces',         case when jsonb_typeof(m.e->'feces') = 'boolean' then m.e->'feces' else 'false'::jsonb end,
                         'feces_warning', case when jsonb_typeof(m.e->'feces_warning') = 'string' then m.e->'feces_warning' else 'null'::jsonb end
                     ),
                     -- 舊系統沒有放風紀錄
                     'released',      false,
                     'prev_released', false,
                     -- 舊系統沒有逐項打勾
                     'medical', '{}'::jsonb,
                     'diet',    '{}'::jsonb,
                     'observe', '{}'::jsonb
                 )) as cats
          from (
              select e,
                     c.id       as cat_id,
                     c.name     as name,
                     c.location as location,
                     coalesce(c.sort_order, 9007199254740991) as sort
                from jsonb_array_elements(
                         case when jsonb_typeof(r.cats::jsonb) = 'array' then r.cats::jsonb else '[]'::jsonb end
                     ) e
                -- 只搬「目前還在」的貓：還在貓咪名單裡（join 不成立的就是已經刪掉的），
                -- 而且沒有領養走。跟新版 /shift 一致（server/utils/shift.js 的 buildShift
                -- 也是 .filter((c) => !c.adopted)）
                join public.cat_profiles c
                  on coalesce(c.adopted, false) = false
                 and c.id = coalesce(
                         -- recordId 只有純數字才是 cat id；半年窗口內全部都是，
                         -- 但 case 擋著比較安全（更早的資料有 Airtable 的字串 id，直接 ::bigint 會整支掛掉）
                         (select c1.id from public.cat_profiles c1
                           where c1.id = case when e->'cat'->>'recordId' ~ '^[0-9]+$'
                                              then (e->'cat'->>'recordId')::bigint end),
                         -- 對不到的退回名字；同名多於一隻就放棄（回 null，join 不成立）
                         (select min(c2.id) from public.cat_profiles c2
                           where coalesce(c2.adopted, false) = false
                             and c2.name = btrim(e->>'name') having count(*) = 1)
                     )
          ) m
      ) b on true
     where r.date >= v_from
       and r.shift::text in ('morning', 'night')
       and not exists (select 1 from public.shifts s where s.date = r.date and s.shift = r.shift::text);

    get diagnostics v_inserted = row_count;

    -- 有多少貓咪格子對不到 cat_profiles（領養走、送走而從 cats 刪掉的貓）
    with cell as (
        select btrim(e->>'name') as nm,
               coalesce(
                   (select c1.id from public.cat_profiles c1
                     where coalesce(c1.adopted, false) = false
                       and c1.id = case when e->'cat'->>'recordId' ~ '^[0-9]+$'
                                        then (e->'cat'->>'recordId')::bigint end),
                   (select min(c2.id) from public.cat_profiles c2
                     where coalesce(c2.adopted, false) = false
                       and c2.name = btrim(e->>'name') having count(*) = 1)
               ) as hit
          from public.regulars r,
               jsonb_array_elements(
                   case when jsonb_typeof(r.cats::jsonb) = 'array' then r.cats::jsonb else '[]'::jsonb end
               ) e
         where r.date >= v_from
           and r.shift::text in ('morning', 'night')
    )
    select count(*), count(*) filter (where hit is null),
           coalesce((select array_agg(distinct coalesce(nullif(nm, ''), '(名字空白)'))
                       from cell where hit is null), '{}'::text[])
      into v_cells, v_unmatched, v_names
      from cell;

    raise notice '搬了 % 班進 shifts（% 起）', v_inserted, v_from;
    if v_exists > 0 then
        raise notice '% 班因為 shifts 已經有同一天同一班而跳過（新制填過的不動）', v_exists;
    end if;
    if v_both > 0 then
        raise notice '% 班的 shift 不是 morning/night，沒搬（shifts 只收這兩種）', v_both;
    end if;
    raise notice '貓咪格子共 %，% 格對不到（已經不在貓咪名單裡的貓）：%', v_cells, v_unmatched, v_names;
end $$;
