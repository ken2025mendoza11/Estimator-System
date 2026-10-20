-- Purpose: keep signature writes on the signer's own object. Reads stay open.
-- Step: 10 / Phase 2c
-- Apply order: after supabase/0003_document_safety.sql. Apply on the TEST project first.
-- Additive only. Does not drop or replace estimator_files_select, estimator_files_insert,
-- estimator_files_update, or estimator_files_delete. Those still let any signed-in user
-- read and write every other path in the bucket, including reading signatures/*.
-- The new policies are RESTRICTIVE, so a write under signatures/ must also be
-- signatures/<auth.uid>.png. auth.uid() is stableUserUuid(user id).
-- App code ships first. If these policies are missing, the old open policies still apply.
-- Does not change save_workspace_doc. Does not delete files.

insert into storage.buckets (id, name, public)
values ('estimator-files', 'estimator-files', false)
on conflict (id) do update set public = false;

drop policy if exists estimator_files_signatures_insert on storage.objects;
drop policy if exists estimator_files_signatures_update on storage.objects;
drop policy if exists estimator_files_signatures_delete on storage.objects;

create policy estimator_files_signatures_insert on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    coalesce(bucket_id, '') <> 'estimator-files'
    or coalesce(name, '') not like 'signatures/%'
    or name = 'signatures/' || auth.uid()::text || '.png'
  );

create policy estimator_files_signatures_update on storage.objects
  as restrictive
  for update
  to authenticated
  using (
    coalesce(bucket_id, '') <> 'estimator-files'
    or coalesce(name, '') not like 'signatures/%'
    or name = 'signatures/' || auth.uid()::text || '.png'
  )
  with check (
    coalesce(bucket_id, '') <> 'estimator-files'
    or coalesce(name, '') not like 'signatures/%'
    or name = 'signatures/' || auth.uid()::text || '.png'
  );

create policy estimator_files_signatures_delete on storage.objects
  as restrictive
  for delete
  to authenticated
  using (
    coalesce(bucket_id, '') <> 'estimator-files'
    or coalesce(name, '') not like 'signatures/%'
    or name = 'signatures/' || auth.uid()::text || '.png'
  );

-- PASS: estimator_files_select, estimator_files_insert, estimator_files_update, and estimator_files_delete
--       are still the open policies. A signed-in user can read signatures/<someone else>.png.
--       estimator_files_signatures_insert, estimator_files_signatures_update, and estimator_files_signatures_delete
--       are RESTRICTIVE and allow a write of signatures/<auth.uid>.png only.
-- FAIL: one of the four estimator_files_* policies was dropped, a signed-in user can write
--       signatures/<someone else>.png, or a signed-in user cannot read another user's signature.
