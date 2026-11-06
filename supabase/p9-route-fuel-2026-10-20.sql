-- Purpose: optional mirrors for vehicles, regional fuel prices, and admin tolls.
-- Step: 15 / Phase 9
-- Apply order: after supabase/p1b-access-2026-10-20.sql. Apply on the TEST project first.
-- The app ships first. Vehicles, prices, and tolls live in admin JSON. These tables are a mirror.
-- If they are missing, the calculator still uses the JSON. A typed distance is used when the road service does not answer.
-- Does not alter public.clients or public.masterlist_items. Not applied by the app.
--
-- PASS: a vehicle row stores km per litre and a truck flag. A fuel price is a region and a price per litre.
-- PASS: the app still prices a route when these tables are missing.
-- FAIL: a column added to an existing table, or a seed of vehicles or prices.

create table if not exists public.vehicles (
  id text primary key,
  name text not null default '',
  km_per_l numeric not null,
  is_truck boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_prices (
  id text primary key,
  region text not null default '',
  price_per_liter numeric not null,
  effective_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.route_tolls (
  id text primary key,
  name text not null default '',
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;
alter table public.fuel_prices enable row level security;
alter table public.route_tolls enable row level security;

drop policy if exists vehicles_all on public.vehicles;
create policy vehicles_all on public.vehicles for all to authenticated using (true) with check (true);
drop policy if exists fuel_prices_all on public.fuel_prices;
create policy fuel_prices_all on public.fuel_prices for all to authenticated using (true) with check (true);
drop policy if exists route_tolls_all on public.route_tolls;
create policy route_tolls_all on public.route_tolls for all to authenticated using (true) with check (true);
