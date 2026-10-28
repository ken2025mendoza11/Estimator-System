-- Undo supabase/p31-job-order-2026-10-28.sql only.
-- Drops the job-order number table and sequence. Does not change other tables.

drop function if exists public.claim_job_order_no(text, text, text);
drop function if exists public.next_job_order_seq();
drop table if exists public.release1_job_orders;
drop sequence if exists public.release1_job_order_seq;
