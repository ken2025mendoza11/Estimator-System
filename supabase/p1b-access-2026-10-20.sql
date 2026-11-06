-- Purpose: Phase 1B access control. Pending accounts, signed steps, and no direct document writes.
-- Step: 4 / Phase 1B
-- Apply order: after supabase/p1a-numbering-2026-10-20.sql (or apply-v2.sql if that file is not applied yet).
-- Apply on the TEST project first. App code ships first.
-- If this file is not applied, direct writes still work and every signed-in account is treated as active.
-- save_workspace_doc keeps the same signature as apply-v2.sql.
-- Does not delete documents or role rows.

alter table public.app_user_roles
  add column if not exists status text not null default 'active',
  add column if not exists requested_at timestamptz,
  add column if not exists profile jsonb not null default '{}'::jsonb,
  add column if not exists decided_by text,
  add column if not exists decided_at timestamptz;

alter table public.app_user_roles drop constraint if exists app_user_roles_status_chk;
alter table public.app_user_roles
  add constraint app_user_roles_status_chk
  check (status in ('pending', 'active', 'declined', 'disabled'));

create table if not exists public.email_allowlist (
  entry text primary key
);

alter table public.email_allowlist enable row level security;
revoke all on table public.email_allowlist from public, anon, authenticated;

create or replace function public.email_is_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.email_allowlist) then true
    else exists (
      select 1
      from public.email_allowlist allowed
      where lower(allowed.entry) = lower(trim(coalesce(p_email, '')))
         or (
           left(allowed.entry, 1) = '@'
           and position('@' in coalesce(p_email, '')) > 0
           and lower(allowed.entry) = lower(substring(p_email from position('@' in p_email)))
         )
    )
  end;
$$;

revoke all on function public.email_is_allowed(text) from public, anon;
grant execute on function public.email_is_allowed(text) to authenticated;

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

-- Same signature as apply-v2.sql. A disabled or pending admin is not an admin.
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

create or replace function public.approval_signature_error(old_approval jsonb, new_approval jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  new_steps jsonb := coalesce(new_approval -> 'steps', '[]'::jsonb);
  old_steps jsonb := coalesce(old_approval -> 'steps', '[]'::jsonb);
  i integer;
  n jsonb;
  o jsonb;
  uid text := auth.uid()::text;
  role text := public.caller_role();
begin
  if jsonb_typeof(new_steps) is distinct from 'array' then
    return null;
  end if;
  if jsonb_typeof(old_steps) is distinct from 'array' then
    old_steps := '[]'::jsonb;
  end if;
  for i in 0 .. jsonb_array_length(new_steps) - 1 loop
    n := new_steps -> i;
    o := case when i < jsonb_array_length(old_steps) then old_steps -> i else null end;
    if coalesce(n ->> 'decision', '') = '' and coalesce(n ->> 'byUserId', '') = '' then
      continue;
    end if;
    if o is not null
       and coalesce(o ->> 'decision', '') = coalesce(n ->> 'decision', '')
       and coalesce(o ->> 'byUserId', '') = coalesce(n ->> 'byUserId', '')
       and coalesce(o ->> 'by', '') = coalesce(n ->> 'by', '')
       and coalesce(o ->> 'at', '') = coalesce(n ->> 'at', '') then
      continue;
    end if;
    if coalesce(n ->> 'byUserId', '') is distinct from uid then
      return 'A signature must belong to the signed-in account.';
    end if;
    if role is null then
      return 'Your account cannot sign.';
    end if;
    if role <> 'admin' and lower(coalesce(n ->> 'role', '')) is distinct from lower(role) then
      return 'This step is for another role.';
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.approval_signature_error(jsonb, jsonb) from public, anon;
grant execute on function public.approval_signature_error(jsonb, jsonb) to authenticated;

create or replace function public.doc_write_guard(p_kind text, old_payload jsonb, new_payload jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  msg text;
  new_status text;
  new_approval text;
  old_locked boolean;
begin
  new_status := lower(trim(coalesce(
    new_payload #>> '{summary,status}',
    new_payload #>> '{document,ceStatus}',
    new_payload ->> 'status',
    ''
  )));
  new_approval := lower(trim(coalesce(
    new_payload #>> '{document,approval,status}',
    new_payload #>> '{summary,approval,status}',
    new_payload #>> '{approval,status}',
    ''
  )));
  if new_status = 'done' and new_approval is distinct from 'accepted' then
    return 'Done is only available after the approval is accepted.';
  end if;

  if p_kind = 'ce' and old_payload is not null then
    old_locked := lower(coalesce(old_payload #>> '{document,approval,status}', old_payload #>> '{summary,approval,status}', '')) = 'accepted'
      or lower(coalesce(old_payload #>> '{summary,status}', old_payload #>> '{document,ceStatus}', '')) in ('done', 'accepted');
    if old_locked and (old_payload #> '{document,tasks}') is distinct from (new_payload #> '{document,tasks}') then
      return 'Approved estimates cannot change tasks.';
    end if;
  end if;

  msg := public.approval_signature_error(old_payload -> 'approval', new_payload -> 'approval');
  if msg is not null then
    return msg;
  end if;
  msg := public.approval_signature_error(old_payload #> '{document,approval}', new_payload #> '{document,approval}');
  if msg is not null then
    return msg;
  end if;
  msg := public.approval_signature_error(old_payload #> '{summary,approval}', new_payload #> '{summary,approval}');
  return msg;
end;
$$;

revoke all on function public.doc_write_guard(text, jsonb, jsonb) from public, anon;
grant execute on function public.doc_write_guard(text, jsonb, jsonb) to authenticated;

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

create or replace function public.decline_user(p_user_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can decline an account.');
  end if;
  update public.app_user_roles
    set status = 'declined',
        decided_by = auth.uid()::text,
        decided_at = now()
    where user_key = p_user_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account was not found.');
  end if;
  return jsonb_build_object('ok', true, 'status', 'declined');
end;
$$;

revoke all on function public.decline_user(text) from public, anon;
grant execute on function public.decline_user(text) to authenticated;

create or replace function public.disable_user(p_user_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can disable an account.');
  end if;
  if p_user_key = auth.uid()::text then
    return jsonb_build_object('ok', false, 'reason', 'You cannot disable your own account.');
  end if;
  update public.app_user_roles
    set status = 'disabled',
        decided_by = auth.uid()::text,
        decided_at = now()
    where user_key = p_user_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That account was not found.');
  end if;
  return jsonb_build_object('ok', true, 'status', 'disabled');
end;
$$;

revoke all on function public.disable_user(text) from public, anon;
grant execute on function public.disable_user(text) to authenticated;

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


create or replace function public.save_workspace_doc(
  p_kind text,
  p_doc_id text,
  p_payload jsonb,
  p_ord integer,
  p_expected bigint,
  p_force boolean,
  p_delete boolean,
  p_mirror jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.workspace_docs%rowtype;
  new_version bigint;
  err text;
  old_payload jsonb;
  estimate jsonb;
  document jsonb;
  admin_gate boolean := true;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to save.' using errcode = '42501';
  end if;
  if p_kind is null or p_doc_id is null or length(trim(p_doc_id)) = 0 then
    raise exception 'Missing document id.' using errcode = '22023';
  end if;

  if not public.is_active_user() then
    return jsonb_build_object('ok', false, 'forbidden', true, 'reason', 'Waiting for admin approval');
  end if;

  if to_regprocedure('public.is_admin()') is not null then
    admin_gate := public.is_admin();
  end if;

  select * into existing
  from public.workspace_docs
  where kind = p_kind and doc_id = p_doc_id
  for update;

  if p_kind = 'admin' and not admin_gate then
    return jsonb_build_object(
      'ok', false,
      'forbidden', true,
      'reason', 'Only an admin can change settings.',
      'version', coalesce(existing.version, 0)
    );
  end if;

  old_payload := coalesce(existing.payload, '{}'::jsonb);

  if coalesce(p_delete, false) then
    if not found then
      return jsonb_build_object('ok', true, 'version', 0, 'deleted', true);
    end if;
    if existing.deleted_at is not null then
      return jsonb_build_object('ok', true, 'version', existing.version, 'deleted', true);
    end if;
    if not coalesce(p_force, false) and existing.version is distinct from p_expected then
      return jsonb_build_object('ok', false, 'conflict', 'version', 'version', existing.version);
    end if;
    new_version := existing.version + 1;
    update public.workspace_docs
      set deleted_at = now(),
          version = new_version
      where kind = p_kind and doc_id = p_doc_id;
    if p_kind = 'ce' then
      update public.cost_estimates
        set deleted_at = now()
        where id = p_doc_id;
    elsif p_kind = 'rce' then
      update public.rce_requests
        set deleted_at = now()
        where id = p_doc_id;
    end if;
    return jsonb_build_object('ok', true, 'version', new_version, 'deleted', true);
  end if;

  if found and existing.deleted_at is not null and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'conflict', 'deleted', 'version', existing.version);
  end if;

  if found and not coalesce(p_force, false)
     and p_expected is not null
     and existing.version is distinct from p_expected then
    return jsonb_build_object('ok', false, 'conflict', 'version', 'version', existing.version);
  end if;

  if not found and not coalesce(p_force, false) and p_expected is not null then
    return jsonb_build_object('ok', false, 'conflict', 'deleted', 'version', 0);
  end if;

  -- A new document (no expected version) must not overwrite a row that already exists.
  if found and existing.deleted_at is null and p_expected is null and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'conflict', 'exists', 'version', existing.version);
  end if;

  err := public.doc_write_guard(p_kind, case when found then old_payload else null end, coalesce(p_payload, '{}'::jsonb));
  if err is not null then
    return jsonb_build_object('ok', false, 'forbidden', true, 'reason', err);
  end if;

  if to_regprocedure('public.sod_error(jsonb,jsonb,text[],text[])') is not null then
    if p_kind = 'rce' then
      err := public.sod_error(
        case when found then old_payload->'approval' else null end,
        coalesce(p_payload, '{}'::jsonb)->'approval',
        public.sod_names(coalesce(p_payload, '{}'::jsonb)),
        public.sod_ids(coalesce(p_payload, '{}'::jsonb))
      );
    elsif p_kind = 'ce' then
      err := public.sod_error(
        case when found then old_payload->'summary'->'approval' else null end,
        coalesce(p_payload, '{}'::jsonb)->'summary'->'approval',
        public.sod_names(coalesce(p_payload->'summary', '{}'::jsonb)),
        public.sod_ids(coalesce(p_payload->'summary', '{}'::jsonb))
      );
      if err is null then
        err := public.sod_error(
          case when found then old_payload->'document'->'approval' else null end,
          coalesce(p_payload, '{}'::jsonb)->'document'->'approval',
          public.sod_names(coalesce(p_payload->'document', '{}'::jsonb)),
          public.sod_ids(coalesce(p_payload->'document', '{}'::jsonb))
        );
      end if;
    end if;
    if err is not null then
      raise exception '%', err using errcode = '42501';
    end if;
  end if;

  if not found then
    insert into public.workspace_docs (kind, doc_id, payload, version, ord, deleted_at)
    values (p_kind, p_doc_id, coalesce(p_payload, '{}'::jsonb), 1, coalesce(p_ord, 0), null);
    new_version := 1;
  else
    new_version := existing.version + 1;
    update public.workspace_docs
      set payload = coalesce(p_payload, '{}'::jsonb),
          version = new_version,
          ord = coalesce(p_ord, ord),
          deleted_at = case when coalesce(p_force, false) then null else deleted_at end
      where kind = p_kind and doc_id = p_doc_id
        and (deleted_at is null or coalesce(p_force, false));
    if not found then
      return jsonb_build_object('ok', false, 'conflict', 'deleted', 'version', existing.version);
    end if;
  end if;

  if p_mirror is not null and p_kind = 'rce' then
    insert into public.rce_requests (
      id, company_name, client, customer, address, location, description, category,
      project_type, project_title, inquiry_number, inquiry_date, rce_no, rce_date,
      priority_level, ce_deadline, submission_deadline, shopwork, onsite, trading,
      mechanical, electrical, other_remarks, decline_reason, prepared_by, reviewed_by,
      approved_by, status, date_received, payload
    ) values (
      p_doc_id,
      p_mirror->>'company_name',
      p_mirror->>'client',
      p_mirror->>'customer',
      p_mirror->>'address',
      p_mirror->>'location',
      p_mirror->>'description',
      p_mirror->>'category',
      p_mirror->>'project_type',
      p_mirror->>'project_title',
      p_mirror->>'inquiry_number',
      nullif(p_mirror->>'inquiry_date', '')::date,
      p_mirror->>'rce_no',
      nullif(p_mirror->>'rce_date', '')::date,
      p_mirror->>'priority_level',
      nullif(p_mirror->>'ce_deadline', '')::date,
      nullif(p_mirror->>'submission_deadline', '')::date,
      coalesce((p_mirror->>'shopwork')::boolean, false),
      coalesce((p_mirror->>'onsite')::boolean, false),
      coalesce((p_mirror->>'trading')::boolean, false),
      coalesce((p_mirror->>'mechanical')::boolean, false),
      coalesce((p_mirror->>'electrical')::boolean, false),
      p_mirror->>'other_remarks',
      p_mirror->>'decline_reason',
      p_mirror->>'prepared_by',
      p_mirror->>'reviewed_by',
      p_mirror->>'approved_by',
      coalesce(nullif(p_mirror->>'status', ''), 'Pending'),
      nullif(p_mirror->>'date_received', '')::date,
      coalesce(p_mirror->'payload', '{}'::jsonb)
    )
    on conflict (id) do update set
      deleted_at = null,
      company_name = excluded.company_name,
      client = excluded.client,
      customer = excluded.customer,
      address = excluded.address,
      location = excluded.location,
      description = excluded.description,
      category = excluded.category,
      project_type = excluded.project_type,
      project_title = excluded.project_title,
      inquiry_number = excluded.inquiry_number,
      inquiry_date = excluded.inquiry_date,
      rce_no = excluded.rce_no,
      rce_date = excluded.rce_date,
      priority_level = excluded.priority_level,
      ce_deadline = excluded.ce_deadline,
      submission_deadline = excluded.submission_deadline,
      shopwork = excluded.shopwork,
      onsite = excluded.onsite,
      trading = excluded.trading,
      mechanical = excluded.mechanical,
      electrical = excluded.electrical,
      other_remarks = excluded.other_remarks,
      decline_reason = excluded.decline_reason,
      prepared_by = excluded.prepared_by,
      reviewed_by = excluded.reviewed_by,
      approved_by = excluded.approved_by,
      status = excluded.status,
      date_received = excluded.date_received,
      payload = excluded.payload;
  elsif p_mirror is not null and p_kind = 'ce' then
    estimate := coalesce(p_mirror->'estimate', '{}'::jsonb);
    document := coalesce(p_mirror->'document', '{}'::jsonb);
    insert into public.cost_estimates (
      id, rce_id, client, location, project, status, last_edited, last_edited_by
    ) values (
      p_doc_id,
      nullif(estimate->>'rce_id', ''),
      estimate->>'client',
      estimate->>'location',
      estimate->>'project',
      coalesce(nullif(estimate->>'status', ''), 'Draft'),
      nullif(estimate->>'last_edited', '')::date,
      estimate->>'last_edited_by'
    )
    on conflict (id) do update set
      deleted_at = null,
      rce_id = excluded.rce_id,
      client = excluded.client,
      location = excluded.location,
      project = excluded.project,
      status = excluded.status,
      last_edited = excluded.last_edited,
      last_edited_by = excluded.last_edited_by;
    insert into public.ce_documents (
      ce_id, meta, sow_text, ce_status, view_type, doc_no, rev_no, rev_date,
      file_attachments, summary_task_filters, document
    ) values (
      p_doc_id,
      coalesce(document->'meta', '{}'::jsonb),
      coalesce(document->>'sow_text', ''),
      document->>'ce_status',
      document->>'view_type',
      document->>'doc_no',
      document->>'rev_no',
      nullif(document->>'rev_date', '')::date,
      coalesce(document->'file_attachments', '{}'::jsonb),
      coalesce(document->'summary_task_filters', '{}'::jsonb),
      coalesce(document->'document', '{}'::jsonb)
    )
    on conflict (ce_id) do update set
      meta = excluded.meta,
      sow_text = excluded.sow_text,
      ce_status = excluded.ce_status,
      view_type = excluded.view_type,
      doc_no = excluded.doc_no,
      rev_no = excluded.rev_no,
      rev_date = excluded.rev_date,
      file_attachments = excluded.file_attachments,
      summary_task_filters = excluded.summary_task_filters,
      document = excluded.document;
  end if;

  return jsonb_build_object('ok', true, 'version', new_version);
end;
$$;


revoke all on function public.save_workspace_doc(text, text, jsonb, integer, bigint, boolean, boolean, jsonb)
  from public, anon;
grant execute on function public.save_workspace_doc(text, text, jsonb, integer, bigint, boolean, boolean, jsonb)
  to authenticated;

-- Reads stay. Writes go through save_workspace_doc only.
drop policy if exists authenticated_insert on public.workspace_docs;
drop policy if exists authenticated_update on public.workspace_docs;
drop policy if exists authenticated_delete on public.workspace_docs;
revoke insert, update, delete on table public.workspace_docs from authenticated;
grant select on table public.workspace_docs to authenticated;

do $$
begin
  if to_regprocedure('public.is_active_user()') is null then
    raise exception 'FAIL: is_active_user missing';
  end if;
  if to_regprocedure('public.register_pending(jsonb)') is null then
    raise exception 'FAIL: register_pending missing';
  end if;
  if to_regprocedure('public.grant_role(text,text)') is null then
    raise exception 'FAIL: grant_role missing';
  end if;
  if to_regprocedure('public.decline_user(text)') is null then
    raise exception 'FAIL: decline_user missing';
  end if;
  if to_regprocedure('public.disable_user(text)') is null then
    raise exception 'FAIL: disable_user missing';
  end if;
  if to_regprocedure('public.list_user_access()') is null then
    raise exception 'FAIL: list_user_access missing';
  end if;
  if to_regprocedure('public.email_is_allowed(text)') is null then
    raise exception 'FAIL: email allowlist missing';
  end if;
  if to_regprocedure('public.save_workspace_doc(text,text,jsonb,integer,bigint,boolean,boolean,jsonb)') is null then
    raise exception 'FAIL: save_workspace_doc signature changed';
  end if;
  if has_table_privilege('authenticated', 'public.workspace_docs', 'insert')
     or has_table_privilege('authenticated', 'public.workspace_docs', 'update')
     or has_table_privilege('authenticated', 'public.workspace_docs', 'delete') then
    raise exception 'FAIL: authenticated can still write workspace_docs directly';
  end if;
  if position('Only an admin can change settings.' in pg_get_functiondef(to_regprocedure('public.save_workspace_doc(text,text,jsonb,integer,bigint,boolean,boolean,jsonb)'))) = 0 then
    raise exception 'FAIL: admin write does not return ok false';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_user_roles' and column_name = 'status'
  ) then
    raise exception 'FAIL: status column missing';
  end if;
  raise notice 'PASS: access control, pending accounts, and direct-write revoke';
end $$;
