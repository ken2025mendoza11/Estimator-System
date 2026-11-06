-- Step 19. Apply after p1b-access-2026-10-20.sql and plui-signup-2026-10-20.sql.
-- Apply on the TEST project first. App code can ship first.
-- Replaces only public.is_active_user(). Same signature: no arguments, returns boolean.
-- A session is active only when its own user id (auth.uid) has status active.
-- A pending or declined row is not active just because another row shares the email.

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.email_is_allowed(auth.jwt() ->> 'email')
    and exists (
      select 1
      from public.app_user_roles
      where status = 'active'
        and user_key = auth.uid()::text
    );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

do $$
declare
  body text;
begin
  if to_regprocedure('public.is_active_user()') is null then
    raise exception 'FAIL: is_active_user missing';
  end if;
  body := pg_get_functiondef(to_regprocedure('public.is_active_user()'));
  if position('user_key = auth.uid()' in body) = 0 then
    raise exception 'FAIL: is_active_user does not match the auth user id';
  end if;
  if position('lower(email)' in body) > 0 then
    raise exception 'FAIL: is_active_user still matches by email';
  end if;
  raise notice 'PASS: is_active_user matches the linked account only';
end $$;
