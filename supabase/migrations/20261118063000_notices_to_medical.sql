-- 舊「餵藥及特殊飲食管理」（notices）搬進新版醫療管理（medical_items）。2026-11-18。
--
-- 只在「還沒有任何醫療項目」的站台執行：
--   正式站 2026-11-18 剛跑完 care_system，medical_items 是空的 → 會搬。
--   測試站的 medical_items 是手動建的（6 筆）→ 跳過，不會被灌進 notices。
-- ⚠️ 所以正式站要先跑這支，再去 /admin/medical 手動建項目。順序反了就會整支跳過。
--
-- 欄位對應（舊 → 新）：
--   treatment            → treatment
--   reason               → reason（空字串當成沒填）
--   shift                → shift（舊的 enum_shift 就是 morning/night/both，值完全一樣；null 當 both）
--   start_date/end_date  → start_date/end_date
--   order                → sort_order
--   created_at           → created_at（保留原本的建立時間）
--   name = '全員'        → cat_id、location 都留空（新表的全員項目，整班勾一次）
--   name = 貓名          → cat_id（照 cat_profiles.name 比對）
--   （沒有）             → category 一律填「餵藥」
--
-- category 舊表沒有這個概念。舊頁面叫「餵藥及特殊飲食管理」，多數是餵藥，所以統一填「餵藥」，
-- 之後在 /admin/medical 改成醫療／外用／隨餐藥／其他。
--
-- 其餘對不到貓的不搬（位置名稱、本來就不是貓名的項目），連同同名貓多於一隻無法判斷的，
-- 都會在 db push 的輸出列出來，請手動建。舊 notices 表完全不動，/admin/notices 還查得到原始資料。

do $$
declare
    v_moved   integer;
    v_skipped text[];
begin
    if exists (select 1 from public.medical_items) then
        raise notice 'medical_items 已經有資料，跳過 notices 搬移（這一站的醫療項目是手動建的）';
        return;
    end if;

    insert into public.medical_items
        (cat_id, category, treatment, reason, shift, start_date, end_date, sort_order, created_at)
    select c.id,                      -- 全員那幾筆這裡是 null，正好就是新表「全員」的表示法
           '餵藥',
           btrim(n.treatment),
           nullif(btrim(n.reason), ''),
           coalesce(n.shift::text, 'both'),
           n.start_date,
           n.end_date,
           n."order",
           n.created_at
      from public.notices n
      -- left join：全員那幾筆對不到貓也要留下來，cat_id 就是 null
      left join public.cat_profiles c on c.name = btrim(n.name)
     where coalesce(btrim(n.treatment), '') <> ''
       and (
            btrim(n.name) = '全員'
            -- 同名的貓不只一隻就無法判斷是哪隻，一律不搬
            or (select count(*) from public.cat_profiles c2 where c2.name = btrim(n.name)) = 1
           );

    get diagnostics v_moved = row_count;
    raise notice '搬了 % 筆 notices 進 medical_items（category 都填「餵藥」）', v_moved;

    select coalesce(
               array_agg(coalesce(nullif(btrim(n.name), ''), '(名字空白)')
                         || ' → ' || left(btrim(n.treatment), 24)
                         order by n."order"),
               '{}'::text[])
      into v_skipped
      from public.notices n
     where coalesce(btrim(n.treatment), '') <> ''
       and btrim(n.name) is distinct from '全員'
       and (select count(*) from public.cat_profiles c2 where c2.name = btrim(n.name)) <> 1;

    if cardinality(v_skipped) > 0 then
        raise notice '以下 % 筆對不到貓、沒有搬，請自己在 /admin/medical 建：', cardinality(v_skipped);
        raise notice '%', E'\n  · ' || array_to_string(v_skipped, E'\n  · ');
    end if;
end $$;
