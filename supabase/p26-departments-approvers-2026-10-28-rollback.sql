-- Undo supabase/p26-departments-approvers-2026-10-28.sql only.
-- Restores list_user_access to the sign-up body. Drops the new column and the approver table.
-- Does not drop public.app_user_roles.department or any older column.

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
      'duplicateOf', coalesce(duplicate_of, '')
    ) order by requested_at nulls last, email)
    from public.app_user_roles
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_user_access() from public, anon;
grant execute on function public.list_user_access() to authenticated;

drop function if exists public.set_account_department(text, text);
drop function if exists public.replace_release1_approvers(jsonb);
drop function if exists public.list_release1_approvers();

drop policy if exists release1_approvers_admin on public.release1_approvers;
drop table if exists public.release1_approvers;

alter table public.app_user_roles
  drop constraint if exists app_user_roles_account_department_chk;

alter table public.app_user_roles
  drop column if exists account_department;
