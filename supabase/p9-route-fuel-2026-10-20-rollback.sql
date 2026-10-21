-- Rollback for supabase/p9-route-fuel-2026-10-20.sql
-- Step: 15 / Phase 9
-- Drops only the Phase 9 tables.
-- Does not alter public.clients or public.masterlist_items.
-- Apply on the TEST project first.

drop table if exists public.route_tolls;
drop table if exists public.fuel_prices;
drop table if exists public.vehicles;
