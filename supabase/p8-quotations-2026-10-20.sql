-- Purpose: optional mirrors for quotations, client locations, and pending records.
-- Step: 14 / Phase 8
-- Apply order: after supabase/p1b-access-2026-10-20.sql. Apply on the TEST project first.
-- The app ships first. Masterlist items and clients stay in the one JSON doc.
-- New fields are written there. These tables are a mirror. If they are missing, the app keeps the JSON.
-- Does not alter public.clients or public.masterlist_items. No Sites table. No seeded availability keys.
-- Never run from the app. Not applied by this step.
--
-- PASS: the same SHA-256 returns the existing quotation id and does not store a second file.
-- PASS: document_quotations stores the quotation id only.
-- PASS: a lead can recommend a submitted record, and only an admin can finalise a recommended one.
-- FAIL: a column added to public.clients or public.masterlist_items, or a sites table.

create table if not exists public.quotations (
  id text primary key,
  sha256 text not null unique,
  file_name text not null default '',
  mime text not null default '',
  byte_length bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quotation_lines (
  id text primary key,
  quotation_id text not null references public.quotations (id),
  description text not null default '',
  unit text not null default '',
  qty numeric not null default 0,
  unit_cost numeric not null default 0,
  masterlist_id text not null default ''
);

create table if not exists public.document_quotations (
  id text primary key,
  document_id text not null,
  quotation_id text not null references public.quotations (id),
  include_annex boolean not null default true,
  unique (document_id, quotation_id)
);

create table if not exists public.client_locations (
  id text primary key,
  client_id text not null,
  label text not null default '',
  address text not null default '',
  city text not null default '',
  notes text not null default ''
);

create table if not exists public.pending_records (
  id text primary key,
  kind text not null default 'item',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'submitted',
  replaces_id text not null default '',
  target_id text not null default '',
  submitted_by text not null default '',
  submitted_at timestamptz,
  recommended_by text not null default '',
  recommended_at timestamptz,
  recommend_note text not null default '',
  finalized_by text not null default '',
  finalized_at timestamptz,
  merged_at timestamptz,
  last_notified_at timestamptz,
  escalated_at timestamptz,
  constraint pending_records_kind check (kind in ('item', 'client')),
  constraint pending_records_status check (status in ('submitted', 'recommended', 'final', 'merged', 'declined'))
);

alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
alter table public.document_quotations enable row level security;
alter table public.client_locations enable row level security;
alter table public.pending_records enable row level security;

drop policy if exists quotations_all on public.quotations;
create policy quotations_all on public.quotations for all to authenticated using (true) with check (true);
drop policy if exists quotation_lines_all on public.quotation_lines;
create policy quotation_lines_all on public.quotation_lines for all to authenticated using (true) with check (true);
drop policy if exists document_quotations_all on public.document_quotations;
create policy document_quotations_all on public.document_quotations for all to authenticated using (true) with check (true);
drop policy if exists client_locations_all on public.client_locations;
create policy client_locations_all on public.client_locations for all to authenticated using (true) with check (true);
drop policy if exists pending_records_select on public.pending_records;
create policy pending_records_select on public.pending_records for select to authenticated using (true);

create or replace function public.save_quotation(
  p_id text,
  p_hash text,
  p_file_name text,
  p_mime text,
  p_byte_length bigint
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  select id into existing from public.quotations where sha256 = p_hash;
  if existing is not null then
    return existing;
  end if;
  insert into public.quotations (id, sha256, file_name, mime, byte_length)
  values (p_id, p_hash, coalesce(p_file_name, ''), coalesce(p_mime, ''), coalesce(p_byte_length, 0));
  return p_id;
end;
$$;

create or replace function public.recommend_pending_record(p_id text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  role text := public.caller_role();
  n integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if role not in ('lead', 'head', 'admin') then
    raise exception 'A reviewer recommends. An admin finalises.' using errcode = '42501';
  end if;
  update public.pending_records
    set status = 'recommended',
        recommended_by = auth.uid()::text,
        recommended_at = now(),
        recommend_note = coalesce(p_note, '')
    where id = p_id and status = 'submitted';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Only a submitted record can be recommended.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.finalize_pending_record(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if public.caller_role() is distinct from 'admin' then
    raise exception 'Only an admin can finalise.' using errcode = '42501';
  end if;
  update public.pending_records
    set status = 'final',
        finalized_by = auth.uid()::text,
        finalized_at = now()
    where id = p_id and status = 'recommended';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'A reviewer must recommend it first.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.save_quotation(text, text, text, text, bigint) from public, anon;
grant execute on function public.save_quotation(text, text, text, text, bigint) to authenticated;
revoke all on function public.recommend_pending_record(text, text) from public, anon;
grant execute on function public.recommend_pending_record(text, text) to authenticated;
revoke all on function public.finalize_pending_record(text) from public, anon;
grant execute on function public.finalize_pending_record(text) to authenticated;
