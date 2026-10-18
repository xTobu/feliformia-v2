-- 回報改成每個人各寫一段（用登入身分，不再選填表志工）：
--   shifts.reports = { "<分頁>": { "<user_id>": { "name": 暱稱, "text": 內容, "at": 時間 } } }
-- 名字與時間由 server 填，每個人只能改自己那一段（server/api/shift/update.post.js 檢查）

-- 已經寫過的回報（{ 分頁: "內容" }）沒有作者，放在 legacy 底下
update public.shifts s
   set reports = coalesce((
         select jsonb_object_agg(
                  key,
                  case when jsonb_typeof(value) = 'string'
                       then jsonb_build_object('legacy', jsonb_build_object('name', null, 'text', value, 'at', null))
                       else value
                  end)
           from jsonb_each(s.reports)
       ), '{}'::jsonb)
 where reports <> '{}'::jsonb;

-- 填表志工改由登入身分取代
alter table public.shifts drop column member;

-- p_ops 每一項：{ "column": "cats" | "tasks" | "reports", "path": [...], "value": ..., "if_missing": false }
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
  op jsonb;
  v_path text[];
  v_if_missing boolean;
begin
  select cats, tasks, reports
    into v_cats, v_tasks, v_reports
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
      else
        raise exception 'unknown column %', op ->> 'column';
    end case;
  end loop;

  update public.shifts
     set cats = v_cats,
         tasks = v_tasks,
         reports = v_reports,
         updated_by = p_user
   where id = p_shift_id;
end;
$$;

revoke execute on function public.shift_apply(bigint, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.shift_apply(bigint, jsonb, uuid) to service_role;
