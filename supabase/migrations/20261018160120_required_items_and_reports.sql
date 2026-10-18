-- 1) 值班待辦改成「收尾」：不跟著貓，是這一班離開前一定要勾完的清單
--    todo_items → required_items，拿掉 cat_id、location（表在正式站還沒建，測試站也是空的）
-- 2) 回報從一欄 note 改成每個分頁各自一段：shifts.reports = { arrive, care, meds, leave, required }
-- 3) shift_apply 跟著改：可以局部更新某個分頁的回報

-- ── 1) required_items ──────────────────────────────
alter table public.todo_items rename to required_items;

-- 拿掉欄位時，跟它有關的 index、foreign key、check（含「貓和位置只能擇一」）會一起拿掉
alter table public.required_items
  drop column cat_id,
  drop column location;

alter table public.required_items rename constraint todo_items_pkey to required_items_pkey;
alter table public.required_items rename constraint todo_items_shift_check to required_items_shift_check;
alter table public.required_items rename constraint todo_items_check1 to required_items_period_check;
alter sequence public.todo_items_id_seq rename to required_items_id_seq;

alter policy "Authenticated users can read todo_items" on public.required_items rename to "Authenticated users can read required_items";
alter policy "Admins can insert todo_items" on public.required_items rename to "Admins can insert required_items";
alter policy "Admins can update todo_items" on public.required_items rename to "Admins can update required_items";
alter policy "Admins can delete todo_items" on public.required_items rename to "Admins can delete required_items";

-- 留言的分頁值跟著改名（收尾分頁沒有貓，實際上不會有留言，只是讓清單一致）
alter table public.shift_comments drop constraint shift_comments_tab_check;
update public.shift_comments set tab = 'required' where tab = 'todo';
alter table public.shift_comments add constraint shift_comments_tab_check
  check (tab in ('arrive', 'care', 'meds', 'leave', 'required'));

-- ── 2) shifts.reports ──────────────────────────────
alter table public.shifts add column reports jsonb not null default '{}'::jsonb;

-- 已經填過的值班回報搬到觀察分頁
update public.shifts
   set reports = jsonb_build_object('arrive', note)
 where note is not null and note <> '';

alter table public.shifts drop column note;

-- ── 3) shift_apply ─────────────────────────────────
-- p_ops 每一項：
--   { "column": "cats" | "tasks" | "reports", "path": [...], "value": ..., "if_missing": false }
--   { "column": "member", "value": "..." }
create or replace function public.shift_apply(
  p_shift_id bigint,
  p_ops jsonb,
  p_user uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cats jsonb;
  v_tasks jsonb;
  v_reports jsonb;
  v_member text;
  op jsonb;
  v_path text[];
  v_if_missing boolean;
begin
  select cats, tasks, reports, member
    into v_cats, v_tasks, v_reports, v_member
    from public.shifts
   where id = p_shift_id
     for update;

  if not found then
    raise exception 'shift % not found', p_shift_id;
  end if;

  for op in select * from jsonb_array_elements(p_ops) loop
    v_path := array(select jsonb_array_elements_text(coalesce(op -> 'path', '[]'::jsonb)));
    v_if_missing := coalesce((op ->> 'if_missing')::boolean, false);
    case op ->> 'column'
      when 'cats' then
        v_cats := public.jsonb_deep_set(v_cats, v_path, op -> 'value', v_if_missing);
      when 'tasks' then
        v_tasks := public.jsonb_deep_set(v_tasks, v_path, op -> 'value', v_if_missing);
      when 'reports' then
        v_reports := public.jsonb_deep_set(v_reports, v_path, op -> 'value', v_if_missing);
      when 'member' then
        v_member := op ->> 'value';
      else
        raise exception 'unknown column %', op ->> 'column';
    end case;
  end loop;

  update public.shifts
     set cats = v_cats,
         tasks = v_tasks,
         reports = v_reports,
         member = v_member,
         updated_by = p_user
   where id = p_shift_id;
end;
$$;

revoke execute on function public.shift_apply(bigint, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.shift_apply(bigint, jsonb, uuid) to service_role;
