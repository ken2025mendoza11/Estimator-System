-- Rollback for supabase/p1a-numbering-2026-10-20.sql
-- Step: 3 / Phase 1A
-- Restores save_workspace_doc from apply-v2.sql (same signature, no exists conflict).
-- Drops only the new counter. Does not delete documents.
-- Apply on the TEST project first.

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


drop function if exists public.next_doc_no(text, text, integer);
drop table if exists public.doc_counters;

do $$
begin
  if to_regprocedure('public.next_doc_no(text,text,integer)') is not null then
    raise exception 'FAIL: next_doc_no still present';
  end if;
  if to_regclass('public.doc_counters') is not null then
    raise exception 'FAIL: doc_counters still present';
  end if;
  if position($needle$conflict', 'exists'$needle$ in pg_get_functiondef(to_regprocedure('public.save_workspace_doc(text,text,jsonb,integer,bigint,boolean,boolean,jsonb)'))) > 0 then
    raise exception 'FAIL: exists conflict still present';
  end if;
  raise notice 'PASS: numbering rollback';
end $$;
