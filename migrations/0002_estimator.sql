-- Per-user estimator workspace. JSON columns hold the existing in-memory
-- document shapes (CE list, RCE list, masterlist, open documents) so we can
-- persist without rewriting the estimator UI.
create table if not exists estimator_workspace (
  user_id text primary key,
  ce_list jsonb not null default '[]'::jsonb,
  rce_list jsonb not null default '[]'::jsonb,
  masterlist jsonb not null default '{}'::jsonb,
  documents jsonb not null default '{}'::jsonb,
  schema_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
