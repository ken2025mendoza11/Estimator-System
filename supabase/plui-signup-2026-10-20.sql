-- Purpose: sign-in profile, one account per email, and public branding.
-- Step: 17 / LOGIN-UI
-- Apply order: after supabase/p1b-access-2026-10-20.sql.
-- Apply on the TEST project first. The screen ships first.
-- If this file is not applied, sign-in stays as it is and existing sessions keep working.
-- Does not change user ids, sessions, cookies, clients, or masterlist_items.
-- grant_role keeps the signature grant_role(text, text).

alter table public.app_user_roles
  add column if not exists display_name text,
  add column if not exists department text,
  add column if not exists mobile text,
  add column if not exists signature text,
  add column if not exists profile_complete boolean,
  add column if not exists welcome_seen_at timestamptz,
  add column if not exists decline_reason text,
  add column if not exists reminded_at timestamptz,
  add column if not exists duplicate_of text;

update public.app_user_roles
  set profile_complete = true
  where profile_complete is null
    and status = 'active';

update public.app_user_roles
  set profile_complete = false
  where profile_complete is null;

alter table public.app_user_roles
  alter column profile_complete set default false;

update public.app_user_roles
  set welcome_seen_at = coalesce(welcome_seen_at, now())
  where status = 'active'
    and welcome_seen_at is null;

create table if not exists public.account_link_requests (
  id bigint generated always as identity primary key,
  requester_key text not null,
  email text not null,
  target_key text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint account_link_requests_status_chk check (status in ('open', 'declined'))
);

alter table public.account_link_requests enable row level security;
revoke all on table public.account_link_requests from public, anon, authenticated;

create table if not exists public.access_audit_log (
  id bigint generated always as identity primary key,
  actor text,
  action text not null,
  user_key text,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.access_audit_log enable row level security;
revoke all on table public.access_audit_log from public, anon, authenticated;

create table if not exists public.public_branding (
  id integer primary key,
  name text not null default 'Estimator System',
  logo text not null default '',
  contact text not null default '',
  constraint public_branding_one check (id = 1)
);

insert into public.public_branding (id, name, logo, contact)
values (1, 'Estimator System', '', '')
on conflict (id) do nothing;

alter table public.public_branding enable row level security;
revoke all on table public.public_branding from public, anon, authenticated;

create or replace function public.write_access_audit(p_action text, p_user_key text, p_detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.access_audit_log (actor, action, user_key, detail)
  values (auth.uid()::text, left(coalesce(p_action, ''), 80), left(coalesce(p_user_key, ''), 80), left(coalesce(p_detail, ''), 400));
end;
$$;

revoke all on function public.write_access_audit(text, text, text) from public, anon, authenticated;

-- Same signature as p1b. A different signed-in id with an email that already
-- has a row is stored as pending, with duplicate_of pointing at that row.
-- It is never inserted as active, and the other row is not rewritten.
create or replace function public.register_pending(p_profile jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_user_roles%rowtype;
  other_key text;
  actor_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  select * into existing
  from public.app_user_roles roles
  where roles.user_key = auth.uid()::text
  limit 1;
  if found then
    return jsonb_build_object(
      'ok', true,
      'status', existing.status,
      'role', existing.role,
      'user_key', existing.user_key,
      'profileComplete', coalesce(existing.profile_complete, existing.status = 'active'),
      'welcomeSeen', existing.welcome_seen_at is not null,
      'duplicate', existing.duplicate_of is not null,
      'duplicateOf', coalesce(existing.duplicate_of, ''),
      'reason', coalesce(existing.decline_reason, '')
    );
  end if;
  if not public.email_is_allowed(actor_email) then
    return jsonb_build_object('ok', false, 'status', 'declined', 'reason', 'Your account is not allowed to open the estimator.');
  end if;
  if actor_email is not null then
    select roles.user_key into other_key
    from public.app_user_roles roles
    where roles.user_key <> auth.uid()::text
      and roles.email is not null
      and roles.email <> ''
      and lower(roles.email) = actor_email
    order by case when roles.status = 'active' then 0 else 1 end, roles.requested_at nulls last
    limit 1;
  end if;
  insert into public.app_user_roles (
    user_key, email, role, status, requested_at, profile, profile_complete, display_name, duplicate_of
  )
  values (
    auth.uid()::text,
    actor_email,
    'staff',
    'pending',
    now(),
    coalesce(p_profile, '{}'::jsonb),
    false,
    nullif(left(trim(coalesce(p_profile ->> 'name', '')), 120), ''),
    other_key
  );
  perform public.write_access_audit(
    case when other_key is null then 'register_pending' else 'duplicate_pending' end,
    auth.uid()::text,
    coalesce(other_key, actor_email)
  );
  return jsonb_build_object(
    'ok', true,
    'status', 'pending',
    'role', 'staff',
    'user_key', auth.uid()::text,
    'profileComplete', false,
    'welcomeSeen', false,
    'duplicate', other_key is not null,
    'duplicateOf', coalesce(other_key, ''),
    'reason', case
      when other_key is null then ''
      else 'Duplicate. This email already has an account.'
    end
  );
end;
$$;

revoke all on function public.register_pending(jsonb) from public, anon;
grant execute on function public.register_pending(jsonb) to authenticated;

create or replace function public.update_pending_profile(p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_user_roles%rowtype;
  next_name text := left(trim(coalesce(p_profile ->> 'name', '')), 120);
  next_department text := left(trim(coalesce(p_profile ->> 'department', '')), 80);
  next_mobile text := left(trim(coalesce(p_profile ->> 'mobile', '')), 32);
  next_signature text := coalesce(p_profile ->> 'signature', '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if length(next_name) < 2 or next_department = '' or length(regexp_replace(next_mobile, '\D', '', 'g')) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'Full name, department, and mobile are required.');
  end if;
  if next_signature not like 'data:image/%' or length(next_signature) < 81 or length(next_signature) > 400000 then
    return jsonb_build_object('ok', false, 'reason', 'An e-signature is required.');
  end if;
  select * into existing
  from public.app_user_roles
  where user_key = auth.uid()::text
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Sign in again before saving your profile.');
  end if;
  update public.app_user_roles
    set display_name = next_name,
        department = next_department,
        mobile = next_mobile,
        signature = next_signature,
        profile_complete = true,
        profile = coalesce(profile, '{}'::jsonb) || jsonb_build_object(
          'name', next_name,
          'department', next_department,
          'mobile', next_mobile
        )
    where user_key = auth.uid()::text;
  perform public.write_access_audit('profile', auth.uid()::text, next_department);
  return jsonb_build_object('ok', true, 'status', existing.status, 'profileComplete', true);
end;
$$;

revoke all on function public.update_pending_profile(jsonb) from public, anon;
grant execute on function public.update_pending_profile(jsonb) to authenticated;

create or replace function public.mark_welcome_seen()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  update public.app_user_roles
    set welcome_seen_at = coalesce(welcome_seen_at, now())
    where user_key = auth.uid()::text;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account was not found.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mark_welcome_seen() from public, anon;
grant execute on function public.mark_welcome_seen() to authenticated;

-- Same signature as p1b, plus a guard: a second active row with the same email is refused.
create or replace function public.grant_role(p_user_key text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can grant a role.');
  end if;
  if p_role not in ('admin', 'head', 'lead', 'staff') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown role.');
  end if;
  select lower(email) into target_email
  from public.app_user_roles
  where user_key = p_user_key;
  if target_email is not null and target_email <> '' and exists (
    select 1
    from public.app_user_roles other
    where other.user_key <> p_user_key
      and other.status = 'active'
      and other.email is not null
      and lower(other.email) = target_email
  ) then
    perform public.write_access_audit('grant_refused_duplicate', p_user_key, target_email);
    return jsonb_build_object('ok', false, 'reason', 'Another active account already uses this email.');
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
  perform public.write_access_audit('grant_role', p_user_key, p_role);
  return jsonb_build_object('ok', true, 'status', 'active', 'role', p_role);
end;
$$;

revoke all on function public.grant_role(text, text) from public, anon;
grant execute on function public.grant_role(text, text) to authenticated;

create or replace function public.decline_user_with_reason(p_user_key text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  why text := left(trim(coalesce(p_reason, '')), 400);
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can decline an account.');
  end if;
  if why = '' then
    why := 'Declined';
  end if;
  update public.app_user_roles
    set status = 'declined',
        decline_reason = why,
        decided_by = auth.uid()::text,
        decided_at = now()
    where user_key = p_user_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account was not found.');
  end if;
  perform public.write_access_audit('decline', p_user_key, why);
  return jsonb_build_object('ok', true, 'status', 'declined');
end;
$$;

revoke all on function public.decline_user_with_reason(text, text) from public, anon;
grant execute on function public.decline_user_with_reason(text, text) to authenticated;

create or replace function public.decline_as_duplicate(p_user_key text, p_other_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can decline an account.');
  end if;
  if p_user_key = p_other_key then
    return jsonb_build_object('ok', false, 'reason', 'Choose the other account.');
  end if;
  update public.app_user_roles
    set status = 'declined',
        decline_reason = 'Duplicate. This email already has an account.',
        duplicate_of = left(coalesce(p_other_key, ''), 80),
        decided_by = auth.uid()::text,
        decided_at = now()
    where user_key = p_user_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account was not found.');
  end if;
  perform public.write_access_audit('decline_as_duplicate', p_user_key, p_other_key);
  return jsonb_build_object('ok', true, 'status', 'declined', 'linked', false);
end;
$$;

revoke all on function public.decline_as_duplicate(text, text) from public, anon;
grant execute on function public.decline_as_duplicate(text, text) to authenticated;

-- Activates this waiting account only when that would not leave two active rows on one email.
create or replace function public.approve_instead(p_user_key text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
  granted jsonb;
begin
  if p_role not in ('admin', 'head', 'lead', 'staff') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown role.');
  end if;
  select lower(email) into target_email
  from public.app_user_roles
  where user_key = p_user_key;
  if target_email is not null and exists (
    select 1
    from public.app_user_roles other
    where other.user_key <> p_user_key
      and other.status = 'active'
      and lower(coalesce(other.email, '')) = target_email
  ) then
    perform public.write_access_audit('approve_instead_refused', p_user_key, target_email);
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'Another active account already uses this email.');
  end if;
  if target_email is not null then
    update public.app_user_roles
      set status = 'declined',
          decline_reason = 'Duplicate. This email already has an account.',
          duplicate_of = p_user_key,
          decided_by = auth.uid()::text,
          decided_at = now()
      where user_key <> p_user_key
        and status = 'pending'
        and lower(coalesce(email, '')) = target_email;
  end if;
  granted := public.grant_role(p_user_key, p_role);
  return granted || jsonb_build_object('linked', false);
end;
$$;

revoke all on function public.approve_instead(text, text) from public, anon;
grant execute on function public.approve_instead(text, text) to authenticated;

create or replace function public.possible_duplicates()
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
    select jsonb_agg(pair)
    from (
      select jsonb_build_object(
        'userKey', left_row.user_key,
        'email', left_row.email,
        'name', coalesce(left_row.display_name, ''),
        'otherKey', right_row.user_key,
        'otherEmail', right_row.email,
        'otherName', coalesce(right_row.display_name, ''),
        'kind', case
          when left_row.email is not null
           and left_row.email <> ''
           and lower(left_row.email) = lower(right_row.email)
          then 'email'
          else 'name'
        end
      ) as pair
      from public.app_user_roles left_row
      join public.app_user_roles right_row
        on left_row.user_key < right_row.user_key
       and (
         (
           left_row.email is not null
           and left_row.email <> ''
           and lower(left_row.email) = lower(coalesce(right_row.email, ''))
         )
         or (
           length(trim(coalesce(left_row.display_name, ''))) >= 4
           and lower(trim(left_row.display_name)) = lower(trim(coalesce(right_row.display_name, '')))
           and lower(coalesce(left_row.email, '')) is distinct from lower(coalesce(right_row.email, ''))
         )
       )
    ) matches
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.possible_duplicates() from public, anon;
grant execute on function public.possible_duplicates() to authenticated;

create or replace function public.request_account_link()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_email text := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if actor_email is null then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'This account has no email to compare.');
  end if;
  insert into public.account_link_requests (requester_key, email, target_key, status)
  select auth.uid()::text, actor_email, roles.user_key, 'open'
  from public.app_user_roles roles
  where roles.user_key <> auth.uid()::text
    and lower(coalesce(roles.email, '')) = actor_email
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'No other account uses this email.');
  end if;
  perform public.write_access_audit('link_requested', auth.uid()::text, actor_email);
  return jsonb_build_object('ok', true, 'linked', false, 'reason', 'The request was saved. The accounts were not linked.');
end;
$$;

revoke all on function public.request_account_link() from public, anon;
grant execute on function public.request_account_link() to authenticated;

-- An administrator can record a request for another key. It never copies a user id.
create or replace function public.request_account_link(p_user_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_email text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'Only an admin can record a link request.');
  end if;
  select lower(email) into actor_email
  from public.app_user_roles
  where user_key = p_user_key;
  if actor_email is null or actor_email = '' then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'That account has no email.');
  end if;
  insert into public.account_link_requests (requester_key, email, target_key, status)
  select p_user_key, actor_email, roles.user_key, 'open'
  from public.app_user_roles roles
  where roles.user_key <> p_user_key
    and lower(coalesce(roles.email, '')) = actor_email
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'No other account uses this email.');
  end if;
  perform public.write_access_audit('link_requested', p_user_key, actor_email);
  return jsonb_build_object('ok', true, 'linked', false, 'reason', 'The request was saved. The accounts were not linked.');
end;
$$;

revoke all on function public.request_account_link(text) from public, anon;
grant execute on function public.request_account_link(text) to authenticated;

create or replace function public.decline_account_link(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can decline a link.');
  end if;
  update public.account_link_requests
    set status = 'declined'
    where id = p_id
      and status = 'open';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That request was not open.');
  end if;
  perform public.write_access_audit('link_declined', '', p_id::text);
  return jsonb_build_object('ok', true, 'linked', false);
end;
$$;

revoke all on function public.decline_account_link(bigint) from public, anon;
grant execute on function public.decline_account_link(bigint) to authenticated;

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

create or replace function public.mark_access_reminded(p_user_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can record a reminder.');
  end if;
  update public.app_user_roles
    set reminded_at = now()
    where user_key = p_user_key
      and status = 'pending';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account is not pending.');
  end if;
  perform public.write_access_audit('remind', p_user_key, '3h');
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mark_access_reminded(text) from public, anon;
grant execute on function public.mark_access_reminded(text) to authenticated;

create or replace function public.list_email_allowlist()
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
    select jsonb_agg(entry order by entry)
    from public.email_allowlist
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_email_allowlist() from public, anon;
grant execute on function public.list_email_allowlist() to authenticated;

create or replace function public.add_email_allowlist(p_entry text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := lower(trim(coalesce(p_entry, '')));
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can change the allowlist.');
  end if;
  if clean = '' or length(clean) > 160 or position(' ' in clean) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'Enter one email or a @domain.');
  end if;
  insert into public.email_allowlist (entry) values (clean)
  on conflict (entry) do nothing;
  perform public.write_access_audit('allowlist_add', '', clean);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.add_email_allowlist(text) from public, anon;
grant execute on function public.add_email_allowlist(text) to authenticated;

create or replace function public.remove_email_allowlist(p_entry text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can change the allowlist.');
  end if;
  delete from public.email_allowlist
  where lower(entry) = lower(trim(coalesce(p_entry, '')));
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That entry was not on the list.');
  end if;
  perform public.write_access_audit('allowlist_remove', '', p_entry);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.remove_email_allowlist(text) from public, anon;
grant execute on function public.remove_email_allowlist(text) to authenticated;

create or replace function public.get_public_branding()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', coalesce((select name from public.public_branding where id = 1), 'Estimator System'),
    'logo', coalesce((select logo from public.public_branding where id = 1), ''),
    'contact', coalesce((select contact from public.public_branding where id = 1), '')
  );
$$;

revoke all on function public.get_public_branding() from public;
grant execute on function public.get_public_branding() to anon, authenticated;

create or replace function public.set_public_branding(p_name text, p_logo text, p_contact text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_logo text := left(trim(coalesce(p_logo, '')), 500);
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can change the public name.');
  end if;
  if next_logo <> '' and next_logo not like 'https://%' then
    return jsonb_build_object('ok', false, 'reason', 'The logo must be an https link.');
  end if;
  insert into public.public_branding (id, name, logo, contact)
  values (
    1,
    coalesce(nullif(left(trim(coalesce(p_name, '')), 80), ''), 'Estimator System'),
    next_logo,
    left(trim(coalesce(p_contact, '')), 120)
  )
  on conflict (id) do update
    set name = excluded.name,
        logo = excluded.logo,
        contact = excluded.contact;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_public_branding(text, text, text) from public, anon;
grant execute on function public.set_public_branding(text, text, text) to authenticated;

-- One active row per email. Pending duplicates are allowed.
create unique index if not exists app_user_roles_one_active_email
  on public.app_user_roles (lower(email))
  where status = 'active' and email is not null and btrim(email) <> '';

-- A pending account is authenticated, but it cannot read estimates.
drop policy if exists authenticated_select on public.workspace_docs;
create policy authenticated_select on public.workspace_docs
  for select to authenticated
  using (public.is_active_user());

do $$
declare
  branding text;
  grant_body text;
  decline_body text;
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_docs'
      and policyname = 'authenticated_select'
      and cmd = 'SELECT'
      and coalesce(qual, '') ilike '%is_active_user%'
  ) then
    raise exception 'FAIL: pending user can still read workspace_docs';
  end if;

  grant_body := pg_get_functiondef(to_regprocedure('public.grant_role(text,text)'));
  decline_body := pg_get_functiondef(to_regprocedure('public.decline_user_with_reason(text,text)'));
  if position('not public.is_admin()' in grant_body) = 0 then
    raise exception 'FAIL: non-admin can call grant_role';
  end if;
  if position('not public.is_admin()' in decline_body) = 0 then
    raise exception 'FAIL: non-admin can call decline_user_with_reason';
  end if;
  if position('Another active account already uses this email.' in grant_body) = 0 then
    raise exception 'FAIL: grant_role does not refuse a second active account with the same email';
  end if;

  branding := pg_get_functiondef(to_regprocedure('public.get_public_branding()'));
  if position('''name''' in branding) = 0
     or position('''logo''' in branding) = 0
     or position('''contact''' in branding) = 0
     or position('email' in branding) > 0
     or position('signature' in branding) > 0
     or position('role' in branding) > 0 then
    raise exception 'FAIL: anon get_public_branding does not return only the 3 fields';
  end if;
  if not has_function_privilege('anon', 'public.get_public_branding()', 'execute') then
    raise exception 'FAIL: anon cannot call get_public_branding';
  end if;

  if has_table_privilege('authenticated', 'public.account_link_requests', 'select')
     or has_table_privilege('anon', 'public.account_link_requests', 'select') then
    raise exception 'FAIL: a user can read another user''s account_link_requests';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'app_user_roles_one_active_email'
  ) then
    raise exception 'FAIL: no two active rows share lower(email) is not enforced';
  end if;
  if exists (
    select 1
    from public.app_user_roles
    where status = 'active' and email is not null and btrim(email) <> ''
    group by lower(email)
    having count(*) > 1
  ) then
    raise exception 'FAIL: two active rows share lower(email)';
  end if;

  if position('duplicate_of' in pg_get_functiondef(to_regprocedure('public.register_pending(jsonb)'))) = 0
     or position('''pending''' in pg_get_functiondef(to_regprocedure('public.register_pending(jsonb)'))) = 0 then
    raise exception 'FAIL: register_pending does not keep a duplicate pending';
  end if;

  raise notice 'PASS: signup profile, one active email, and public branding';
end $$;
