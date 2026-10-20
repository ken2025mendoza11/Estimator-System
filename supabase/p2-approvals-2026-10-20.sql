-- Purpose: own-path policy for signature images in the private estimator-files bucket.
-- Step: 10 / Phase 2c
-- Apply order: after supabase/p1b-access-2026-10-20.sql. Apply on the TEST project first.
-- App code ships first. If this policy is missing, a signature upload fails and the PDF uses the bundled script font.
-- Does not change save_workspace_doc. Other files in the bucket stay open to every signed-in user.

insert into storage.buckets (id, name, public)
values ('estimator-files', 'estimator-files', false)
on conflict (id) do update set public = false;

drop policy if exists estimator_files_select on storage.objects;
drop policy if exists estimator_files_insert on storage.objects;
drop policy if exists estimator_files_update on storage.objects;
drop policy if exists estimator_files_delete on storage.objects;

create policy estimator_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'estimator-files'
    and (
      name not like 'signatures/%'
      or name = 'signatures/' || auth.uid()::text || '.png'
    )
  );

create policy estimator_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'estimator-files'
    and (
      name not like 'signatures/%'
      or name = 'signatures/' || auth.uid()::text || '.png'
    )
  );

create policy estimator_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'estimator-files'
    and (
      name not like 'signatures/%'
      or name = 'signatures/' || auth.uid()::text || '.png'
    )
  )
  with check (
    bucket_id = 'estimator-files'
    and (
      name not like 'signatures/%'
      or name = 'signatures/' || auth.uid()::text || '.png'
    )
  );

create policy estimator_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'estimator-files'
    and (
      name not like 'signatures/%'
      or name = 'signatures/' || auth.uid()::text || '.png'
    )
  );

-- PASS: estimator_files_select, estimator_files_insert, estimator_files_update, and estimator_files_delete exist,
--       and each one allows signatures/<auth.uid>.png only.
-- FAIL: a signed-in user can read or write signatures/<someone else>.png, or the bucket is public.
