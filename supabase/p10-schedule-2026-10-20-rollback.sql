-- Rollback for supabase/p10-schedule-2026-10-20.sql
-- Step: 16 / Phase 10
-- Drops only the Phase 10 table.
-- Does not alter public.clients or public.masterlist_items.
-- Apply on the TEST project first.

drop table if exists public.ce_schedule;
