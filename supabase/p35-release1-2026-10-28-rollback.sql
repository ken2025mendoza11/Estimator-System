-- Undo supabase/p35-release1-2026-10-28.sql only. Do not run this from the app.
-- Does not delete proposals or markups.
-- The p34 rollback (not this file) deletes saved markups. Back up before that one.
-- Restores the p34 sample-counter function and the p34 estimate guard.

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
    grant execute on function public.release1_advance_sample_counters(integer, text, integer) to service_role;
  end if;
end;
$$;

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
        null;
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

drop function if exists public.ce_release1_jo_status_ok(jsonb, jsonb);
drop function if exists public.release_proposal_pr(text);
