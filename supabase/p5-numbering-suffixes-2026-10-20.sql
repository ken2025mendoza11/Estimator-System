-- Purpose: atomic alternate, addendum, and update-copy numbers for one CE family.
-- Step: 11 / Phase 5
-- Apply order: after supabase/p1a-numbering-2026-10-20.sql. Apply on the TEST project first.
-- The app ships first. If next_ce_suffix is missing, the app scans the numbers it already has.
-- Does not replace next_doc_no. Does not drop or replace estimator_files_* policies.
-- Never deletes documents. Not applied by the app.
--
-- PASS: two signed-in sessions asking for an alternate receive different letters A then B.
-- PASS: an addendum with p_awarded false is refused. An awarded original returns {base}-AD1. Alternate B returns {base}-B-AD1.
-- PASS: an update copy returns {stem}-U1 and does not change the serial.
-- FAIL: a second caller receiving the same letter, a CE-M number, or next_doc_no being replaced.

create table if not exists public.ce_suffix_alloc (
  family_key text not null,
  kind text not null,
  stem text not null,
  slot text not null,
  issued text not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (family_key, kind, stem, slot),
  constraint ce_suffix_alloc_kind check (kind in ('alt', 'ad', 'upd'))
);

alter table public.ce_suffix_alloc enable row level security;

drop policy if exists ce_suffix_alloc_select on public.ce_suffix_alloc;
create policy ce_suffix_alloc_select
  on public.ce_suffix_alloc
  for select
  to authenticated
  using (true);

create or replace function public.next_ce_suffix(
  p_base text,
  p_kind text,
  p_stem text,
  p_awarded boolean,
  p_reason text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  family text;
  stem text;
  root text;
  stem_text text;
  letter text;
  n integer;
  issued text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  root := trim(coalesce(p_base, ''));
  family := upper(root);
  if family = '' or family like 'CE-M%' then
    raise exception 'Missing the original number.' using errcode = '22023';
  end if;

  stem_text := trim(coalesce(nullif(p_stem, ''), root));
  stem := upper(stem_text);
  perform pg_advisory_xact_lock(hashtext('ce-suffix:' || family || ':' || coalesce(p_kind, '') || ':' || stem));

  if p_kind = 'alt' then
    if length(trim(coalesce(p_reason, ''))) = 0 then
      raise exception 'A reason is required.' using errcode = '22023';
    end if;
    foreach letter in array array['A','B','C','D'] loop
      if exists (
        select 1 from public.ce_suffix_alloc a
        where a.family_key = family and a.kind = 'alt' and a.stem = family and a.slot = letter
      ) then
        continue;
      end if;
      if to_regclass('public.workspace_docs') is not null and exists (
        select 1 from public.workspace_docs w
        where w.kind = 'ce'
          and w.deleted_at is null
          and upper(w.doc_id) ~ ('^' || family || '-' || letter || '($|-)')
      ) then
        continue;
      end if;
      issued := root || '-' || letter;
      insert into public.ce_suffix_alloc(family_key, kind, stem, slot, issued, reason)
      values (family, 'alt', family, letter, issued, trim(p_reason));
      return issued;
    end loop;
    raise exception 'Alternates A to D are already used.' using errcode = '23505';
  elsif p_kind = 'ad' then
    if coalesce(p_awarded, false) is not true then
      raise exception 'An addendum is only allowed when the estimate is Awarded.' using errcode = '22023';
    end if;
    select coalesce(max(a.slot::integer), 0) into n
    from public.ce_suffix_alloc a
    where a.family_key = family and a.kind = 'ad' and a.stem = stem;
    if to_regclass('public.workspace_docs') is not null then
      select greatest(n, coalesce(max((substring(upper(w.doc_id) from '-AD([0-9]+)'))::integer), 0)) into n
      from public.workspace_docs w
      where w.kind = 'ce'
        and w.deleted_at is null
        and upper(w.doc_id) like stem || '-AD%';
    end if;
    n := coalesce(n, 0) + 1;
    issued := stem_text || '-AD' || n::text;
    insert into public.ce_suffix_alloc(family_key, kind, stem, slot, issued, reason)
    values (family, 'ad', stem, n::text, issued, coalesce(trim(p_reason), ''));
    return issued;
  elsif p_kind = 'upd' then
    select coalesce(max(a.slot::integer), 0) into n
    from public.ce_suffix_alloc a
    where a.family_key = family and a.kind = 'upd' and a.stem = stem;
    if to_regclass('public.workspace_docs') is not null then
      select greatest(n, coalesce(max((substring(upper(w.doc_id) from '-U([0-9]+)'))::integer), 0)) into n
      from public.workspace_docs w
      where w.kind = 'ce'
        and w.deleted_at is null
        and upper(w.doc_id) like stem || '-U%';
    end if;
    n := coalesce(n, 0) + 1;
    issued := stem_text || '-U' || n::text;
    insert into public.ce_suffix_alloc(family_key, kind, stem, slot, issued, reason)
    values (family, 'upd', stem, n::text, issued, coalesce(trim(p_reason), ''));
    return issued;
  else
    raise exception 'Unknown suffix kind.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.next_ce_suffix(text, text, text, boolean, text) from public;
grant execute on function public.next_ce_suffix(text, text, text, boolean, text) to authenticated;
