-- =============================================================================
-- Estimator System — full Supabase schema
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run more than once.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  role text not null default 'estimator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Companies (RCE letterhead: Company 1 / Company 2)
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_label text,
  doc_control_no text,
  revision_date date,
  customer_label text,
  item2_text text,
  sales_manager text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients (Database → Clients)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id text primary key,
  client_code text,
  full_name text not null default '',
  address text,
  extra jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_full_name_idx on public.clients (full_name);

-- ---------------------------------------------------------------------------
-- Masterlist categories + items (Database manager)
-- ---------------------------------------------------------------------------
create table if not exists public.masterlist_categories (
  id text primary key,
  category_key text not null unique,
  category_name text not null,
  is_fixed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.masterlist_items (
  id text primary key,
  category_key text not null references public.masterlist_categories (category_key) on delete cascade,
  name text,
  role text,
  description text,
  item text,
  unit text,
  daily_rate numeric,
  monthly_rate numeric,
  rate_per_day numeric,
  unit_cost numeric,
  estimated_cost numeric,
  per_diem numeric,
  allowance numeric,
  attrs jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists masterlist_items_category_idx
  on public.masterlist_items (category_key);

-- Column layout per sheet (Schema Manager)
create table if not exists public.schema_columns (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  col_key text not null,
  label text not null,
  col_type text not null default 'text',
  visible boolean not null default true,
  is_custom boolean not null default false,
  sort_order int not null default 0,
  unique (category_key, col_key)
);

-- ---------------------------------------------------------------------------
-- RCE requests (RCE form + inbox)
-- ---------------------------------------------------------------------------
create table if not exists public.rce_requests (
  id text primary key,
  company_id uuid references public.companies (id) on delete set null,
  company_name text,
  client_id text references public.clients (id) on delete set null,
  client text,
  customer text,
  address text,
  location text,
  description text,
  category text,
  project_type text,
  project_title text,
  inquiry_number text,
  inquiry_date date,
  rce_no text,
  rce_date date,
  priority_level text,
  ce_deadline date,
  submission_deadline date,
  shopwork boolean not null default false,
  onsite boolean not null default false,
  trading boolean not null default false,
  mechanical boolean not null default false,
  electrical boolean not null default false,
  other_remarks text,
  decline_reason text,
  prepared_by text,
  reviewed_by text,
  approved_by text,
  status text not null default 'Pending',
  date_received date,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rce_requests_status_idx on public.rce_requests (status);
create index if not exists rce_requests_client_idx on public.rce_requests (client_id);

create table if not exists public.rce_checklist_items (
  id uuid primary key default gen_random_uuid(),
  rce_id text not null references public.rce_requests (id) on delete cascade,
  item_key text not null,
  complete text,
  remarks text,
  unique (rce_id, item_key)
);

create table if not exists public.rce_attachments (
  id uuid primary key default gen_random_uuid(),
  rce_id text not null references public.rce_requests (id) on delete cascade,
  file_name text not null,
  storage_path text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cost estimates (dashboard list + editor)
-- ---------------------------------------------------------------------------
create table if not exists public.cost_estimates (
  id text primary key,
  rce_id text references public.rce_requests (id) on delete set null,
  client_id text references public.clients (id) on delete set null,
  client text,
  location text,
  project text,
  status text not null default 'Draft',
  last_edited date,
  last_edited_by text,
  doc_no text,
  rev_no text,
  rev_date date,
  view_type text default 'Summary',
  is_parked boolean not null default false,
  is_archived boolean not null default false,
  editing_user text,
  is_editor_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cost_estimates_status_idx on public.cost_estimates (status);
create index if not exists cost_estimates_rce_idx on public.cost_estimates (rce_id);

-- Full editor snapshot (lets current app save without rewriting screens)
create table if not exists public.ce_documents (
  ce_id text primary key references public.cost_estimates (id) on delete cascade,
  meta jsonb not null default '{}'::jsonb,
  sow_text text not null default '',
  ce_status text,
  view_type text,
  doc_no text,
  rev_no text,
  rev_date date,
  file_attachments jsonb not null default '{}'::jsonb,
  summary_task_filters jsonb not null default '{}'::jsonb,
  document jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ce_tasks (
  id text primary key,
  ce_id text not null references public.cost_estimates (id) on delete cascade,
  title text not null default '',
  notes text not null default '',
  duration numeric not null default 0,
  predecessor text,
  expanded boolean not null default true,
  sort_order int not null default 0
);

create index if not exists ce_tasks_ce_idx on public.ce_tasks (ce_id);

create table if not exists public.ce_subtasks (
  id text primary key,
  task_id text not null references public.ce_tasks (id) on delete cascade,
  title text not null default '',
  type text not null default 'Sequential',
  predecessor text,
  expanded boolean not null default true,
  sort_order int not null default 0
);

create index if not exists ce_subtasks_task_idx on public.ce_subtasks (task_id);

create table if not exists public.ce_line_items (
  id text primary key,
  subtask_id text not null references public.ce_subtasks (id) on delete cascade,
  category text not null,
  masterlist_id text,
  description text,
  role text,
  item text,
  qty numeric,
  days numeric,
  unit text,
  rate numeric,
  unit_cost numeric,
  ot_hrs numeric,
  day_type text,
  shift text,
  per_diem numeric,
  allowance numeric,
  attrs jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

create index if not exists ce_line_items_subtask_idx
  on public.ce_line_items (subtask_id, category);

create table if not exists public.ce_versions (
  id uuid primary key default gen_random_uuid(),
  ce_id text not null references public.cost_estimates (id) on delete cascade,
  version_label text,
  snapshot jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists ce_versions_ce_idx on public.ce_versions (ce_id);

create table if not exists public.ce_attachments (
  id uuid primary key default gen_random_uuid(),
  ce_id text not null references public.cost_estimates (id) on delete cascade,
  sheet_key text,
  file_name text not null,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Monitoring dashboard
-- ---------------------------------------------------------------------------
create table if not exists public.monitoring_entries (
  id uuid primary key default gen_random_uuid(),
  rce_id text references public.rce_requests (id) on delete set null,
  ce_id text references public.cost_estimates (id) on delete set null,
  company_designation text,
  department text,
  rce_no text,
  client text,
  project_desc text,
  rce_received date,
  deadline date,
  aging int,
  ce_no text,
  status text,
  remarks text,
  ce_submitted date,
  received_by text,
  award_status text,
  award_remarks text,
  recommended_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monitoring_entries_status_idx
  on public.monitoring_entries (status);

-- ---------------------------------------------------------------------------
-- Scope library (placeholder screen → real templates later)
-- ---------------------------------------------------------------------------
create table if not exists public.scope_templates (
  id text primary key,
  title text not null,
  description text,
  sow_text text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scope_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.scope_templates (id) on delete cascade,
  title text not null,
  notes text,
  sort_order int not null default 0,
  payload jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Compatibility snapshot for the current in-memory app
-- ---------------------------------------------------------------------------
create table if not exists public.estimator_workspace (
  user_id text primary key,
  ce_list jsonb not null default '[]'::jsonb,
  rce_list jsonb not null default '[]'::jsonb,
  masterlist jsonb not null default '{}'::jsonb,
  documents jsonb not null default '{}'::jsonb,
  schema_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Column widths, schema JSON dump, and other UI prefs currently in localStorage
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
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
    'rce_requests',
    'cost_estimates',
    'ce_documents',
    'monitoring_entries',
    'scope_templates',
    'estimator_workspace',
    'app_settings'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute procedure public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed: fixed database sheets
-- ---------------------------------------------------------------------------
insert into public.masterlist_categories (id, category_key, category_name, is_fixed, sort_order)
values
  ('manpower', 'manpower', 'Manpower', true, 1),
  ('equipment', 'equipment', 'Tools & Equipment', true, 2),
  ('consumables', 'consumables', 'Consumables', true, 3),
  ('ppe', 'ppe', 'Safety & PPE', true, 4),
  ('misc', 'misc', 'Miscellaneous', true, 5)
on conflict (id) do update
  set category_name = excluded.category_name,
      is_fixed = excluded.is_fixed,
      sort_order = excluded.sort_order;

insert into public.schema_columns (category_key, col_key, label, col_type, visible, is_custom, sort_order)
values
  ('manpower', 'role', 'Role / Position', 'text', true, false, 1),
  ('manpower', 'dailyRate', 'Daily Rate', 'number', true, false, 2),
  ('manpower', 'monthlyRate', 'Monthly Rate', 'number', true, false, 3),
  ('manpower', 'perDiem', 'Per Diem', 'number', true, false, 4),
  ('manpower', 'allowance', 'Allowance', 'number', true, false, 5),
  ('equipment', 'description', 'Description', 'text', true, false, 1),
  ('equipment', 'unit', 'Unit', 'text', true, false, 2),
  ('equipment', 'ratePerDay', 'Daily Rate', 'number', true, false, 3),
  ('consumables', 'description', 'Description', 'text', true, false, 1),
  ('consumables', 'unit', 'Unit', 'text', true, false, 2),
  ('consumables', 'unitCost', 'Unit Cost', 'number', true, false, 3),
  ('ppe', 'item', 'Description', 'text', true, false, 1),
  ('ppe', 'unit', 'Unit', 'text', true, false, 2),
  ('ppe', 'unitCost', 'Unit Cost', 'number', true, false, 3),
  ('misc', 'description', 'Description', 'text', true, false, 1),
  ('misc', 'estimatedCost', 'Estimated Cost', 'number', true, false, 2),
  ('clients', 'clientCode', 'Client Code', 'text', true, false, 1),
  ('clients', 'fullName', 'Full Name', 'text', true, false, 2),
  ('clients', 'address', 'Address', 'text', true, false, 3)
on conflict (category_key, col_key) do update
  set label = excluded.label,
      col_type = excluded.col_type,
      sort_order = excluded.sort_order;

insert into public.companies (
  name, logo_label, doc_control_no, revision_date, customer_label, item2_text, sales_manager, address
)
values
  (
    'Company 1',
    '🏭',
    'DC-001-2024',
    '2024-08-15',
    'ABBRE - FULL NAME (CL1 - CLIENT 1)',
    'IN-LINE WITH COMPANY 1 PRODUCTS AND SERVICES',
    'Juan Dela Cruz',
    '123 Main St, Makati City'
  ),
  (
    'Company 2',
    '🏢',
    'DC-002-2024',
    '2024-09-01',
    'ABBRE2 - FULL NAME (CL2 - CLIENT 2)',
    'IN-LINE WITH COMPANY 2 PRODUCTS AND SERVICES',
    'Maria Santos',
    '456 Second Ave, Quezon City'
  )
on conflict (name) do nothing;

insert into public.scope_templates (id, title, description)
values
  ('tpl-1', 'Standard Onsite', 'Typical site-based cost estimate structure.'),
  ('tpl-2', 'Shop', 'Workshop / fabrication oriented breakdown.'),
  ('tpl-3', 'Hybrid', 'Mix of onsite and shop tasks.'),
  ('tpl-4', 'Trading', 'Trading / resale cost model.')
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — signed-in team can use every table.
-- Tighten later (roles, per-row ownership) without changing the app.
-- ---------------------------------------------------------------------------
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
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists team_select on public.%I', t);
    execute format('drop policy if exists team_insert on public.%I', t);
    execute format('drop policy if exists team_update on public.%I', t);
    execute format('drop policy if exists team_delete on public.%I', t);
    execute format('create policy team_select on public.%I for select to authenticated using (true)', t);
    execute format('create policy team_insert on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy team_update on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('create policy team_delete on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets for RCE / CE files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('rce-attachments', 'rce-attachments', false),
  ('ce-attachments', 'ce-attachments', false)
on conflict (id) do nothing;

drop policy if exists rce_attachments_select on storage.objects;
drop policy if exists rce_attachments_insert on storage.objects;
drop policy if exists rce_attachments_update on storage.objects;
drop policy if exists rce_attachments_delete on storage.objects;
drop policy if exists ce_attachments_select on storage.objects;
drop policy if exists ce_attachments_insert on storage.objects;
drop policy if exists ce_attachments_update on storage.objects;
drop policy if exists ce_attachments_delete on storage.objects;

create policy rce_attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'rce-attachments');
create policy rce_attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rce-attachments');
create policy rce_attachments_update on storage.objects
  for update to authenticated
  using (bucket_id = 'rce-attachments')
  with check (bucket_id = 'rce-attachments');
create policy rce_attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'rce-attachments');

create policy ce_attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'ce-attachments');
create policy ce_attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ce-attachments');
create policy ce_attachments_update on storage.objects
  for update to authenticated
  using (bucket_id = 'ce-attachments')
  with check (bucket_id = 'ce-attachments');
create policy ce_attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ce-attachments');
