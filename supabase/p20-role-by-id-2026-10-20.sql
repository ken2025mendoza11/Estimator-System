-- Step 20. Apply after p1b-access-2026-10-20.sql and p19-active-user-2026-10-20.sql.
-- Apply on the TEST project first. App code can ship first.
-- Replaces public.is_admin() and public.caller_role() only. Same signatures.
-- Also replaces app_user_roles_select so a same-email row is not readable.
-- A pending, declined, or duplicate account does not receive another account's role.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user_roles
    where lower(role) = 'admin'
      and status = 'active'
      and user_key = auth.uid()::text
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.caller_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_user_roles
  where status = 'active'
    and user_key = auth.uid()::text
  limit 1;
$$;

revoke all on function public.caller_role() from public, anon;
grant execute on function public.caller_role() to authenticated;

drop policy if exists app_user_roles_select on public.app_user_roles;
create policy app_user_roles_select on public.app_user_roles
  for select to authenticated
  using (user_key = auth.uid()::text);

do $$
declare
  admin_body text;
  role_body text;
  qual text;
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'FAIL: is_admin missing';
  end if;
  if to_regprocedure('public.caller_role()') is null then
    raise exception 'FAIL: caller_role missing';
  end if;
  admin_body := pg_get_functiondef(to_regprocedure('public.is_admin()'));
  role_body := pg_get_functiondef(to_regprocedure('public.caller_role()'));
  if position('user_key = auth.uid()' in admin_body) = 0
     or position('status = ''active''' in admin_body) = 0 then
    raise exception 'FAIL: is_admin does not match the signed-in active user';
  end if;
  if position('user_key = auth.uid()' in role_body) = 0
     or position('status = ''active''' in role_body) = 0 then
    raise exception 'FAIL: caller_role does not match the signed-in active user';
  end if;
  if position('lower(email)' in admin_body) > 0 or position('lower(email)' in role_body) > 0 then
    raise exception 'FAIL: admin or role still matches by email';
  end if;
  select pg_policies.qual into qual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'app_user_roles'
    and policyname = 'app_user_roles_select';
  if qual is null or position('user_key' in qual) = 0 or position('email' in qual) > 0 then
    raise exception 'FAIL: app_user_roles select still matches by email';
  end if;
  raise notice 'PASS: admin and caller role match the linked account only';
end $$;
