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

alter table public.doc_reads enable row level security;
alter table public.ce_threads enable row level security;
alter table public.ce_thread_messages enable row level security;
alter table public.app_notifications enable row level security;
alter table public.methodologies enable row level security;

create policy doc_reads_own on public.doc_reads
  for all using (user_id = coalesce(auth.jwt() ->> 'sub', ''))
  with check (user_id = coalesce(auth.jwt() ->> 'sub', ''));

create policy ce_threads_participants on public.ce_threads
  for select using (coalesce(auth.jwt() ->> 'sub', '') = any (participants));

create policy ce_thread_messages_participants on public.ce_thread_messages
  for select using (
    exists (
      select 1 from public.ce_threads t
      where t.id = thread_id and coalesce(auth.jwt() ->> 'sub', '') = any (t.participants)
    )
  );

create policy app_notifications_own on public.app_notifications
  for all using (to_user_id = coalesce(auth.jwt() ->> 'sub', ''))
  with check (to_user_id = coalesce(auth.jwt() ->> 'sub', ''));

create policy methodologies_read on public.methodologies
  for select using (true);
