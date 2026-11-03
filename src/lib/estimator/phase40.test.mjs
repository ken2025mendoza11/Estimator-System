import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../../../", import.meta.url);
/** @param {string} path */
const text = (path) => readFileSync(new URL(path, root), "utf8");

test("p40 renames the year_key variables and does not update a taken job order", () => {
	const sql = text("supabase/p40-numbering-2026-11-03.sql");
	const counters = sql.slice(sql.indexOf("function public.release1_advance_sample_counters"), sql.indexOf("revoke all on function public.release1_advance_sample_counters"));
	const year = sql.slice(sql.indexOf("function public.next_job_order_seq_for_year"), sql.indexOf("revoke all on function public.next_job_order_seq_for_year"));
	const claim = sql.slice(sql.indexOf("function public.claim_job_order_no"), sql.indexOf("revoke all on function public.claim_job_order_no"));
	assert.match(counters, /v_year_key/);
	assert.match(counters, /v_proposal_at/);
	assert.match(counters, /v_jo_at/);
	assert.equal(/(^|[^A-Za-z0-9_])year_key text/.test(counters), false);
	assert.match(year, /v_year_key/);
	assert.equal(/(^|[^A-Za-z0-9_])year_key text/.test(year), false);
	assert.equal(/on conflict \(jo_no\) do update/i.test(claim), false);
	assert.match(claim, /JO number already used/);
	assert.equal(sql.includes("grant execute on function public.release1_advance_sample_counters(integer, text, integer) to authenticated"), false);
	assert.match(sql, /release1_advance_sample_counters\(integer, text, integer\) to service_role/);
	assert.equal(sql.includes("delete from public.workspace_docs"), false);
});

test("the browser no longer numbers RCE, CE, or OIF itself", () => {
	const app = text("src/components/CostEstimatorApp.jsx");
	const staff = text("src/components/staffModules.jsx");
	const panel = text("src/components/MarkupPanel.jsx");
	assert.equal(app.includes("function nextDocNo"), false);
	assert.equal(app.includes("function nextCeNoForCompany"), false);
	assert.equal(app.includes("return fallback()"), false);
	assert.equal(staff.includes("function nextDocNo"), false);
	assert.equal(staff.includes("max + 1"), false);
	assert.match(app, /DOC_NUMBER_RETRY/);
	assert.match(text("src/lib/estimator/docNumbers.js"), /Couldn't get a number, try again/);
	assert.match(panel, /markup\.markupNo/);
});

test("sample counters keep the greater value, allocations differ, and a duplicate does not overwrite", async () => {
	const db = new PGlite();
	await db.exec(`
		create schema if not exists auth;
		do $$ begin
		  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
		  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
		  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
		end $$;
		create or replace function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;
		create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
		create sequence public.release1_proposal_control_seq;
		create table public.release1_job_order_year (
		  year_key text primary key,
		  last_seq integer not null default 0
		);
		create table public.release1_job_orders (
		  jo_no text primary key,
		  proposal_control text not null default '',
		  ce_ids text not null default '',
		  updated_at timestamptz not null default now()
		);
		create table public.workspace_docs (
		  kind text not null,
		  doc_id text not null,
		  payload jsonb not null default '{}'::jsonb,
		  version bigint not null default 1,
		  ord integer not null default 0,
		  updated_at timestamptz not null default now(),
		  deleted_at timestamptz,
		  primary key (kind, doc_id)
		);
		create table public.rce_requests (
		  id text primary key,
		  rce_no text
		);
		create table public.doc_counters (
		  kind text not null,
		  company text not null default '',
		  year integer not null,
		  last_no integer not null default 0,
		  primary key (kind, company, year)
		);
	`);
	await db.exec(text("supabase/p40-numbering-2026-11-03.sql"));
	await db.exec(text("supabase/p40b-unique-doc-numbers-2026-11-03.sql"));
	const numbering = text("supabase/p1a-numbering-2026-10-20.sql");
	const start = numbering.indexOf("create or replace function public.next_doc_no");
	const end = numbering.indexOf("revoke all on function public.next_doc_no");
	await db.exec(numbering.slice(start, end));

	const first = await db.query("select public.release1_advance_sample_counters(10, '2026', 4) as body");
	const lower = await db.query("select public.release1_advance_sample_counters(3, '2026', 2) as body");
	const higher = await db.query("select public.release1_advance_sample_counters(12, '2026', 9) as body");
	assert.equal(first.rows[0].body.ok, true);
	assert.equal(lower.rows[0].body.ok, true);
	assert.equal(higher.rows[0].body.ok, true);
	const year = await db.query("select last_seq from public.release1_job_order_year where year_key = '26'");
	assert.equal(year.rows[0].last_seq, 9);
	const proposal = await db.query("select last_value from public.release1_proposal_control_seq");
	assert.equal(Number(proposal.rows[0].last_value), 12);

	const one = await db.query("select public.next_doc_no('rce', '', 2026) as n");
	const two = await db.query("select public.next_doc_no('rce', '', 2026) as n");
	assert.equal(one.rows[0].n, "RCE-2026-001");
	assert.equal(two.rows[0].n, "RCE-2026-002");
	assert.notEqual(one.rows[0].n, two.rows[0].n);

	const claimed = await db.query("select public.claim_job_order_no('JO-001-SW-AB-26-0001', '0001', 'CE-1') as body");
	const taken = await db.query("select public.claim_job_order_no('JO-001-SW-AB-26-0001', '9999', 'CE-9') as body");
	assert.equal(claimed.rows[0].body.ok, true);
	assert.equal(taken.rows[0].body.ok, false);
	assert.equal(taken.rows[0].body.reason, "JO number already used");
	const kept = await db.query("select proposal_control from public.release1_job_orders where jo_no = 'JO-001-SW-AB-26-0001'");
	assert.equal(kept.rows[0].proposal_control, "0001");

	await db.query("insert into public.workspace_docs (kind, doc_id, payload) values ('rce', 'RCE-2026-001', '{\"rceNo\":\"RCE-2026-001\"}'::jsonb)");
	await assert.rejects(
		() => db.query("insert into public.workspace_docs (kind, doc_id, payload) values ('rce', 'RCE-2026-009', '{\"rceNo\":\"RCE-2026-001\"}'::jsonb)"),
		/already used|duplicate key/i,
	);
	const stored = await db.query("select count(*)::int as n, max(payload->>'rceNo') as num from public.workspace_docs where kind = 'rce'");
	assert.equal(stored.rows[0].n, 1);
	assert.equal(stored.rows[0].num, "RCE-2026-001");
	await db.close();
});
