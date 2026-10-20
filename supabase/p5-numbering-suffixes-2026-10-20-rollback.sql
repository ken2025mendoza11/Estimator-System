-- Rollback for supabase/p5-numbering-suffixes-2026-10-20.sql
-- Step: 11 / Phase 5
-- Drops only next_ce_suffix and ce_suffix_alloc.
-- Does not drop next_doc_no. Does not drop estimator_files policies.
-- Apply on the TEST project first.

drop function if exists public.next_ce_suffix(text, text, text, boolean, text);
drop table if exists public.ce_suffix_alloc;
