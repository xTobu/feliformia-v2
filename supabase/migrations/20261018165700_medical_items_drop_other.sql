-- 醫療管理拿掉「其他」類別，只剩醫療、吃藥（測試站目前沒有其他的資料；保險起見有的話歸到醫療）
update public.medical_items set category = '醫療' where category = '其他';

alter table public.medical_items drop constraint medical_items_category_check;
alter table public.medical_items add constraint medical_items_category_check
  check (category in ('醫療', '吃藥'));
