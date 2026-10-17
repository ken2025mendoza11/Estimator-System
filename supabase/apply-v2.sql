-- =============================================================================
-- Estimator System — apply-v2.sql
-- One script. Safe to run again. Does not delete rows, tables, or old records.
--
-- Order inside the transaction:
--   1. Back up existing tables, including workspace_docs when it is already there.
--   2. Create workspace_docs, the private bucket, and save_workspace_doc.
--   3. Add deleted_at on cost_estimates and rce_requests (no existing value changes).
--   4. Remove anonymous access and keep signed-in policies.
--   5. Store roles in app_user_roles. is_admin() reads that table.
--
-- Run this only AFTER the app that mints a Supabase JWT is deployed.
-- Supabase Dashboard → SQL Editor → New query → paste this WHOLE file → Run.
-- =============================================================================

begin;

-- =============================================================================
-- Estimator System — apply signed-in access only
-- File: supabase/apply-secure-access.sql
--
-- WHAT THIS DOES
--   Stops anonymous visitors from reading or writing the database.
--   Signed-in users can still use the working tables.
--   Only an administrator can change admin settings.
--   A person cannot approve a document they created, and cannot sign two
--   steps on the same document. Old saved documents are not rewritten.
--
-- WHAT THIS DOES NOT DO
--   It does not delete any table, column, or row.
--   It does not change any existing record.
--   It does not make anyone an administrator. That is a separate optional
--   step, written at the bottom as comments only.
--
-- SAFE TO RUN AGAIN
--   If a backup copy already exists, it is left as it was.
--   Policies are dropped only if they exist, then created again.
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New query → paste this WHOLE file → Run.
--   Run it as one query. Do not run only part of it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Stop immediately if a required table is missing.
--    Nothing below this has changed the database yet.
-- ---------------------------------------------------------------------------
do $$
declare
  missing text := '';
  t text;
begin
  foreach t in array array[
    'profiles',
    'companies',
    'clients',
    'masterlist_categories',
    'masterlist_items',
    'schema_columns',
    'rce_requests',
    'rce_checklist_items',
    'rce_attachments',
    'cost_estimates',
    'ce_documents',
    'ce_tasks',
    'ce_subtasks',
    'ce_line_items',
    'ce_versions',
    'ce_attachments',
    'monitoring_entries',
    'scope_templates',
    'scope_template_tasks',
    'estimator_workspace',
    'app_settings'
  ]
  loop
    if to_regclass('public.' || t) is null then
      missing := missing || t || ', ';
    end if;
  end loop;
  if missing <> '' then
    raise exception
      'Stopped before any change. These tables are missing: % Paste the error and do not continue.',
      missing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Backup. Copies rows into new tables. Does not change the originals.
--    The first run takes the copy. A later run keeps that first copy.
--    Backup tables are locked so the website cannot read them.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  dest text;
begin
  foreach t in array array[
    'profiles',
    'companies',
    'clients',
    'masterlist_categories',
    'masterlist_items',
    'schema_columns',
    'rce_requests',
    'rce_checklist_items',
    'rce_attachments',
    'cost_estimates',
    'ce_documents',
    'ce_tasks',
    'ce_subtasks',
    'ce_line_items',
    'ce_versions',
    'ce_attachments',
    'monitoring_entries',
    'scope_templates',
    'scope_template_tasks',
    'estimator_workspace',
    'app_settings',
    'workspace_docs'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    dest := t || '_backup_20261016';
    if to_regclass('public.' || dest) is null then
      execute format(
        'create table public.%I as select * from public.%I',
        dest,
        t
      );
    end if;
    execute format('alter table public.%I enable row level security', dest);
    execute format('revoke all on table public.%I from public, anon, authenticated', dest);
  end loop;
end $$;

-- A one-time copy of the rules (policies) that exist right now.
-- Used only if you need to see what was there. It is not app data.
create table if not exists public.policy_backup_20261016 (
  backed_up_at timestamptz not null default now(),
  schemaname text,
  tablename text,
  policyname text,
  permissive text,
  roles name[],
  cmd text,
  qual text,
  with_check text
);

insert into public.policy_backup_20261016 (
  schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
)
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and not exists (select 1 from public.policy_backup_20261016);

alter table public.policy_backup_20261016 enable row level security;
revoke all on table public.policy_backup_20261016 from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Soft delete columns. Nullable. Existing rows stay visible (deleted_at null).
-- ---------------------------------------------------------------------------
alter table public.cost_estimates add column if not exists deleted_at timestamptz;
alter table public.rce_requests add column if not exists deleted_at timestamptz;

-- =============================================================================
-- Estimator System — per-document saves, versions, and private file storage
-- Supabase Dashboard → SQL Editor → New query → paste this file → Run
-- Safe to run more than once. Does not delete rows or rewrite existing ids.
-- The app copies the old workspace snapshot into workspace_docs on next load.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.workspace_docs (
  kind text not null,
  doc_id text not null,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  ord integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (kind, doc_id),
  constraint workspace_docs_kind_chk check (kind in (
    'ce', 'rce', 'inspection', 'task', 'scope',
    'masterlist', 'admin', 'schema', 'notifications', 'wipes'
  ))
);

create index if not exists workspace_docs_kind_idx on public.workspace_docs (kind);

drop trigger if exists set_updated_at on public.workspace_docs;
create trigger set_updated_at
  before update on public.workspace_docs
  for each row execute procedure public.set_updated_at();

alter table public.workspace_docs enable row level security;
drop policy if exists authenticated_select on public.workspace_docs;
drop policy if exists authenticated_insert on public.workspace_docs;
drop policy if exists authenticated_update on public.workspace_docs;
drop policy if exists authenticated_delete on public.workspace_docs;
create policy authenticated_select on public.workspace_docs
  for select to authenticated using (true);
create policy authenticated_insert on public.workspace_docs
  for insert to authenticated with check (true);
create policy authenticated_update on public.workspace_docs
  for update to authenticated using (true) with check (true);
create policy authenticated_delete on public.workspace_docs
  for delete to authenticated using (true);

grant select, insert, update, delete on public.workspace_docs to authenticated;

-- Staff can record the one-time migration flag. They still cannot write other settings.
drop policy if exists app_settings_migration on public.app_settings;
create policy app_settings_migration on public.app_settings
  for all to authenticated
  using (key = 'migration:doc-safety')
  with check (key = 'migration:doc-safety');

-- One private bucket. Signed-in users only. No public and no anonymous access.
insert into storage.buckets (id, name, public)
values ('estimator-files', 'estimator-files', false)
on conflict (id) do update set public = false;

drop policy if exists estimator_files_select on storage.objects;
drop policy if exists estimator_files_insert on storage.objects;
drop policy if exists estimator_files_update on storage.objects;
drop policy if exists estimator_files_delete on storage.objects;

create policy estimator_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'estimator-files');
create policy estimator_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'estimator-files');
create policy estimator_files_update on storage.objects
  for update to authenticated
  using (bucket_id = 'estimator-files')
  with check (bucket_id = 'estimator-files');
create policy estimator_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'estimator-files');

-- Version check, deletion tombstone, approval rule, and the mirror row
-- commit together. A conflict returns ok=false and does not change the row.
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

  if to_regprocedure('public.is_admin()') is not null then
    admin_gate := public.is_admin();
  end if;

  select * into existing
  from public.workspace_docs
  where kind = p_kind and doc_id = p_doc_id
  for update;

  if p_kind = 'admin' and not admin_gate then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
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

-- ---------------------------------------------------------------------------
-- 2. Take the anonymous key's access away.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke usage on schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname = 'public' and 'anon' = any (roles))
       or (schemaname = 'public' and policyname = 'anon_all')
       or (schemaname = 'storage' and tablename = 'objects' and 'anon' = any (roles))
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Helpers. A signed-in user cannot change profiles.role.
--    The SQL editor can still assign roles, because it has no user id.
-- ---------------------------------------------------------------------------
create table if not exists public.app_user_roles (
  user_key text primary key,
  email text,
  role text not null default 'staff',
  constraint app_user_roles_role_chk check (role in ('admin', 'head', 'lead', 'staff'))
);

alter table public.app_user_roles enable row level security;
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
revoke all on table public.app_user_roles from public, anon;
grant select on table public.app_user_roles to authenticated;

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

create or replace function public.lock_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_profile_role on public.profiles;
create trigger lock_profile_role
  before update on public.profiles
  for each row execute procedure public.lock_profile_role();

-- ---------------------------------------------------------------------------
-- 4. Signed-in access on the working tables.
--    profiles and app_settings are tighter, in the next two sections.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies',
    'clients',
    'masterlist_categories',
    'masterlist_items',
    'schema_columns',
    'rce_requests',
    'rce_checklist_items',
    'rce_attachments',
    'cost_estimates',
    'ce_documents',
    'ce_tasks',
    'ce_subtasks',
    'ce_line_items',
    'ce_versions',
    'ce_attachments',
    'monitoring_entries',
    'scope_templates',
    'scope_template_tasks',
    'estimator_workspace'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists team_select on public.%I', t);
    execute format('drop policy if exists team_insert on public.%I', t);
    execute format('drop policy if exists team_update on public.%I', t);
    execute format('drop policy if exists team_delete on public.%I', t);
    execute format('drop policy if exists authenticated_select on public.%I', t);
    execute format('drop policy if exists authenticated_insert on public.%I', t);
    execute format('drop policy if exists authenticated_update on public.%I', t);
    execute format('drop policy if exists authenticated_delete on public.%I', t);
    execute format(
      'create policy authenticated_select on public.%I for select to authenticated using (true)',
      t
    );
    execute format(
      'create policy authenticated_insert on public.%I for insert to authenticated with check (true)',
      t
    );
    execute format(
      'create policy authenticated_update on public.%I for update to authenticated using (true) with check (true)',
      t
    );
    execute format(
      'create policy authenticated_delete on public.%I for delete to authenticated using (true)',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Profiles: a person can read and update only their own row.
--    They still cannot change their role (the trigger above blocks that).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists team_select on public.profiles;
drop policy if exists team_insert on public.profiles;
drop policy if exists team_update on public.profiles;
drop policy if exists team_delete on public.profiles;
drop policy if exists anon_all on public.profiles;
drop policy if exists authenticated_select on public.profiles;
drop policy if exists authenticated_insert on public.profiles;
drop policy if exists authenticated_update on public.profiles;
drop policy if exists authenticated_delete on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Settings: any signed-in user may read them.
--    Only an administrator may write them.
--    File blobs whose key starts with files: stay writable for attachments.
-- ---------------------------------------------------------------------------
alter table public.app_settings enable row level security;
drop policy if exists team_select on public.app_settings;
drop policy if exists team_insert on public.app_settings;
drop policy if exists team_update on public.app_settings;
drop policy if exists team_delete on public.app_settings;
drop policy if exists anon_all on public.app_settings;
drop policy if exists authenticated_select on public.app_settings;
drop policy if exists authenticated_insert on public.app_settings;
drop policy if exists authenticated_update on public.app_settings;
drop policy if exists authenticated_delete on public.app_settings;
drop policy if exists app_settings_select on public.app_settings;
drop policy if exists app_settings_insert on public.app_settings;
drop policy if exists app_settings_update on public.app_settings;
drop policy if exists app_settings_delete on public.app_settings;

create policy app_settings_select on public.app_settings
  for select to authenticated
  using (true);

create policy app_settings_insert on public.app_settings
  for insert to authenticated
  with check (public.is_admin() or key like 'files:%');

create policy app_settings_update on public.app_settings
  for update to authenticated
  using (public.is_admin() or key like 'files:%')
  with check (public.is_admin() or key like 'files:%');

create policy app_settings_delete on public.app_settings
  for delete to authenticated
  using (public.is_admin() or key like 'files:%');

-- A non-admin save of the shared workspace must not overwrite admin settings
-- stored inside that row. The rest of the row still saves.
create or replace function public.keep_admin_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.schema_config = jsonb_set(
      coalesce(new.schema_config, '{}'::jsonb),
      '{__app,adminConfig}',
      coalesce(old.schema_config #> '{__app,adminConfig}', 'null'::jsonb),
      true
    );
  elsif new.schema_config #> '{__app,adminConfig}' is not null then
    new.schema_config = new.schema_config #- '{__app,adminConfig}';
  end if;
  return new;
end;
$$;

drop trigger if exists keep_admin_config on public.estimator_workspace;
create trigger keep_admin_config
  before insert or update on public.estimator_workspace
  for each row execute procedure public.keep_admin_config();

-- ---------------------------------------------------------------------------
-- 7. Approval rule.
--    A new approve / sign / return by the document's creator is rejected.
--    One account cannot sign more than one step.
--    Documents that already break this rule still open and still save
--    when their signatures are left unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.sod_names(doc jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(n) filter (where n is not null and n <> ''), array[]::text[])
  from (
    select nullif(lower(trim(coalesce(doc->>'preparedBy', ''))), '') as n
    union all select nullif(lower(trim(coalesce(doc->>'submittedBy', ''))), '')
    union all select nullif(lower(trim(coalesce(doc->>'createdBy', ''))), '')
    union all select nullif(lower(trim(coalesce(doc->'approval'->>'startedBy', ''))), '')
    union all select nullif(lower(trim(coalesce(doc->'approval'->>'createdBy', ''))), '')
    union all select nullif(lower(trim(coalesce(doc->'approval'->>'submittedBy', ''))), '')
    union all select nullif(lower(trim(coalesce(doc->'projectInfo'->>'preparedBy', ''))), '')
  ) s;
$$;

create or replace function public.sod_ids(doc jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(n) filter (where n is not null and n <> ''), array[]::text[])
  from (
    select nullif(doc->>'createdByUserId', '') as n
    union all select nullif(doc->>'submittedByUserId', '')
    union all select nullif(doc->>'preparedByUserId', '')
    union all select nullif(doc->'approval'->>'startedByUserId', '')
  ) s;
$$;

create or replace function public.sod_error(
  old_approval jsonb,
  new_approval jsonb,
  owner_names text[],
  owner_ids text[]
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  signer_name text := '';
  signer_email text := '';
  owners text[] := coalesce(owner_names, array[]::text[]);
  ids text[] := coalesce(owner_ids, array[]::text[]);
  steps jsonb;
  old_steps jsonb;
  n int;
  i int;
  new_step jsonb;
  old_step jsonb;
  prior_names text[] := array[]::text[];
  prior_ids text[] := array[]::text[];
  decision text;
  step_name text;
  step_ids text;
  changed boolean;
begin
  if uid is null or uid = '' or new_approval is null then
    return null;
  end if;
  if old_approval is not distinct from new_approval then
    return null;
  end if;

  select lower(trim(coalesce(display_name, ''))), lower(trim(coalesce(email, '')))
    into signer_name, signer_email
  from public.profiles
  where id = auth.uid();

  if coalesce(jsonb_array_length(new_approval->'steps'), 0) > 0
     and lower(coalesce(new_approval->'steps'->0->>'decision', '')) = 'prepared' then
    step_name := nullif(lower(trim(coalesce(new_approval->'steps'->0->>'by', ''))), '');
    if step_name is not null then
      owners := owners || array[step_name];
    end if;
  end if;
  step_name := nullif(lower(trim(coalesce(new_approval->>'startedBy', ''))), '');
  if step_name is not null then
    owners := owners || array[step_name];
  end if;
  step_ids := nullif(new_approval->>'startedByUserId', '');
  if step_ids is not null then
    ids := ids || array[step_ids];
  end if;

  steps := new_approval->'steps';
  old_steps := old_approval->'steps';
  n := coalesce(jsonb_array_length(steps), 0);
  for i in 0 .. greatest(n - 1, -1) loop
    new_step := steps->i;
    old_step := old_steps->i;
    if coalesce(new_step->>'decision', '') = '' or coalesce(new_step->>'by', '') = '' then
      continue;
    end if;
    changed := old_step is null
      or old_step->>'decision' is distinct from new_step->>'decision'
      or old_step->>'by' is distinct from new_step->>'by'
      or old_step->>'at' is distinct from new_step->>'at';
    step_name := lower(trim(coalesce(new_step->>'by', '')));
    decision := lower(trim(coalesce(new_step->>'decision', '')));
    if changed then
      if coalesce(new_step->>'byUserId', '') <> '' and new_step->>'byUserId' <> uid then
        return 'Approval signer does not match the signed-in account.';
      end if;
      if decision in ('accept', 'approved', 'reject', 'rejected', 'return', 'returned')
         and (
           uid = any(ids)
           or (signer_name <> '' and signer_name = any(owners))
           or (signer_email <> '' and signer_email = any(owners))
         ) then
        return 'You cannot approve, sign, or return a document you created or submitted.';
      end if;
      if uid = any(prior_ids)
         or (signer_name <> '' and signer_name = any(prior_names))
         or (signer_email <> '' and signer_email = any(prior_names)) then
        return 'You already signed a step on this document.';
      end if;
    end if;
    if step_name <> '' then
      prior_names := prior_names || array[step_name];
    end if;
    if coalesce(new_step->>'byUserId', '') <> '' then
      prior_ids := prior_ids || array[new_step->>'byUserId'];
    end if;
    if coalesce(new_step->>'actedByUserId', '') <> '' then
      prior_ids := prior_ids || array[new_step->>'actedByUserId'];
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.sod_list(old_list jsonb, new_list jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  item jsonb;
  old_item jsonb;
  err text;
  item_id text;
begin
  if new_list is null or jsonb_typeof(new_list) <> 'array' then
    return null;
  end if;
  for item in select value from jsonb_array_elements(new_list) loop
    item_id := coalesce(item->>'id', item->>'rceNo', '');
    old_item := null;
    if item_id <> '' and old_list is not null and jsonb_typeof(old_list) = 'array' then
      select value into old_item
      from jsonb_array_elements(old_list) as value
      where coalesce(value->>'id', value->>'rceNo', '') = item_id
      limit 1;
    end if;
    err := public.sod_error(
      old_item->'approval',
      item->'approval',
      public.sod_names(item),
      public.sod_ids(item)
    );
    if err is not null then
      return err;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.sod_map(old_map jsonb, new_map jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  entry record;
  err text;
  prev jsonb;
begin
  if new_map is null or jsonb_typeof(new_map) <> 'object' then
    return null;
  end if;
  for entry in select key, value from jsonb_each(new_map) loop
    prev := case when old_map is not null then old_map->entry.key else null end;
    err := public.sod_error(
      prev->'approval',
      entry.value->'approval',
      public.sod_names(entry.value),
      public.sod_ids(entry.value)
    );
    if err is not null then
      return err;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.enforce_approval_sod()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'estimator_workspace' then
    if tg_op = 'INSERT' then
      err := public.sod_list(null, new.rce_list);
      if err is null then
        err := public.sod_list(null, new.ce_list);
      end if;
      if err is null then
        err := public.sod_map(null, new.documents);
      end if;
    else
      err := public.sod_list(old.rce_list, new.rce_list);
      if err is null then
        err := public.sod_list(old.ce_list, new.ce_list);
      end if;
      if err is null then
        err := public.sod_map(old.documents, new.documents);
      end if;
    end if;
  elsif tg_table_name = 'rce_requests' then
    err := public.sod_error(
      case when tg_op = 'INSERT' then null else old.payload->'approval' end,
      new.payload->'approval',
      public.sod_names(new.payload),
      public.sod_ids(new.payload)
    );
  elsif tg_table_name = 'ce_documents' then
    err := public.sod_error(
      case when tg_op = 'INSERT' then null else old.document->'approval' end,
      new.document->'approval',
      public.sod_names(new.document),
      public.sod_ids(new.document)
    );
  end if;
  if err is not null then
    raise exception '%', err using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_approval_sod on public.estimator_workspace;
create trigger enforce_approval_sod
  before insert or update on public.estimator_workspace
  for each row execute procedure public.enforce_approval_sod();

drop trigger if exists enforce_approval_sod on public.rce_requests;
create trigger enforce_approval_sod
  before insert or update on public.rce_requests
  for each row execute procedure public.enforce_approval_sod();

drop trigger if exists enforce_approval_sod on public.ce_documents;
create trigger enforce_approval_sod
  before insert or update on public.ce_documents
  for each row execute procedure public.enforce_approval_sod();

revoke all on function public.sod_names(jsonb) from public, anon;
revoke all on function public.sod_ids(jsonb) from public, anon;
revoke all on function public.sod_error(jsonb, jsonb, text[], text[]) from public, anon;
revoke all on function public.sod_list(jsonb, jsonb) from public, anon;
revoke all on function public.sod_map(jsonb, jsonb) from public, anon;
revoke all on function public.enforce_approval_sod() from public, anon;
revoke all on function public.keep_admin_config() from public, anon;
revoke all on function public.lock_profile_role() from public, anon;
grant execute on function public.sod_names(jsonb) to authenticated;
grant execute on function public.sod_ids(jsonb) to authenticated;
grant execute on function public.sod_error(jsonb, jsonb, text[], text[]) to authenticated;
grant execute on function public.sod_list(jsonb, jsonb) to authenticated;
grant execute on function public.sod_map(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Checks. The result grid is the answer. Every row should say PASS.
--    live_rows and backup_rows on each table should be the same number.
-- ---------------------------------------------------------------------------

commit;

select check_name, result, expected
from (
  select 1 as ord, 'anon_policies_left' as check_name, count(*)::text as result,
    case when count(*) = 0
      then 'PASS — anonymous visitors have no policies'
      else 'FAIL — anonymous policies are still present' end as expected
  from pg_policies
  where 'anon' = any (roles)

  union all
  select 2, 'anon_table_grants', count(*)::text,
    case when count(*) = 0
      then 'PASS — anonymous visitors have no table grants'
      else 'FAIL — anonymous grants are still present' end
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'

  union all
  select 3, 'profiles_policies', count(*)::text,
    case when count(*) = 2
      then 'PASS — a person can only read and update their own profile'
      else 'FAIL — profiles should have exactly 2 policies' end
  from pg_policies
  where schemaname = 'public' and tablename = 'profiles'

  union all
  select 4, 'app_settings_policies', count(*)::text,
    case when count(*) >= 4
      then 'PASS — settings are limited to signed-in users, writes need an admin'
      else 'FAIL — app_settings is missing policies' end
  from pg_policies
  where schemaname = 'public' and tablename = 'app_settings'
    and policyname in (
      'app_settings_select',
      'app_settings_insert',
      'app_settings_update',
      'app_settings_delete'
    )

  union all
  select 5, 'working_table_policies', count(*)::text,
    case when count(*) = 76
      then 'PASS — 19 working tables have select, insert, update, and delete'
      else 'FAIL — expected 76 signed-in policies on the working tables' end
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'companies', 'clients', 'masterlist_categories', 'masterlist_items',
      'schema_columns', 'rce_requests', 'rce_checklist_items', 'rce_attachments',
      'cost_estimates', 'ce_documents', 'ce_tasks', 'ce_subtasks', 'ce_line_items',
      'ce_versions', 'ce_attachments', 'monitoring_entries', 'scope_templates',
      'scope_template_tasks', 'estimator_workspace'
    )
    and policyname in (
      'authenticated_select',
      'authenticated_insert',
      'authenticated_update',
      'authenticated_delete'
    )
    and 'authenticated' = any (roles)

  union all
  select 6, 'safety_triggers', count(*)::text,
    case when count(*) = 5
      then 'PASS — profile lock, admin-settings lock, and 3 approval checks'
      else 'FAIL — expected 5 triggers' end
  from pg_trigger g
  join pg_class c on c.oid = g.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not g.tgisinternal
    and g.tgname in ('lock_profile_role', 'keep_admin_config', 'enforce_approval_sod')

  union all
  select 10, 'backup_profiles',
    (select count(*) from public.profiles)::text || ' live / ' ||
    (select count(*) from public.profiles_backup_20261016)::text || ' backup',
    case when (select count(*) from public.profiles) = (select count(*) from public.profiles_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 11, 'backup_companies',
    (select count(*) from public.companies)::text || ' live / ' ||
    (select count(*) from public.companies_backup_20261016)::text || ' backup',
    case when (select count(*) from public.companies) = (select count(*) from public.companies_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 12, 'backup_clients',
    (select count(*) from public.clients)::text || ' live / ' ||
    (select count(*) from public.clients_backup_20261016)::text || ' backup',
    case when (select count(*) from public.clients) = (select count(*) from public.clients_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 13, 'backup_masterlist_categories',
    (select count(*) from public.masterlist_categories)::text || ' live / ' ||
    (select count(*) from public.masterlist_categories_backup_20261016)::text || ' backup',
    case when (select count(*) from public.masterlist_categories) = (select count(*) from public.masterlist_categories_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 14, 'backup_masterlist_items',
    (select count(*) from public.masterlist_items)::text || ' live / ' ||
    (select count(*) from public.masterlist_items_backup_20261016)::text || ' backup',
    case when (select count(*) from public.masterlist_items) = (select count(*) from public.masterlist_items_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 15, 'backup_schema_columns',
    (select count(*) from public.schema_columns)::text || ' live / ' ||
    (select count(*) from public.schema_columns_backup_20261016)::text || ' backup',
    case when (select count(*) from public.schema_columns) = (select count(*) from public.schema_columns_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 16, 'backup_rce_requests',
    (select count(*) from public.rce_requests)::text || ' live / ' ||
    (select count(*) from public.rce_requests_backup_20261016)::text || ' backup',
    case when (select count(*) from public.rce_requests) = (select count(*) from public.rce_requests_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 17, 'backup_rce_checklist_items',
    (select count(*) from public.rce_checklist_items)::text || ' live / ' ||
    (select count(*) from public.rce_checklist_items_backup_20261016)::text || ' backup',
    case when (select count(*) from public.rce_checklist_items) = (select count(*) from public.rce_checklist_items_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 18, 'backup_rce_attachments',
    (select count(*) from public.rce_attachments)::text || ' live / ' ||
    (select count(*) from public.rce_attachments_backup_20261016)::text || ' backup',
    case when (select count(*) from public.rce_attachments) = (select count(*) from public.rce_attachments_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 19, 'backup_cost_estimates',
    (select count(*) from public.cost_estimates)::text || ' live / ' ||
    (select count(*) from public.cost_estimates_backup_20261016)::text || ' backup',
    case when (select count(*) from public.cost_estimates) = (select count(*) from public.cost_estimates_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 20, 'backup_ce_documents',
    (select count(*) from public.ce_documents)::text || ' live / ' ||
    (select count(*) from public.ce_documents_backup_20261016)::text || ' backup',
    case when (select count(*) from public.ce_documents) = (select count(*) from public.ce_documents_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 21, 'backup_ce_tasks',
    (select count(*) from public.ce_tasks)::text || ' live / ' ||
    (select count(*) from public.ce_tasks_backup_20261016)::text || ' backup',
    case when (select count(*) from public.ce_tasks) = (select count(*) from public.ce_tasks_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 22, 'backup_ce_subtasks',
    (select count(*) from public.ce_subtasks)::text || ' live / ' ||
    (select count(*) from public.ce_subtasks_backup_20261016)::text || ' backup',
    case when (select count(*) from public.ce_subtasks) = (select count(*) from public.ce_subtasks_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 23, 'backup_ce_line_items',
    (select count(*) from public.ce_line_items)::text || ' live / ' ||
    (select count(*) from public.ce_line_items_backup_20261016)::text || ' backup',
    case when (select count(*) from public.ce_line_items) = (select count(*) from public.ce_line_items_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 24, 'backup_ce_versions',
    (select count(*) from public.ce_versions)::text || ' live / ' ||
    (select count(*) from public.ce_versions_backup_20261016)::text || ' backup',
    case when (select count(*) from public.ce_versions) = (select count(*) from public.ce_versions_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 25, 'backup_ce_attachments',
    (select count(*) from public.ce_attachments)::text || ' live / ' ||
    (select count(*) from public.ce_attachments_backup_20261016)::text || ' backup',
    case when (select count(*) from public.ce_attachments) = (select count(*) from public.ce_attachments_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 26, 'backup_monitoring_entries',
    (select count(*) from public.monitoring_entries)::text || ' live / ' ||
    (select count(*) from public.monitoring_entries_backup_20261016)::text || ' backup',
    case when (select count(*) from public.monitoring_entries) = (select count(*) from public.monitoring_entries_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 27, 'backup_scope_templates',
    (select count(*) from public.scope_templates)::text || ' live / ' ||
    (select count(*) from public.scope_templates_backup_20261016)::text || ' backup',
    case when (select count(*) from public.scope_templates) = (select count(*) from public.scope_templates_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 28, 'backup_scope_template_tasks',
    (select count(*) from public.scope_template_tasks)::text || ' live / ' ||
    (select count(*) from public.scope_template_tasks_backup_20261016)::text || ' backup',
    case when (select count(*) from public.scope_template_tasks) = (select count(*) from public.scope_template_tasks_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 29, 'backup_estimator_workspace',
    (select count(*) from public.estimator_workspace)::text || ' live / ' ||
    (select count(*) from public.estimator_workspace_backup_20261016)::text || ' backup',
    case when (select count(*) from public.estimator_workspace) = (select count(*) from public.estimator_workspace_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 30, 'backup_app_settings',
    (select count(*) from public.app_settings)::text || ' live / ' ||
    (select count(*) from public.app_settings_backup_20261016)::text || ' backup',
    case when (select count(*) from public.app_settings) = (select count(*) from public.app_settings_backup_20261016)
      then 'PASS — row count unchanged' else 'FAIL — row count changed' end

  union all
  select 31, 'workspace_docs',
    case
      when to_regclass('public.workspace_docs') is null then 'missing'
      else (select count(*)::text from public.workspace_docs) || ' live rows'
    end,
    case
      when to_regclass('public.workspace_docs') is null then 'FAIL — workspace_docs was not created'
      when (
        select count(*) from pg_policies
        where schemaname = 'public'
          and tablename = 'workspace_docs'
          and policyname in (
            'authenticated_select',
            'authenticated_insert',
            'authenticated_update',
            'authenticated_delete'
          )
      ) < 4 then 'FAIL — workspace_docs is missing signed-in policies'
      else 'PASS — workspace_docs exists and signed-in policies are present'
    end
) checks
order by ord;

-- =============================================================================
-- UNDO. Leave this commented. Run it only if the signed-in rules must be
-- reversed. It restores anonymous grants and recreates policies from
-- policy_backup_20261016. It does not drop tables or delete rows.
-- =============================================================================
-- begin;
-- grant usage on schema public to anon;
-- grant select, insert, update, delete on all tables in schema public to anon;
-- grant usage, select on all sequences in schema public to anon;
-- alter default privileges in schema public grant select, insert, update, delete on tables to anon;
-- alter default privileges in schema public grant usage, select on sequences to anon;
-- do $$
-- declare
--   r record;
--   role_list text;
--   using_sql text;
--   check_sql text;
-- begin
--   if to_regclass('public.policy_backup_20261016') is null then
--     raise exception 'policy_backup_20261016 is missing. Nothing was restored.';
--   end if;
--   for r in select * from public.policy_backup_20261016 loop
--     role_list := array_to_string(r.roles, ', ');
--     using_sql := case when r.qual is not null then format(' using (%s)', r.qual) else '' end;
--     check_sql := case when r.with_check is not null then format(' with check (%s)', r.with_check) else '' end;
--     execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
--     execute format(
--       'create policy %I on %I.%I as %s for %s to %s%s%s',
--       r.policyname,
--       r.schemaname,
--       r.tablename,
--       r.permissive,
--       r.cmd,
--       role_list,
--       using_sql,
--       check_sql
--     );
--   end loop;
-- end $$;
-- commit;

-- Make Ken an administrator. Replace the email, then run this line by itself.
-- insert into public.app_user_roles (user_key, email, role) values ('ken', 'REPLACE_WITH_KEN_EMAIL', 'admin') on conflict (user_key) do update set email = excluded.email, role = 'admin';
