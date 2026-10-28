-- Undo supabase/p30-proposal-2026-10-28.sql only.
-- Removes proposal documents so the old kind check can be restored. Does not change other kinds.

drop function if exists public.claim_proposal_pr(text, text, text);
drop function if exists public.next_proposal_control_no();
drop table if exists public.release1_proposals;
drop sequence if exists public.release1_proposal_control_seq;

delete from public.workspace_docs where kind = 'proposal';

alter table public.workspace_docs drop constraint if exists workspace_docs_kind_chk;

alter table public.workspace_docs add constraint workspace_docs_kind_chk check (kind in (
  'ce', 'rce', 'inspection', 'task', 'scope',
  'masterlist', 'admin', 'schema', 'notifications', 'wipes'
));
