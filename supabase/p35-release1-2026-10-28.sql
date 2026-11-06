-- Step 35. Apply after p34-release1-2026-10-28.sql. Do not run this from the app.
-- The sample-counter function is only for the seed. It never moves the proposal sequence backwards.
-- A locked estimate becomes Awarded only when an approved job order already links that estimate.
-- Cancel is allowed only when that job order is already cancelled.
-- Releasing a PR number clears it. It does not delete a row.

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
  cur integer;
  called boolean;
  used integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Only the seed can advance the sample counters.');
  end if;
  if proposal_at > 0 then
    select last_value, is_called into cur, called from public.release1_proposal_control_seq;
    used := case when called then cur else greatest(cur - 1, 0) end;
    if proposal_at > used then
      perform setval('public.release1_proposal_control_seq', proposal_at, true);
    end if;
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

revoke all on function public.release1_advance_sample_counters(integer, text, integer) from public, anon, authenticated;

create or replace function public.ce_release1_jo_status_ok(old_payload jsonb, new_payload jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  old_doc jsonb := coalesce(old_payload -> 'document', '{}'::jsonb);
  new_doc jsonb := coalesce(new_payload -> 'document', '{}'::jsonb);
  old_sum jsonb := coalesce(old_payload -> 'summary', '{}'::jsonb);
  new_sum jsonb := coalesce(new_payload -> 'summary', '{}'::jsonb);
  old_status text;
  new_status text;
  ce_id text;
  orders jsonb;
  jo jsonb;
  jo_status text;
begin
  old_status := lower(trim(coalesce(old_sum ->> 'status', old_doc ->> 'ceStatus', old_doc ->> 'status', '')));
  new_status := lower(trim(coalesce(new_sum ->> 'status', new_doc ->> 'ceStatus', new_doc ->> 'status', '')));
  ce_id := coalesce(old_sum ->> 'id', new_sum ->> 'id', '');
  if ce_id = '' then
    return false;
  end if;
  select payload #> '{__app,jobOrders}' into orders
  from public.workspace_docs
  where kind = 'schema' and deleted_at is null
  order by version desc
  limit 1;
  if orders is null or jsonb_typeof(orders) <> 'array' then
    return false;
  end if;
  for jo in select value from jsonb_array_elements(orders)
  loop
    if jsonb_typeof(jo -> 'ceIds') <> 'array' or not ((jo -> 'ceIds') ? ce_id) then
      continue;
    end if;
    jo_status := lower(trim(coalesce(jo ->> 'status', '')));
    if old_status in ('done', 'accepted') and new_status = 'awarded' and jo_status = 'approved' then
      return true;
    end if;
    if old_status = 'awarded' and new_status in ('done', 'accepted') and jo_status = 'cancelled' then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

revoke all on function public.ce_release1_jo_status_ok(jsonb, jsonb) from public, anon, authenticated;

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

  if p_kind = 'ce' and old_payload is not null and public.ce_payload_locked(old_payload) then
    if old_payload is distinct from new_payload then
      if public.ce_release1_award_cancel(old_payload, new_payload) then
        if not public.ce_release1_jo_status_ok(old_payload, new_payload) then
          if new_status = 'awarded' then
            return 'Award needs an approved job order for this estimate.';
          end if;
          return 'Cancel needs a cancelled job order for this estimate.';
        end if;
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

create or replace function public.release_proposal_pr(p_control text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := trim(coalesce(p_control, ''));
  control text;
  owner text;
  actor text := coalesce(auth.uid()::text, '');
begin
  if actor = '' and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to release a PR number.');
  end if;
  if raw !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('ok', false, 'reason', 'A 4-digit control number is required.');
  end if;
  control := lpad(raw, 4, '0');
  select owner_id into owner from public.release1_proposals where control_no = control;
  if not found then
    return jsonb_build_object('ok', true, 'controlNo', control);
  end if;
  if actor <> '' and coalesce(owner, '') <> '' and owner <> actor and not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only the owner or an admin can change this PR number.');
  end if;
  update public.release1_proposals
    set pr_no = '', updated_at = now()
    where control_no = control;
  return jsonb_build_object('ok', true, 'controlNo', control);
end;
$$;

revoke all on function public.release_proposal_pr(text) from public, anon;
grant execute on function public.release_proposal_pr(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.release1_advance_sample_counters(integer, text, integer) to service_role;
    grant execute on function public.release_proposal_pr(text) to service_role;
  end if;
end;
$$;
