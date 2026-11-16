-- 顯示偏好。有志工反映值班表上「還沒做」的標示會造成壓力（看了不舒服），
-- 所以讓每個人自己決定要不要看見。2026-11-16。
--
--   show_check_hint  拍照確認的膠囊（剩食、貓砂、留餐）與醫療的打勾框
--                    ⚠️ 關掉是「整個不顯示」，所以那個人也就不能打勾記錄 ——
--                       這是使用者確認過的決定，不是疏漏。
--   show_todo_badge  分頁名稱後面那顆未完成數量的紅色數字
--
-- 兩個都預設 true，維持現狀，不影響其他志工。

alter table public.profiles
    add column if not exists show_check_hint boolean not null default true,
    add column if not exists show_todo_badge boolean not null default true;
