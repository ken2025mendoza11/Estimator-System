-- Purpose: optional mirror for a cost-estimate schedule, one row per task.
-- Step: 16 / Phase 10
-- Apply order: after supabase/p1b-access-2026-10-20.sql. Apply on the TEST project first.
-- The app ships first. The schedule lives in the cost-estimate JSON, keyed by task id.
-- This table is a mirror. If it is missing, the app keeps the JSON.
-- Does not alter public.clients or public.masterlist_items. Not applied by the app.
--
-- PASS: a row stores the task id, the working-day dates, and whether it is the baseline.
-- PASS: the app still shows the schedule when this table is missing.
-- FAIL: a column added to an existing table, or a seed of schedule rows.

create table if not exists public.ce_schedule (
  id text primary key,
  document_id text not null,
  task_id text not null,
  start_on date,
  end_on date,
  duration integer,
  is_baseline boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ce_schedule enable row level security;

drop policy if exists ce_schedule_all on public.ce_schedule;
create policy ce_schedule_all on public.ce_schedule for all to authenticated using (true) with check (true);
