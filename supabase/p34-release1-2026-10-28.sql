-- Step 34. Apply after p31-job-order-2026-10-28.sql. Do not run this from the app.
-- Markup is its own document kind. Award and cancel may change a locked estimate's status and timeline only.
-- Every other change to an approved estimate is still refused.
-- Job order numbers restart at 001 for each year. A claim refuses a bad or taken number.
-- An empty PR number does not delete another proposal's claim. Only the owner or an admin can change it.

alter table public.workspace_docs drop constraint if exists workspace_docs_kind_chk;

alter table public.workspace_docs add constraint workspace_docs_kind_chk check (kind in (
  'ce', 'rce', 'inspection', 'task', 'scope',
  'masterlist', 'admin', 'schema', 'notifications', 'wipes', 'proposal', 'markup'
));

alter table public.release1_proposals add column if not exists owner_id text not null default '';

create or replace function public.ce_release1_award_cancel(old_payload jsonb, new_payload jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  old_doc jsonb := coalesce(old_payload -> 'document', '{}'::jsonb);
  new_doc jsonb := coalesce(new_payload -> 'document', '{}'::jsonb);
  old_sum jsonb := coalesce(old_payload -> 'summary', '{}'::jsonb);
  new_sum jsonb := coalesce(new_payload -> 'summary', '{}'::jsonb);
  old_status text;
  new_status text;
  old_core jsonb;
  new_core jsonb;
  old_len integer;
  new_len integer;
begin
  old_status := lower(trim(coalesce(old_sum ->> 'status', old_doc ->> 'ceStatus', old_doc ->> 'status', '')));
  new_status := lower(trim(coalesce(new_sum ->> 'status', new_doc ->> 'ceStatus', new_doc ->> 'status', '')));
  if not (
    (old_status in ('done', 'accepted') and new_status = 'awarded')
    or (old_status = 'awarded' and new_status in ('done', 'accepted'))
  ) then
    return false;
  end if;
  old_len := coalesce(jsonb_array_length(old_doc -> 'timeline'), 0) + coalesce(jsonb_array_length(old_sum -> 'timeline'), 0);
  new_len := coalesce(jsonb_array_length(new_doc -> 'timeline'), 0) + coalesce(jsonb_array_length(new_sum -> 'timeline'), 0);
  if new_len <> old_len + 1 then
    return false;
  end if;
  if coalesce(jsonb_array_length(new_doc -> 'timeline'), 0) = coalesce(jsonb_array_length(old_doc -> 'timeline'), 0) + 1 then
    if coalesce(new_doc #>> '{timeline,-1,who}', '') = '' or coalesce(new_doc #>> '{timeline,-1,at}', '') = '' then
      return false;
    end if;
  elsif coalesce(jsonb_array_length(new_sum -> 'timeline'), 0) = coalesce(jsonb_array_length(old_sum -> 'timeline'), 0) + 1 then
    if coalesce(new_sum #>> '{timeline,-1,who}', '') = '' or coalesce(new_sum #>> '{timeline,-1,at}', '') = '' then
      return false;
    end if;
  else
    return false;
  end if;
  old_core := jsonb_build_object(
    'summary', (old_sum - 'timeline' - 'lastEdited' - 'lastEditedBy' - 'status' - 'client' - 'project' - 'isNew'),
    'document', (old_doc - 'timeline' - 'lastEdited' - 'lastEditedBy' - 'schedule' - 'ceStatus' - 'status')
  );
  new_core := jsonb_build_object(
    'summary', (new_sum - 'timeline' - 'lastEdited' - 'lastEditedBy' - 'status' - 'client' - 'project' - 'isNew'),
    'document', (new_doc - 'timeline' - 'lastEdited' - 'lastEditedBy' - 'schedule' - 'ceStatus' - 'status')
  );
  -- markup, awardStatus, and awardJo stay in the core, so storing them on the locked CE is refused
  return old_core = new_core;
end;
$$;

revoke all on function public.ce_release1_award_cancel(jsonb, jsonb) from public, anon;

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

  -- markup save and markup approval are their own kind and are allowed
  if p_kind = 'ce' and old_payload is not null and public.ce_payload_locked(old_payload) then
    if old_payload is distinct from new_payload then
      if public.ce_release1_award_cancel(old_payload, new_payload) then
        null; -- award and cancel are allowed
      elsif public.caller_is_sales() or not public.ce_revision_start(old_payload, new_payload) then
        return 'Approved estimates cannot be changed.';
      end if;
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

create table if not exists public.release1_job_order_year (
  year_key text primary key,
  last_seq integer not null default 0,
  constraint release1_job_order_year_chk check (year_key ~ '^\d{2}$'),
  constraint release1_job_order_year_seq_chk check (last_seq >= 0 and last_seq <= 999)
);

alter table public.release1_job_order_year enable row level security;

create or replace function public.next_job_order_seq_for_year(p_year text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(p_year, ''), '\D', '', 'g');
  year_key text := right(digits, 2);
  n integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to take a job order number.');
  end if;
  if year_key !~ '^\d{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'A year is required.');
  end if;
  insert into public.release1_job_order_year (year_key, last_seq)
  values (year_key, 1)
  on conflict (year_key) do update
    set last_seq = public.release1_job_order_year.last_seq + 1
    where public.release1_job_order_year.last_seq < 999
  returning last_seq into n;
  if n is null then
    return jsonb_build_object('ok', false, 'reason', 'Job order numbers for this year are exhausted.');
  end if;
  return jsonb_build_object('ok', true, 'seq', n, 'year', year_key);
end;
$$;

revoke all on function public.next_job_order_seq_for_year(text) from public, anon;
grant execute on function public.next_job_order_seq_for_year(text) to authenticated;

create or replace function public.claim_job_order_no(p_jo_no text, p_control text, p_ces text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jo text := trim(coalesce(p_jo_no, ''));
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to save a job order number.');
  end if;
  if jo !~ '^JO-\d{3}-(SW|F|T|O)-[A-Z0-9]{1,8}-\d{2}-\d{4}(REV\d{3})?$' then
    return jsonb_build_object('ok', false, 'reason', 'That job order number is not valid.');
  end if;
  if exists (select 1 from public.release1_job_orders where jo_no = jo) then
    return jsonb_build_object('ok', false, 'reason', 'That job order number is already used.');
  end if;
  insert into public.release1_job_orders (jo_no, proposal_control, ce_ids, updated_at)
  values (jo, coalesce(p_control, ''), coalesce(p_ces, ''), now());
  return jsonb_build_object('ok', true, 'joNo', jo);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'That job order number is already used.');
end;
$$;

revoke all on function public.claim_job_order_no(text, text, text) from public, anon;
grant execute on function public.claim_job_order_no(text, text, text) to authenticated;

create or replace function public.claim_proposal_pr(p_control text, p_pr text, p_ce text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := trim(coalesce(p_control, ''));
  control text;
  pr text := regexp_replace(trim(coalesce(p_pr, '')), '\s+', ' ', 'g');
  owner text;
  actor text := coalesce(auth.uid()::text, '');
  saved text;
begin
  if actor = '' and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to save a PR number.');
  end if;
  if raw !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('ok', false, 'reason', 'A 4-digit control number is required.');
  end if;
  control := lpad(raw, 4, '0');
  select owner_id into owner from public.release1_proposals where control_no = control;
  if actor <> '' and found and coalesce(owner, '') <> '' and owner <> actor and not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only the owner or an admin can change this PR number.');
  end if;
  if pr = '' then
    if found then
      update public.release1_proposals set pr_no = '', ce_id = coalesce(p_ce, ce_id), updated_at = now() where control_no = control;
    end if;
    return jsonb_build_object('ok', true, 'controlNo', control);
  end if;
  if exists (
    select 1 from public.release1_proposals
    where lower(pr_no) = lower(pr) and control_no <> control
  ) then
    return jsonb_build_object('ok', false, 'reason', 'That PR number is already used.');
  end if;
  insert into public.release1_proposals (control_no, pr_no, ce_id, owner_id, updated_at)
  values (control, pr, coalesce(p_ce, ''), actor, now())
  on conflict (control_no) do update
    set pr_no = excluded.pr_no,
        ce_id = excluded.ce_id,
        owner_id = case when public.release1_proposals.owner_id = '' then excluded.owner_id else public.release1_proposals.owner_id end,
        updated_at = now()
    where public.release1_proposals.owner_id = '' or public.release1_proposals.owner_id = actor or public.is_admin() or actor = ''
  returning control_no into saved;
  if saved is null then
    return jsonb_build_object('ok', false, 'reason', 'Only the owner or an admin can change this PR number.');
  end if;
  return jsonb_build_object('ok', true, 'controlNo', control, 'prNo', pr);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'That PR number is already used.');
end;
$$;

revoke all on function public.claim_proposal_pr(text, text, text) from public, anon;
grant execute on function public.claim_proposal_pr(text, text, text) to authenticated;

create or replace function public.release1_advance_sample_counters(p_proposal integer, p_year text, p_jo_seq integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(p_year, ''), '\D', '', 'g');
  year_key text := right(digits, 2);
  proposal_at integer := greatest(coalesce(p_proposal, 0), 0);
  jo_at integer := least(greatest(coalesce(p_jo_seq, 0), 0), 999);
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to advance the sample counters.');
  end if;
  if proposal_at > 0 then
    perform setval('public.release1_proposal_control_seq', proposal_at, true);
  end if;
  if year_key ~ '^\d{2}$' and jo_at > 0 then
    insert into public.release1_job_order_year (year_key, last_seq)
    values (year_key, jo_at)
    on conflict (year_key) do update
      set last_seq = greatest(public.release1_job_order_year.last_seq, excluded.last_seq);
  end if;
  return jsonb_build_object('ok', true, 'proposal', proposal_at, 'year', year_key, 'jo', jo_at);
end;
$$;

revoke all on function public.release1_advance_sample_counters(integer, text, integer) from public, anon;
grant execute on function public.release1_advance_sample_counters(integer, text, integer) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_job_order_no(text, text, text) to service_role;
    grant execute on function public.claim_proposal_pr(text, text, text) to service_role;
    grant execute on function public.release1_advance_sample_counters(integer, text, integer) to service_role;
  end if;
end;
$$;
