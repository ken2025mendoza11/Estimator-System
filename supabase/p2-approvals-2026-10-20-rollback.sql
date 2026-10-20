-- Rollback for supabase/p2-approvals-2026-10-20.sql
-- Restores the previous estimator-files policies: any signed-in user, any path in the bucket.
-- Does not delete signature files. Apply only if the own-path policy must be undone.

drop policy if exists estimator_files_select on storage.objects;
drop policy if exists estimator_files_insert on storage.objects;
drop policy if exists estimator_files_update on storage.objects;
drop policy if exists estimator_files_delete on storage.objects;

create policy estimator_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'estimator-files');
create policy estimator_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'estimator-files');
create policy estimator_files_update on storage.objects
  for update to authenticated
  using (bucket_id = 'estimator-files')
  with check (bucket_id = 'estimator-files');
create policy estimator_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'estimator-files');
