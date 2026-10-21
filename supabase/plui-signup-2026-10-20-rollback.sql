-- Undo supabase/plui-signup-2026-10-20.sql only.
-- Restores register_pending, grant_role, and list_user_access to the Phase 1B bodies.
-- Does not drop app_user_roles, email_allowlist, or any document.

drop function if exists public.set_public_branding(text, text, text);
drop function if exists public.get_public_branding();
drop function if exists public.remove_email_allowlist(text);
drop function if exists public.add_email_allowlist(text);
drop function if exists public.list_email_allowlist();
drop function if exists public.mark_access_reminded(text);
drop function if exists public.decline_account_link(bigint);
drop function if exists public.request_account_link(text);
drop function if exists public.request_account_link();
drop function if exists public.possible_duplicates();
drop function if exists public.approve_instead(text, text);
drop function if exists public.decline_as_duplicate(text, text);
drop function if exists public.decline_user_with_reason(text, text);
drop function if exists public.mark_welcome_seen();
drop function if exists public.update_pending_profile(jsonb);
drop function if exists public.write_access_audit(text, text, text);

drop table if exists public.public_branding;
drop table if exists public.access_audit_log;
drop table if exists public.account_link_requests;

alter table public.app_user_roles
  drop column if exists duplicate_of,
  drop column if exists reminded_at,
  drop column if exists decline_reason,
  drop column if exists welcome_seen_at,
  drop column if exists profile_complete,
  drop column if exists signature,
  drop column if exists mobile,
  drop column if exists department,
  drop column if exists display_name;

create or replace function public.register_pending(p_profile jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_user_roles%rowtype;
  actor_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if not public.email_is_allowed(actor_email) then
    return jsonb_build_object('ok', false, 'status', 'declined', 'reason', 'Your account is not allowed to open the estimator.');
  end if;
  select * into existing
  from public.app_user_roles roles
  where roles.user_key = auth.uid()::text
     or (
       actor_email is not null
       and roles.email is not null
       and roles.email <> ''
       and lower(roles.email) = actor_email
     )
  limit 1;
  if found then
    return jsonb_build_object('ok', true, 'status', existing.status, 'role', existing.role, 'user_key', existing.user_key);
  end if;
  insert into public.app_user_roles (user_key, email, role, status, requested_at, profile)
  values (auth.uid()::text, actor_email, 'staff', 'pending', now(), coalesce(p_profile, '{}'::jsonb));
  return jsonb_build_object('ok', true, 'status', 'pending', 'role', 'staff', 'user_key', auth.uid()::text);
end;
$$;

revoke all on function public.register_pending(jsonb) from public, anon;
grant execute on function public.register_pending(jsonb) to authenticated;

create or replace function public.grant_role(p_user_key text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can grant a role.');
  end if;
  if p_role not in ('admin', 'head', 'lead', 'staff') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown role.');
  end if;
  update public.app_user_roles
    set role = p_role,
        status = 'active',
        decided_by = auth.uid()::text,
        decided_at = now()
    where user_key = p_user_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account is not waiting.');
  end if;
  return jsonb_build_object('ok', true, 'status', 'active', 'role', p_role);
end;
$$;

revoke all on function public.grant_role(text, text) from public, anon;
grant execute on function public.grant_role(text, text) to authenticated;

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
      'role', role,
      'status', status,
      'requestedAt', requested_at
    ) order by requested_at nulls last, email)
    from public.app_user_roles
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_user_access() from public, anon;
grant execute on function public.list_user_access() to authenticated;
