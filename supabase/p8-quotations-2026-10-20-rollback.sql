-- Rollback for supabase/p8-quotations-2026-10-20.sql
-- Step: 14 / Phase 8
-- Drops only the Phase 8 functions and tables.
-- Does not alter public.clients or public.masterlist_items.
-- Apply on the TEST project first.

drop function if exists public.finalize_pending_record(text);
drop function if exists public.recommend_pending_record(text, text);
drop function if exists public.save_quotation(text, text, text, text, bigint);
drop table if exists public.document_quotations;
drop table if exists public.quotation_lines;
drop table if exists public.pending_records;
drop table if exists public.client_locations;
drop table if exists public.quotations;
