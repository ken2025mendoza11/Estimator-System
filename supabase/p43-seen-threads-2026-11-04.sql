-- Additive only. Do not run on live. Review before TEST.
-- Personal NEW reads, CE threads, and in-app notifications.
-- The app keeps a JSON copy until this migration is approved.

create table if not exists public.doc_reads (
  user_id text not null,
  doc_kind text not null,
  doc_id text not null,
  seen_at timestamptz,
  primary key (user_id, doc_kind, doc_id)
);

create table if not exists public.ce_threads (
  id text primary key,
  ce_id text not null,
  participants text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.ce_thread_messages (
  id text primary key,
  thread_id text not null references public.ce_threads (id),
  from_user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id text primary key,
  to_user_id text not null,
  kind text not null,
  title text,
  body text,
  doc_kind text,
  doc_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.methodologies (
  id text primary key,
  name text not null,
  project_type text,
  body text,
  author_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.methodology_versions (
  id text primary key,
  methodology_id text not null,
  body text,
  author_id text,
  created_at timestamptz not null default now()
);

alter table public.doc_reads enable row level security;
alter table public.ce_threads enable row level security;
alter table public.ce_thread_messages enable row level security;
alter table public.app_notifications enable row level security;
alter table public.methodologies enable row level security;
alter table public.methodology_versions enable row level security;

drop policy if exists doc_reads_own on public.doc_reads;
create policy doc_reads_own on public.doc_reads
  for all to authenticated
  using (user_id = coalesce(auth.jwt() ->> 'sub', ''))
  with check (user_id = coalesce(auth.jwt() ->> 'sub', ''));

drop policy if exists ce_threads_participants on public.ce_threads;
-- ce_threads inserts are server-only (service role). Authenticated users only select a thread they are on.
create policy ce_threads_participants on public.ce_threads
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'sub', '') = any (participants));

drop policy if exists ce_thread_messages_participants on public.ce_thread_messages;
create policy ce_thread_messages_participants on public.ce_thread_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.ce_threads t
      where t.id = thread_id and coalesce(auth.jwt() ->> 'sub', '') = any (t.participants)
    )
  );

drop policy if exists ce_thread_messages_insert on public.ce_thread_messages;
create policy ce_thread_messages_insert on public.ce_thread_messages
  for insert to authenticated
  with check (
    from_user_id = coalesce(auth.jwt() ->> 'sub', '')
    and exists (
      select 1 from public.ce_threads t
      where t.id = thread_id and coalesce(auth.jwt() ->> 'sub', '') = any (t.participants)
    )
  );

drop policy if exists app_notifications_own on public.app_notifications;
create policy app_notifications_own on public.app_notifications
  for all to authenticated
  using (to_user_id = coalesce(auth.jwt() ->> 'sub', ''))
  with check (to_user_id = coalesce(auth.jwt() ->> 'sub', ''));

drop policy if exists methodologies_read on public.methodologies;
create policy methodologies_read on public.methodologies
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'department', '') in ('Estimating', 'Sales')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('lead', 'head', 'admin', 'Lead', 'Head', 'Admin')
  );

drop policy if exists methodologies_write on public.methodologies;
create policy methodologies_write on public.methodologies
  for all to authenticated
  using (
    author_id = coalesce(auth.jwt() ->> 'sub', '')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('lead', 'head', 'admin', 'Lead', 'Head', 'Admin')
  )
  with check (
    author_id = coalesce(auth.jwt() ->> 'sub', '')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('lead', 'head', 'admin', 'Lead', 'Head', 'Admin')
  );

drop policy if exists methodology_versions_read on public.methodology_versions;
create policy methodology_versions_read on public.methodology_versions
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'department', '') in ('Estimating', 'Sales')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('lead', 'head', 'admin', 'Lead', 'Head', 'Admin')
  );

drop policy if exists methodology_versions_write on public.methodology_versions;
create policy methodology_versions_write on public.methodology_versions
  for insert to authenticated
  with check (
    author_id = coalesce(auth.jwt() ->> 'sub', '')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('lead', 'head', 'admin', 'Lead', 'Head', 'Admin')
  );

create index if not exists ce_threads_ce_id_idx on public.ce_threads (ce_id);
create index if not exists ce_thread_messages_thread_id_idx on public.ce_thread_messages (thread_id);
create index if not exists app_notifications_to_user_id_idx on public.app_notifications (to_user_id);
