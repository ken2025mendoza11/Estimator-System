-- Rollback for supabase/p2-approvals-2026-10-20.sql
-- Drops only the RESTRICTIVE signature-write policies.
-- Does not change estimator_files_select, estimator_files_insert, estimator_files_update, or estimator_files_delete.
-- Does not delete signature files.

drop policy if exists estimator_files_signatures_insert on storage.objects;
drop policy if exists estimator_files_signatures_update on storage.objects;
drop policy if exists estimator_files_signatures_delete on storage.objects;
