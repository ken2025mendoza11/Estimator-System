-- Undo p40b-unique-doc-numbers-2026-11-03.sql. Does not delete documents.

drop trigger if exists workspace_doc_number_block on public.workspace_docs;
drop function if exists public.workspace_doc_number_block();
drop index if exists public.workspace_docs_rce_doc_id_uidx;
drop index if exists public.workspace_docs_ce_doc_id_uidx;
drop index if exists public.workspace_docs_oif_doc_id_uidx;
drop index if exists public.workspace_docs_markup_doc_id_uidx;
drop index if exists public.workspace_docs_rce_no_uidx;
drop index if exists public.workspace_docs_ce_no_uidx;
drop index if exists public.workspace_docs_oif_no_uidx;
drop index if exists public.workspace_docs_markup_no_uidx;
drop index if exists public.rce_requests_rce_no_uidx;
drop function if exists public.workspace_doc_number_text(text, text, jsonb);
