-- Undo supabase/p19-active-user-2026-10-20.sql only.
-- Restores public.is_active_user() to the Phase 1B body. Drops nothing else.

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

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;
