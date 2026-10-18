-- 值班記錄表的「局部更新」：一次只改動過的那幾格，兩人同時改不同的貓或項目不會互相覆蓋。
-- 由 server API（service key）呼叫，前端不能直接呼叫。

-- 在 jsonb 物件裡照路徑設值，中間缺的層會自動補成 {}。
-- p_if_missing = true 時，那個位置已經有值就不動（用來補貓的基本資料，不蓋掉已填的內容）
create or replace function public.jsonb_deep_set(
  p_target jsonb,
  p_path text[],
  p_value jsonb,
  p_if_missing boolean default false
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  result jsonb := coalesce(p_target, '{}'::jsonb);
  depth int := coalesce(array_length(p_path, 1), 0);
begin
  if depth = 0 then
    return p_value;
  end if;
  if p_if_missing and result #> p_path is not null then
    return result;
  end if;
  for i in 1 .. depth - 1 loop
    if jsonb_typeof(result #> p_path[1:i]) is distinct from 'object' then
      result := jsonb_set(result, p_path[1:i], '{}'::jsonb, true);
    end if;
  end loop;
  return jsonb_set(result, p_path, p_value, true);
end;
$$;

-- 套用一批改動。p_ops 是陣列，每一項：
--   { "column": "cats" | "tasks", "path": ["12", "medical", "5"], "value": {...}, "if_missing": false }
--   { "column": "note" | "member", "value": "..." }
-- select ... for update 鎖住這一班，同時進來的請求會排隊，一個一個套用
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
  v_note text;
  v_member text;
  op jsonb;
  v_path text[];
begin
  select cats, tasks, note, member
    into v_cats, v_tasks, v_note, v_member
    from public.shifts
   where id = p_shift_id
     for update;

  if not found then
    raise exception 'shift % not found', p_shift_id;
  end if;

  for op in select * from jsonb_array_elements(p_ops) loop
    v_path := array(select jsonb_array_elements_text(coalesce(op -> 'path', '[]'::jsonb)));
    case op ->> 'column'
      when 'cats' then
        v_cats := public.jsonb_deep_set(v_cats, v_path, op -> 'value', coalesce((op ->> 'if_missing')::boolean, false));
      when 'tasks' then
        v_tasks := public.jsonb_deep_set(v_tasks, v_path, op -> 'value', coalesce((op ->> 'if_missing')::boolean, false));
      when 'note' then
        v_note := op ->> 'value';
      when 'member' then
        v_member := op ->> 'value';
      else
        raise exception 'unknown column %', op ->> 'column';
    end case;
  end loop;

  update public.shifts
     set cats = v_cats,
         tasks = v_tasks,
         note = v_note,
         member = v_member,
         updated_by = p_user
   where id = p_shift_id;
end;
$$;

-- public schema 的函式預設誰都能透過 API 呼叫，收回來只留給 service_role
revoke execute on function public.shift_apply(bigint, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.shift_apply(bigint, jsonb, uuid) to service_role;
