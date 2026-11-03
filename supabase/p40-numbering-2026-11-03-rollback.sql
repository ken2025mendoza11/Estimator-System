-- Undo p40-numbering-2026-11-03.sql. Does not delete documents or job orders.
-- Restores the p34 job-order functions and the p35 sample-counter function.
-- The restored sample-counter function is the one with the year_key name clash. Do not leave this applied.

drop function if exists public.claim_user_doc_no(text, text, text);
drop table if exists public.release1_doc_numbers;

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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_job_order_no(text, text, text) to service_role;
    grant execute on function public.release1_advance_sample_counters(integer, text, integer) to service_role;
  end if;
end;
$$;
