-- 位置選項改為 客廳／房間／倉庫／隔離區，「小房間」改叫「房間」
update public.cats set room = '房間' where room = '小房間';
