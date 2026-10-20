-- Purpose: versioned EL calculator constants.
-- Step: 7 / Phase 4
-- Apply order: after supabase/p1b-access-2026-10-20.sql. Apply on the TEST project first.
-- App code ships first. If this table is missing, the app uses adminConfig.calcConstants, then the built-in defaults.
-- Does not change save_workspace_doc. Never deletes documents.

create table if not exists public.calc_constants (
  version integer primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint calc_constants_version_positive check (version > 0)
);

alter table public.calc_constants enable row level security;

drop policy if exists calc_constants_read on public.calc_constants;
create policy calc_constants_read on public.calc_constants
  for select to authenticated
  using (true);

revoke all on table public.calc_constants from public, anon, authenticated;
grant select on table public.calc_constants to authenticated;

create or replace function public.get_calc_constants()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  found_row public.calc_constants%rowtype;
begin
  if to_regclass('public.calc_constants') is null then
    return null;
  end if;
  select * into found_row
  from public.calc_constants
  order by version desc
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object('version', found_row.version, 'payload', found_row.payload);
end;
$$;

create or replace function public.save_calc_constants(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'You must be signed in.');
  end if;
  if to_regprocedure('public.is_admin()') is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'Only an admin can change calculator constants.');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'Constants must be an object.');
  end if;
  select coalesce(max(version), 0) + 1 into next_version from public.calc_constants;
  insert into public.calc_constants (version, payload) values (next_version, p_payload);
  return jsonb_build_object('ok', true, 'version', next_version);
end;
$$;

revoke all on function public.get_calc_constants() from public, anon;
revoke all on function public.save_calc_constants(jsonb) from public, anon;
grant execute on function public.get_calc_constants() to authenticated;
grant execute on function public.save_calc_constants(jsonb) to authenticated;

do $$
begin
  if to_regclass('public.calc_constants') is null then
    raise exception 'FAIL: calc_constants missing';
  end if;
  if to_regprocedure('public.get_calc_constants()') is null then
    raise exception 'FAIL: get_calc_constants missing';
  end if;
  if to_regprocedure('public.save_calc_constants(jsonb)') is null then
    raise exception 'FAIL: save_calc_constants missing';
  end if;
  raise notice 'PASS: calc_constants version table';
end $$;
