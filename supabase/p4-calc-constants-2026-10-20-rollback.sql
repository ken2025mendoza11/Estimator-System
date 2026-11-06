-- Rollback for supabase/p4-calc-constants-2026-10-20.sql
-- Step: 7 / Phase 4
-- Drops only the calculator-constants table and its two functions.
-- Does not delete documents, roles, or cost estimates.
-- Apply on the TEST project first.

drop function if exists public.save_calc_constants(jsonb);
drop function if exists public.get_calc_constants();
drop table if exists public.calc_constants;
