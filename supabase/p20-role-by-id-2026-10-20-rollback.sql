-- Undo supabase/p20-role-by-id-2026-10-20.sql only.
-- Restores public.is_admin() and public.caller_role() to the Phase 1B bodies,
-- and restores app_user_roles_select to the apply-v2 body. Drops nothing.

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
      and (
        user_key = auth.uid()::text
        or (
          email is not null
          and email <> ''
          and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
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
    and (
      user_key = auth.uid()::text
      or (
        email is not null
        and email <> ''
        and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  order by case lower(role)
    when 'admin' then 0
    when 'head' then 1
    when 'lead' then 2
    else 3
  end
  limit 1;
$$;

revoke all on function public.caller_role() from public, anon;
grant execute on function public.caller_role() to authenticated;

drop policy if exists app_user_roles_select on public.app_user_roles;
create policy app_user_roles_select on public.app_user_roles
  for select to authenticated
  using (
    user_key = auth.uid()::text
    or (
      email is not null
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
