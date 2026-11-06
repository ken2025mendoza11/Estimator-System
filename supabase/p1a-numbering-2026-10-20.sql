-- Purpose: Phase 1A document numbers, and a create-time "exists" conflict.
-- Step: 3 / Phase 1A
-- Apply order: after supabase/apply-v2.sql. Apply on the TEST project first.
-- App code ships first. If this file is not applied, new documents keep the local number fallback.
-- Never deletes rows. save_workspace_doc keeps the same signature as apply-v2.sql.

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

  -- A new document (no expected version) must not overwrite a row that already exists.
  if found and existing.deleted_at is null and p_expected is null and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'conflict', 'exists', 'version', existing.version);
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


-- Separate counters for CE, RCE, and OIF. Seeded from the current max so existing numbers stay.
create table if not exists public.doc_counters (
  kind text not null,
  company text not null default '',
  year integer not null,
  last_no integer not null default 0,
  primary key (kind, company, year)
);

revoke all on table public.doc_counters from public, anon, authenticated;

create or replace function public.next_doc_no(
  p_kind text,
  p_company text,
  p_year integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  company_key text;
  yr integer;
  n integer;
  scanned integer := 0;
  pattern text;
  issued text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to number a document.' using errcode = '42501';
  end if;
  k := lower(trim(coalesce(p_kind, '')));
  if k = 'inspection' then
    k := 'oif';
  end if;
  if k not in ('ce', 'rce', 'oif') then
    raise exception 'Unknown document kind.' using errcode = '22023';
  end if;
  company_key := trim(coalesce(p_company, ''));
  if company_key !~ '^[A-Za-z0-9]{0,8}$' then
    raise exception 'Invalid company code.' using errcode = '22023';
  end if;
  yr := coalesce(p_year, extract(year from (now() at time zone 'Asia/Manila'))::integer);

  if k = 'ce' and company_key <> '' then
    pattern := '^CE-' || company_key || '-' || yr::text || '-([0-9]+)$';
  elsif k = 'ce' then
    pattern := '^CE-' || yr::text || '-([0-9]+)$';
  elsif k = 'rce' then
    pattern := '^RCE-' || yr::text || '-([0-9]+)$';
  else
    pattern := '^OIF-' || yr::text || '-([0-9]+)$';
  end if;

  if to_regclass('public.workspace_docs') is not null then
    select coalesce(max(val), 0) into scanned
    from (
      select (regexp_match(doc_id, pattern, 'i'))[1]::integer as val
      from public.workspace_docs
      where kind = case when k = 'oif' then 'inspection' else k end
      union all
      select (regexp_match(coalesce(payload->>'rceNo', payload->>'oifNo', payload->>'id', ''), pattern, 'i'))[1]::integer
      from public.workspace_docs
      where kind = case when k = 'oif' then 'inspection' else k end
      union all
      select (regexp_match(coalesce(payload#>>'{summary,id}', payload#>>'{summary,docNo}', payload#>>'{document,projectInfo,docNo}', ''), pattern, 'i'))[1]::integer
      from public.workspace_docs
      where kind = 'ce' and k = 'ce'
    ) found_numbers
    where val is not null;
  end if;

  if k = 'ce' and to_regclass('public.cost_estimates') is not null then
    select greatest(scanned, coalesce(max((regexp_match(id, pattern, 'i'))[1]::integer), 0))
      into scanned
      from public.cost_estimates;
  elsif k = 'rce' and to_regclass('public.rce_requests') is not null then
    select greatest(scanned, coalesce(max((regexp_match(coalesce(rce_no, id), pattern, 'i'))[1]::integer), 0))
      into scanned
      from public.rce_requests;
  end if;

  insert into public.doc_counters (kind, company, year, last_no)
  values (k, company_key, yr, 0)
  on conflict (kind, company, year) do nothing;

  select last_no into n
  from public.doc_counters
  where kind = k and company = company_key and year = yr
  for update;

  n := greatest(coalesce(n, 0), coalesce(scanned, 0)) + 1;
  update public.doc_counters
    set last_no = n
    where kind = k and company = company_key and year = yr;

  if k = 'ce' and company_key <> '' then
    issued := 'CE-' || company_key || '-' || yr::text || '-' || lpad(n::text, 3, '0');
  elsif k = 'ce' then
    issued := 'CE-' || yr::text || '-' || lpad(n::text, 3, '0');
  elsif k = 'rce' then
    issued := 'RCE-' || yr::text || '-' || lpad(n::text, 3, '0');
  else
    issued := 'OIF-' || yr::text || '-' || lpad(n::text, 3, '0');
  end if;
  return issued;
end;
$$;

revoke all on function public.next_doc_no(text, text, integer) from public, anon;
grant execute on function public.next_doc_no(text, text, integer) to authenticated;


-- PASS / FAIL. These do not insert or delete documents.
do $$
begin
  if to_regprocedure('public.next_doc_no(text,text,integer)') is null then
    raise exception 'FAIL: next_doc_no missing';
  end if;
  if to_regclass('public.doc_counters') is null then
    raise exception 'FAIL: doc_counters missing';
  end if;
  if to_regprocedure('public.save_workspace_doc(text,text,jsonb,integer,bigint,boolean,boolean,jsonb)') is null then
    raise exception 'FAIL: save_workspace_doc signature changed';
  end if;
  if position($needle$conflict', 'exists'$needle$ in pg_get_functiondef(to_regprocedure('public.save_workspace_doc(text,text,jsonb,integer,bigint,boolean,boolean,jsonb)'))) = 0 then
    raise exception 'FAIL: exists conflict missing';
  end if;
  raise notice 'PASS: numbering counters and exists conflict';
end $$;
