-- Undo supabase/p34-release1-2026-10-28.sql only. Do not run this from the app.
-- Does not delete proposals. Does not drop the p30 or p31 tables.
-- Restores the p27 estimate lock, the p31 job-order claim, and the p30 PR claim.
-- The p30 rollback (not this file) deletes saved proposals. Back up before that one.

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
      if public.caller_is_sales() or not public.ce_revision_start(old_payload, new_payload) then
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

drop function if exists public.ce_release1_award_cancel(jsonb, jsonb);

create or replace function public.claim_job_order_no(p_jo_no text, p_control text, p_ces text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jo text := trim(coalesce(p_jo_no, ''));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to save a job order number.');
  end if;
  if jo = '' then
    return jsonb_build_object('ok', false, 'reason', 'A job order number is required.');
  end if;
  insert into public.release1_job_orders (jo_no, proposal_control, ce_ids, updated_at)
  values (jo, coalesce(p_control, ''), coalesce(p_ces, ''), now())
  on conflict (jo_no) do update
    set proposal_control = excluded.proposal_control, ce_ids = excluded.ce_ids, updated_at = now();
  return jsonb_build_object('ok', true, 'joNo', jo);
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
  control text := lpad(trim(coalesce(p_control, '')), 4, '0');
  pr text := regexp_replace(trim(coalesce(p_pr, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to save a PR number.');
  end if;
  if control !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'reason', 'A 4-digit control number is required.');
  end if;
  if pr = '' then
    delete from public.release1_proposals where control_no = control;
    return jsonb_build_object('ok', true, 'controlNo', control);
  end if;
  if exists (
    select 1 from public.release1_proposals
    where lower(pr_no) = lower(pr) and control_no <> control
  ) then
    return jsonb_build_object('ok', false, 'reason', 'That PR number is already used.');
  end if;
  insert into public.release1_proposals (control_no, pr_no, ce_id, updated_at)
  values (control, pr, coalesce(p_ce, ''), now())
  on conflict (control_no) do update
    set pr_no = excluded.pr_no, ce_id = excluded.ce_id, updated_at = now();
  return jsonb_build_object('ok', true, 'controlNo', control, 'prNo', pr);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'That PR number is already used.');
end;
$$;

revoke all on function public.claim_proposal_pr(text, text, text) from public, anon;
grant execute on function public.claim_proposal_pr(text, text, text) to authenticated;

drop function if exists public.next_job_order_seq_for_year(text);
drop function if exists public.release1_advance_sample_counters(integer, text, integer);
drop table if exists public.release1_job_order_year;

delete from public.workspace_docs where kind = 'markup';

alter table public.workspace_docs drop constraint if exists workspace_docs_kind_chk;

alter table public.workspace_docs add constraint workspace_docs_kind_chk check (kind in (
  'ce', 'rce', 'inspection', 'task', 'scope',
  'masterlist', 'admin', 'schema', 'notifications', 'wipes', 'proposal'
));

alter table public.release1_proposals drop column if exists owner_id;
