-- Required so the current no-login app can read/write with the publishable key.
-- Paste into SQL Editor → Run once.

grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to anon;
alter default privileges in schema public grant usage, select on sequences to anon;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'companies',
    'clients',
    'masterlist_categories',
    'masterlist_items',
    'schema_columns',
    'rce_requests',
    'rce_checklist_items',
    'rce_attachments',
    'cost_estimates',
    'ce_documents',
    'ce_tasks',
    'ce_subtasks',
    'ce_line_items',
    'ce_versions',
    'ce_attachments',
    'monitoring_entries',
    'scope_templates',
    'scope_template_tasks',
    'estimator_workspace',
    'app_settings'
  ]
  loop
    execute format('drop policy if exists anon_all on public.%I', t);
    execute format(
      'create policy anon_all on public.%I for all to anon using (true) with check (true)',
      t
    );
  end loop;
end $$;
