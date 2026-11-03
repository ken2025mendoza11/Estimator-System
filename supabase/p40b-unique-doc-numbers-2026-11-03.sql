-- Step 40b. Apply after p40-numbering-2026-11-03.sql. Do not run this from the app.
-- Review before applying. Do not run on the live project.
-- Read-only duplicate check first. If any count below is not zero, stop.
-- Do not delete the duplicates. Ask before changing stored numbers.
--   select lower(coalesce(nullif(payload->>'rceNo',''), doc_id)) as num, count(*)
--     from public.workspace_docs where kind = 'rce' and deleted_at is null
--     group by 1 having count(*) > 1;
--   select lower(coalesce(nullif(payload->>'oifNo',''), doc_id)) as num, count(*)
--     from public.workspace_docs where kind = 'inspection' and deleted_at is null
--     group by 1 having count(*) > 1;
--   select lower(coalesce(nullif(payload #>> '{document,projectInfo,docNo}', ''), nullif(payload->>'ceNo',''), nullif(payload #>> '{summary,docNo}',''), doc_id)) as num, count(*)
--     from public.workspace_docs where kind = 'ce' and deleted_at is null
--     group by 1 having count(*) > 1;
--   select lower(coalesce(nullif(payload->>'markupNo',''), doc_id)) as num, count(*)
--     from public.workspace_docs where kind = 'markup' and deleted_at is null
--     group by 1 having count(*) > 1;
--   select lower(rce_no) as num, count(*) from public.rce_requests
--     where coalesce(rce_no, '') <> '' group by 1 having count(*) > 1;
-- This file does not delete rows. It refuses a second document with the same number.

create or replace function public.workspace_doc_number_text(p_kind text, p_doc_id text, p_payload jsonb)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(
    case
      when p_kind = 'rce' then nullif(p_payload->>'rceNo', '')
      when p_kind = 'inspection' then nullif(p_payload->>'oifNo', '')
      when p_kind = 'markup' then nullif(p_payload->>'markupNo', '')
      when p_kind = 'ce' then coalesce(
        nullif(p_payload #>> '{document,projectInfo,docNo}', ''),
        nullif(p_payload->>'ceNo', ''),
        nullif(p_payload #>> '{summary,docNo}', '')
      )
      else null
    end,
    nullif(p_doc_id, ''),
    ''
  )));
$$;

revoke all on function public.workspace_doc_number_text(text, text, jsonb) from public, anon;
grant execute on function public.workspace_doc_number_text(text, text, jsonb) to authenticated;

do $$
declare
  v_rce integer;
  v_ce integer;
  v_oif integer;
  v_markup integer;
  v_rce_table integer;
begin
  select count(*) into v_rce from (
    select public.workspace_doc_number_text(kind, doc_id, payload) as num
    from public.workspace_docs
    where kind = 'rce' and deleted_at is null
    group by 1 having count(*) > 1
  ) d;
  select count(*) into v_ce from (
    select public.workspace_doc_number_text(kind, doc_id, payload) as num
    from public.workspace_docs
    where kind = 'ce' and deleted_at is null
    group by 1 having count(*) > 1
  ) d;
  select count(*) into v_oif from (
    select public.workspace_doc_number_text(kind, doc_id, payload) as num
    from public.workspace_docs
    where kind = 'inspection' and deleted_at is null
    group by 1 having count(*) > 1
  ) d;
  select count(*) into v_markup from (
    select public.workspace_doc_number_text(kind, doc_id, payload) as num
    from public.workspace_docs
    where kind = 'markup' and deleted_at is null
    group by 1 having count(*) > 1
  ) d;
  select count(*) into v_rce_table from (
    select lower(rce_no) as num
    from public.rce_requests
    where coalesce(rce_no, '') <> ''
    group by 1 having count(*) > 1
  ) d;
  if v_rce + v_ce + v_oif + v_markup + v_rce_table > 0 then
    raise exception 'Duplicate document numbers exist (rce %, ce %, oif %, markup %, rce_requests %). Do not delete them. Review before creating unique indexes.',
      v_rce, v_ce, v_oif, v_markup, v_rce_table;
  end if;
end;
$$;

create unique index if not exists workspace_docs_rce_doc_id_uidx
  on public.workspace_docs (lower(doc_id))
  where kind = 'rce' and deleted_at is null;

create unique index if not exists workspace_docs_ce_doc_id_uidx
  on public.workspace_docs (lower(doc_id))
  where kind = 'ce' and deleted_at is null;

create unique index if not exists workspace_docs_oif_doc_id_uidx
  on public.workspace_docs (lower(doc_id))
  where kind = 'inspection' and deleted_at is null;

create unique index if not exists workspace_docs_markup_doc_id_uidx
  on public.workspace_docs (lower(doc_id))
  where kind = 'markup' and deleted_at is null;

create unique index if not exists workspace_docs_rce_no_uidx
  on public.workspace_docs (public.workspace_doc_number_text(kind, doc_id, payload))
  where kind = 'rce' and deleted_at is null;

create unique index if not exists workspace_docs_ce_no_uidx
  on public.workspace_docs (public.workspace_doc_number_text(kind, doc_id, payload))
  where kind = 'ce' and deleted_at is null;

create unique index if not exists workspace_docs_oif_no_uidx
  on public.workspace_docs (public.workspace_doc_number_text(kind, doc_id, payload))
  where kind = 'inspection' and deleted_at is null;

create unique index if not exists workspace_docs_markup_no_uidx
  on public.workspace_docs (public.workspace_doc_number_text(kind, doc_id, payload))
  where kind = 'markup' and deleted_at is null;

create unique index if not exists rce_requests_rce_no_uidx
  on public.rce_requests (lower(rce_no))
  where coalesce(rce_no, '') <> '';

create or replace function public.workspace_doc_number_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if new.kind not in ('rce', 'ce', 'inspection', 'markup') then
    return new;
  end if;
  v_number := public.workspace_doc_number_text(new.kind, new.doc_id, new.payload);
  if v_number = '' then
    return new;
  end if;
  if exists (
    select 1 from public.workspace_docs as doc
    where doc.kind = new.kind
      and doc.doc_id <> new.doc_id
      and doc.deleted_at is null
      and (
        lower(doc.doc_id) = v_number
        or public.workspace_doc_number_text(doc.kind, doc.doc_id, doc.payload) = v_number
      )
  ) then
    raise exception 'That number is already used.' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function public.workspace_doc_number_block() from public, anon, authenticated;

drop trigger if exists workspace_doc_number_block on public.workspace_docs;
create trigger workspace_doc_number_block
  before insert or update on public.workspace_docs
  for each row execute function public.workspace_doc_number_block();
