-- Step 40. Apply after p35-release1-2026-10-28.sql. Do not run this from the app.
-- Review before applying. Do not run on the live project.
-- Fixes Postgres 42702 in next_job_order_seq_for_year and release1_advance_sample_counters
-- by renaming plpgsql variables that shared names with release1_job_order_year.year_key.
-- claim_job_order_no does not update an existing job-order link.
-- claim_user_doc_no refuses a user-entered number that another document already has.
-- Does not delete documents. Does not move the proposal sequence backwards.

create or replace function public.next_job_order_seq_for_year(p_year text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_year, ''), '\D', '', 'g');
  v_year_key text := right(v_digits, 2);
  v_seq integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to take a job order number.');
  end if;
  if v_year_key !~ '^\d{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'A year is required.');
  end if;
  insert into public.release1_job_order_year as year_row (year_key, last_seq)
  values (v_year_key, 1)
  on conflict (year_key) do update
    set last_seq = year_row.last_seq + 1
    where year_row.last_seq < 999
  returning last_seq into v_seq;
  if v_seq is null then
    return jsonb_build_object('ok', false, 'reason', 'Job order numbers for this year are exhausted.');
  end if;
  return jsonb_build_object('ok', true, 'seq', v_seq, 'year', v_year_key);
end;
$$;

revoke all on function public.next_job_order_seq_for_year(text) from public, anon;
grant execute on function public.next_job_order_seq_for_year(text) to authenticated;

create or replace function public.release1_advance_sample_counters(p_proposal integer, p_year text, p_jo_seq integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_year, ''), '\D', '', 'g');
  v_year_key text := right(v_digits, 2);
  v_proposal_at integer := greatest(coalesce(p_proposal, 0), 0);
  v_jo_at integer := least(greatest(coalesce(p_jo_seq, 0), 0), 999);
  v_cur integer;
  v_called boolean;
  v_used integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Only the seed can advance the sample counters.');
  end if;
  if v_proposal_at > 0 then
    select last_value, is_called into v_cur, v_called from public.release1_proposal_control_seq;
    v_used := case when v_called then v_cur else greatest(v_cur - 1, 0) end;
    if v_proposal_at > v_used then
      perform setval('public.release1_proposal_control_seq', v_proposal_at, true);
    end if;
  end if;
  if v_year_key ~ '^\d{2}$' and v_jo_at > 0 then
    insert into public.release1_job_order_year as year_row (year_key, last_seq)
    values (v_year_key, v_jo_at)
    on conflict (year_key) do update
      set last_seq = greatest(year_row.last_seq, excluded.last_seq);
  end if;
  return jsonb_build_object('ok', true, 'proposal', v_proposal_at, 'year', v_year_key, 'jo', v_jo_at);
end;
$$;

revoke all on function public.release1_advance_sample_counters(integer, text, integer) from public, anon, authenticated;

create or replace function public.claim_job_order_no(p_jo_no text, p_control text, p_ces text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jo text := trim(coalesce(p_jo_no, ''));
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to save a job order number.');
  end if;
  if v_jo !~ '^JO-\d{3}-(SW|F|T|O)-[A-Z0-9]{1,8}-\d{2}-\d{4}(REV\d{3})?$' then
    return jsonb_build_object('ok', false, 'reason', 'That job order number is not valid.');
  end if;
  if exists (select 1 from public.release1_job_orders as existing where existing.jo_no = v_jo) then
    return jsonb_build_object('ok', false, 'reason', 'JO number already used');
  end if;
  insert into public.release1_job_orders (jo_no, proposal_control, ce_ids, updated_at)
  values (v_jo, coalesce(p_control, ''), coalesce(p_ces, ''), now());
  return jsonb_build_object('ok', true, 'joNo', v_jo);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'JO number already used');
end;
$$;

revoke all on function public.claim_job_order_no(text, text, text) from public, anon;
grant execute on function public.claim_job_order_no(text, text, text) to authenticated;

create table if not exists public.release1_doc_numbers (
  kind text not null,
  number_key text not null,
  doc_id text not null,
  updated_at timestamptz not null default now(),
  primary key (kind, number_key)
);

alter table public.release1_doc_numbers enable row level security;
revoke all on table public.release1_doc_numbers from public, anon, authenticated;

create or replace function public.claim_user_doc_no(p_kind text, p_doc_id text, p_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_doc_id text := trim(coalesce(p_doc_id, ''));
  v_number text := lower(trim(coalesce(p_number, '')));
  v_saved text;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'Sign in to save a document number.');
  end if;
  if v_kind = 'oif' then
    v_kind := 'inspection';
  end if;
  if v_kind not in ('ce', 'rce', 'inspection', 'markup') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown document kind.');
  end if;
  if v_doc_id = '' then
    return jsonb_build_object('ok', false, 'reason', 'A document id is required.');
  end if;
  if v_number = '' then
    delete from public.release1_doc_numbers as claimed
    where claimed.kind = v_kind and claimed.doc_id = v_doc_id;
    return jsonb_build_object('ok', true, 'docId', v_doc_id);
  end if;
  if exists (
    select 1 from public.release1_doc_numbers as claimed
    where claimed.kind = v_kind and claimed.number_key = v_number and claimed.doc_id <> v_doc_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'That number is already used.');
  end if;
  if to_regclass('public.workspace_docs') is not null then
    if exists (
      select 1 from public.workspace_docs as doc
      where doc.kind = v_kind
        and doc.doc_id <> v_doc_id
        and doc.deleted_at is null
        and (
          lower(doc.doc_id) = v_number
          or lower(trim(coalesce(
            case
              when doc.kind = 'rce' then nullif(doc.payload->>'rceNo', '')
              when doc.kind = 'inspection' then nullif(doc.payload->>'oifNo', '')
              when doc.kind = 'markup' then nullif(doc.payload->>'markupNo', '')
              when doc.kind = 'ce' then coalesce(
                nullif(doc.payload #>> '{document,projectInfo,docNo}', ''),
                nullif(doc.payload->>'ceNo', ''),
                nullif(doc.payload #>> '{summary,docNo}', '')
              )
              else null
            end,
            ''
          ))) = v_number
        )
    ) then
      return jsonb_build_object('ok', false, 'reason', 'That number is already used.');
    end if;
  end if;
  if v_kind = 'rce' and to_regclass('public.rce_requests') is not null then
    if exists (
      select 1 from public.rce_requests as request
      where request.id <> v_doc_id
        and lower(trim(coalesce(request.rce_no, ''))) = v_number
        and coalesce(request.rce_no, '') <> ''
    ) then
      return jsonb_build_object('ok', false, 'reason', 'That number is already used.');
    end if;
  end if;
  delete from public.release1_doc_numbers as claimed
  where claimed.kind = v_kind and claimed.doc_id = v_doc_id and claimed.number_key <> v_number;
  insert into public.release1_doc_numbers as claimed (kind, number_key, doc_id, updated_at)
  values (v_kind, v_number, v_doc_id, now())
  on conflict (kind, number_key) do update
    set updated_at = now()
    where claimed.doc_id = excluded.doc_id
  returning doc_id into v_saved;
  if v_saved is null then
    return jsonb_build_object('ok', false, 'reason', 'That number is already used.');
  end if;
  return jsonb_build_object('ok', true, 'docId', v_doc_id, 'number', trim(coalesce(p_number, '')));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'That number is already used.');
end;
$$;

revoke all on function public.claim_user_doc_no(text, text, text) from public, anon;
grant execute on function public.claim_user_doc_no(text, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.release1_advance_sample_counters(integer, text, integer) to service_role;
    grant execute on function public.claim_job_order_no(text, text, text) to service_role;
    grant execute on function public.claim_user_doc_no(text, text, text) to service_role;
  end if;
end;
$$;
