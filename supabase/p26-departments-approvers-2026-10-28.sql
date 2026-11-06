-- Step 26. Apply after plui-signup-2026-10-20.sql and p20-role-by-id-2026-10-20.sql.
-- Apply on the TEST project first. The app ships first and keeps working when this is missing.
-- Adds account_department. Does not retype or rewrite public.app_user_roles.department.
-- Approver rows are account ids plus a backup account id. Names are not stored.

alter table public.app_user_roles
  add column if not exists account_department text;

alter table public.app_user_roles
  drop constraint if exists app_user_roles_account_department_chk;

alter table public.app_user_roles
  add constraint app_user_roles_account_department_chk
  check (
    account_department is null
    or account_department in ('Sales', 'Cost Estimating', 'Management', 'Admin')
  );

create table if not exists public.release1_approvers (
  id text primary key,
  kind text not null,
  user_id text not null,
  backup_user_id text not null default '',
  ord integer not null default 0,
  constraint release1_approvers_kind_chk check (kind in ('markup', 'proposal', 'jobOrder')),
  constraint release1_approvers_backup_chk check (backup_user_id <> user_id)
);

alter table public.release1_approvers enable row level security;

drop policy if exists release1_approvers_admin on public.release1_approvers;
create policy release1_approvers_admin on public.release1_approvers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.set_account_department(p_user_key text, p_department text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dept text := nullif(trim(coalesce(p_department, '')), '');
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can set a department.');
  end if;
  if dept is not null and dept not in ('Sales', 'Cost Estimating', 'Management', 'Admin') then
    return jsonb_build_object('ok', false, 'reason', 'Department must be Sales, Cost Estimating, Management, or Admin.');
  end if;
  update public.app_user_roles
    set account_department = dept
    where user_key = p_user_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account was not found.');
  end if;
  perform public.write_access_audit('department', p_user_key, coalesce(dept, ''));
  return jsonb_build_object('ok', true, 'accountDepartment', coalesce(dept, ''));
end;
$$;

revoke all on function public.set_account_department(text, text) from public, anon;
grant execute on function public.set_account_department(text, text) to authenticated;

create or replace function public.replace_release1_approvers(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  kind text;
  user_id text;
  backup_id text;
  n integer := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can set approvers.');
  end if;
  if p_rows is not null and jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'Approvers must be a list.');
  end if;
  delete from public.release1_approvers;
  for item in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    kind := item ->> 'kind';
    user_id := nullif(trim(coalesce(item ->> 'userId', item ->> 'user_id', '')), '');
    backup_id := trim(coalesce(item ->> 'backupUserId', item ->> 'backup_user_id', ''));
    if user_id is null then
      continue;
    end if;
    if kind not in ('markup', 'proposal', 'jobOrder') then
      return jsonb_build_object('ok', false, 'reason', 'Approver list must be markup, proposal, or job order.');
    end if;
    if backup_id = user_id then
      backup_id := '';
    end if;
    insert into public.release1_approvers (id, kind, user_id, backup_user_id, ord)
    values (
      kind || ':' || user_id,
      kind,
      user_id,
      backup_id,
      coalesce((item ->> 'ord')::integer, n)
    )
    on conflict (id) do update
      set backup_user_id = excluded.backup_user_id,
          ord = excluded.ord;
    n := n + 1;
  end loop;
  perform public.write_access_audit('approvers', auth.uid()::text, n::text);
  return jsonb_build_object('ok', true, 'count', n);
end;
$$;

revoke all on function public.replace_release1_approvers(jsonb) from public, anon;
grant execute on function public.replace_release1_approvers(jsonb) to authenticated;

create or replace function public.list_release1_approvers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'kind', kind,
      'userId', user_id,
      'backupUserId', backup_user_id,
      'ord', ord
    ) order by kind, ord, user_id)
    from public.release1_approvers
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_release1_approvers() from public, anon;
grant execute on function public.list_release1_approvers() to authenticated;

create or replace function public.list_user_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userKey', user_key,
      'email', email,
      'name', coalesce(display_name, ''),
      'role', role,
      'status', status,
      'requestedAt', requested_at,
      'remindedAt', reminded_at,
      'reason', coalesce(decline_reason, ''),
      'department', coalesce(department, ''),
      'accountDepartment', coalesce(account_department, ''),
      'duplicateOf', coalesce(duplicate_of, '')
    ) order by requested_at nulls last, email)
    from public.app_user_roles
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_user_access() from public, anon;
grant execute on function public.list_user_access() to authenticated;

do $$
declare
  dept_type text;
  body text;
begin
  select data_type into dept_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'app_user_roles'
    and column_name = 'department';
  if dept_type is distinct from 'text' then
    raise exception 'FAIL: department column was retyped';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_user_roles'
      and column_name = 'account_department'
  ) then
    raise exception 'FAIL: account_department missing';
  end if;
  if to_regprocedure('public.set_account_department(text,text)') is null then
    raise exception 'FAIL: set_account_department missing';
  end if;
  if to_regclass('public.release1_approvers') is null then
    raise exception 'FAIL: release1_approvers missing';
  end if;
  body := pg_get_functiondef(to_regprocedure('public.list_user_access()'));
  if position('accountDepartment' in body) = 0 then
    raise exception 'FAIL: list_user_access does not return accountDepartment';
  end if;
  if position('user_key = auth.uid()' in pg_get_functiondef(to_regprocedure('public.is_admin()'))) = 0 then
    raise exception 'FAIL: is_admin was replaced';
  end if;
end;
$$;
