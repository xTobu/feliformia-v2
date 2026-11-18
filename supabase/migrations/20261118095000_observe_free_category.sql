-- 觀察管理：類別開放自由輸入，分頁改成明講的欄位。2026-11-18。
--
-- 以前「剛到／離開」兩組不只是下拉的分組，它還決定膠囊出現在值班表的哪個分頁
-- （composables/observeItems.js 的 OBSERVE_GROUPS：剛到→arrive、離開→meal）。
-- 使用者想自己新增類別（例如「拍胰島素」），所以把這條隱形規則改成一個明講的欄位：
--   tab      這一項出現在哪個分頁（arrive = 飲食如廁、meal = 備餐）
--   category 從四選一放寬成自由文字（原本的四個變成下拉的建議選項）
--
-- 「放風」仍是特例：它不是膠囊，是「這隻貓這一班預設放出來」的開關
-- （server/utils/shift.js 的 RELEASE）。後台選到它時分頁鎖成 meal。

alter table public.observe_items
    add column if not exists tab text not null default 'arrive';

-- 回填：照原本的剛到／離開規則
update public.observe_items set tab = 'meal' where category in ('拍留餐', '放風');

alter table public.observe_items
    drop constraint if exists observe_items_tab_check,
    add constraint observe_items_tab_check check (tab in ('arrive', 'meal'));

-- 類別不再限定那四個，只要不是空白
alter table public.observe_items
    drop constraint if exists observe_items_category_check,
    add constraint observe_items_category_check check (btrim(category) <> '');
