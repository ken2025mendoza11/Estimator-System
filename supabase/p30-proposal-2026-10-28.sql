-- Step 30. Apply after p27-ce-lock-2026-10-28.sql.
-- Apply on the TEST project first. The app keeps working when this file has not been applied.
-- Widens workspace_docs so a proposal document can be stored. Does not retype a column and does not rewrite existing rows.
-- Control numbers are 4 digits from a sequence. A client's PR number is unique among proposals that are not cancelled.

alter table public.workspace_docs drop constraint if exists workspace_docs_kind_chk;

alter table public.workspace_docs add constraint workspace_docs_kind_chk check (kind in (
  'ce', 'rce', 'inspection', 'task', 'scope',
  'masterlist', 'admin', 'schema', 'notifications', 'wipes', 'proposal'
));

create table if not exists public.release1_proposals (
  control_no text primary key,
  pr_no text not null default '',
  ce_id text not null default '',
  updated_at timestamptz not null default now(),
  constraint release1_proposals_control_chk check (control_no ~ '^[0-9]{4}$')
);

create unique index if not exists release1_proposals_pr_no_uidx
  on public.release1_proposals (lower(pr_no))
  where pr_no <> '';

alter table public.release1_proposals enable row level security;

create sequence if not exists public.release1_proposal_control_seq as integer start 1;

create or replace function public.next_proposal_control_no()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to take a proposal number.');
  end if;
  n := nextval('public.release1_proposal_control_seq');
  if n > 9999 then
    return jsonb_build_object('ok', false, 'reason', 'Proposal control numbers are exhausted.');
  end if;
  return jsonb_build_object('ok', true, 'controlNo', lpad(n::text, 4, '0'));
end;
$$;

revoke all on function public.next_proposal_control_no() from public, anon;
grant execute on function public.next_proposal_control_no() to authenticated;

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
