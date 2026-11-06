-- Step 31. Apply after p30-proposal-2026-10-28.sql.
-- Apply on the TEST project first. The app keeps working when this file has not been applied.
-- A 3-digit job-order sequence. The full number is unique. Does not rewrite other rows.

create sequence if not exists public.release1_job_order_seq as integer start 1;

create table if not exists public.release1_job_orders (
  jo_no text primary key,
  proposal_control text not null default '',
  ce_ids text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.release1_job_orders enable row level security;

create or replace function public.next_job_order_seq()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to take a job order number.');
  end if;
  n := nextval('public.release1_job_order_seq');
  if n > 999 then
    return jsonb_build_object('ok', false, 'reason', 'Job order numbers are exhausted.');
  end if;
  return jsonb_build_object('ok', true, 'seq', n);
end;
$$;

revoke all on function public.next_job_order_seq() from public, anon;
grant execute on function public.next_job_order_seq() to authenticated;

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
