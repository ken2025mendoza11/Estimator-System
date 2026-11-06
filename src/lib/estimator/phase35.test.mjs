import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { release1WriteAllowed } from "./ceLock.js";
import { containsPrice, quantityAttachmentText, applyAward, applyCancel } from "./jobOrder.js";
import { jobOrderFormLines, jobOrderPdfBytes, quantityAttachmentPdfBytes, sy3Form } from "./jobOrderPdf.js";
import { claimProposalNumber, deleteDraftProposal, proposalEditable } from "./proposal.js";
import { appendInAppNotices, executeServerEscalation, monitorDashboard, noticesToMail, runServerEscalation } from "./release1Monitor.js";
import { saveRelease1Store, storedDocumentLabel } from "./release1Store.server.js";

const NOW = "2026-10-28T12:00:00.000Z";
const root = new URL("../../../", import.meta.url);
/** @param {string} path */
const repo = (path) => new URL(path, root);
/** @param {string} path */
const text = (path) => readFileSync(repo(path), "utf8");

test("p35 sample counters are service role only and never move the proposal sequence backwards", () => {
	const sql = text("supabase/p35-release1-2026-10-28.sql");
	const rollback = text("supabase/p35-release1-2026-10-28-rollback.sql");
	const start = sql.indexOf("function public.release1_advance_sample_counters");
	const end = sql.indexOf("function public.ce_release1_jo_status_ok");
	const counters = sql.slice(start, end);
	assert.match(counters, /from public, anon, authenticated/);
	assert.equal(/to authenticated/.test(counters), false);
	assert.equal(sql.includes("grant execute on function public.release1_advance_sample_counters(integer, text, integer) to authenticated"), false);
	assert.match(sql, /release1_advance_sample_counters\(integer, text, integer\) to service_role/);
	assert.match(counters, /if proposal_at > used then/);
	assert.match(counters, /greatest\(public\.release1_job_order_year\.last_seq, excluded\.last_seq\)/);
	assert.equal(sql.includes("delete from"), false);
	assert.match(rollback, /p34 rollback/);
	assert.match(rollback, /markups/);
	assert.match(rollback, /to authenticated/);
});

test("escalation and expiring alerts also write an in-app notice", async () => {
	const waiting = {
		id: "p1",
		controlNo: "0007",
		status: "Submitted",
		currentIndex: 0,
		steps: [
			{ userId: "appr-1", backupUserId: "backup-1", since: "2026-10-28T00:00:00.000Z" },
			{ userId: "appr-2" },
		],
		timeline: [],
	};
	const first = runServerEscalation({ markups: [], proposals: [waiting], jobOrders: [] }, NOW);
	const notices = appendInAppNotices([], first.notices, NOW, null);
	assert.equal(notices.length, 1);
	assert.equal(notices[0].type, "Escalated");
	assert.equal(notices[0].toUserId, "backup-1");
	assert.equal(notices[0].at, NOW);
	assert.equal(notices[0].read, false);
	assert.equal(notices[0].body, "0007");
	assert.equal(appendInAppNotices([], first.notices, NOW, [{ event: "Escalated", enabled: false }]).length, 0);
	const expiring = runServerEscalation({
		proposals: [{
			id: "0008",
			controlNo: "0008",
			status: "Sent",
			ownerId: "sales-1",
			validUntil: "2026-11-03T12:00:00.000Z",
			timeline: [],
		}],
	}, NOW);
	const expiringNotices = appendInAppNotices([], expiring.notices, NOW, null);
	assert.equal(expiringNotices.length, 1);
	assert.equal(expiringNotices[0].type, "Proposal expiring");
	assert.equal(expiringNotices[0].toUserId, "sales-1");
	assert.equal(expiringNotices[0].body, "0008");
	assert.equal(expiring.documents.proposals[0].timeline.at(-1).action, "Proposal expiring");
	assert.equal(expiring.documents.proposals[0].timeline.at(-1).who, "sales-1");
	let savedNow = "";
	const since = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
	const live = {
		...waiting,
		steps: [
			{ userId: "appr-1", backupUserId: "backup-1", since },
			{ userId: "appr-2" },
		],
	};
	const executed = await executeServerEscalation({
		read: async () => ({ proposals: [live], notifications: [] }),
		save: async (_documents, alerts, at) => {
			savedNow = at;
			return { ok: true, failed: [], notifications: appendInAppNotices([], alerts, at, null) };
		},
	});
	assert.equal(executed.now, savedNow);
	assert.match(savedNow, /^\d{4}-\d{2}-\d{2}T/);
	const savedNotices = /** @type {{ notifications?: { type?: string, at?: string }[] }} */ (executed.saved).notifications || [];
	assert.equal(savedNotices[0].type, "Escalated");
	assert.equal(savedNotices[0].at, savedNow);
});

test("a version conflict is reported and that document is not mailed", async () => {
	/** @type {{ url: string, headers: Record<string, string> }[]} */
	const calls = [];
	const fetchImpl = async (/** @type {string} */ url, /** @type {{ headers?: Record<string, string> }} */ init) => {
		calls.push({ url: String(url), headers: init?.headers || {} });
		if (String(url).includes("doc_id=eq.conflict")) return { ok: true, json: async () => [] };
		return { ok: true, json: async () => [{ version: 2 }] };
	};
	const loaded = {
		url: "https://example.test",
		key: "service-key-not-logged",
		rows: [
			{ kind: "proposal", doc_id: "conflict", version: 4, payload: { id: "conflict", status: "Draft" } },
			{ kind: "proposal", doc_id: "ok-1", version: 1, payload: { id: "ok-1", status: "Draft" } },
			{ kind: "notifications", doc_id: "company", version: 3, payload: [] },
		],
	};
	const result = await saveRelease1Store(loaded, {
		proposals: [
			{ id: "conflict", status: "Submitted" },
			{ id: "ok-1", status: "Submitted" },
		],
		notifications: [{ id: "n1", type: "Escalated", toUserId: "backup-1" }],
	}, /** @type {typeof fetch} */ (fetchImpl));
	assert.equal(calls.every((call) => call.url.includes("version=eq.")), true);
	assert.equal(calls.some((call) => call.url.includes("version=eq.4")), true);
	assert.equal(calls[0].headers.Prefer, "return=representation");
	assert.equal(result.ok, false);
	assert.equal(result.failed.some((row) => row.id === "conflict" && row.conflict === true), true);
	assert.equal(result.saved.some((row) => row.id === "ok-1"), true);
	const mailed = noticesToMail([
		{ doc: { id: "conflict", controlNo: "conflict" }, template: "escalated" },
		{ doc: { id: "ok-1", controlNo: "ok-1" }, template: "escalated" },
	], result);
	assert.equal(mailed.length, 1);
	assert.equal(mailed[0].doc.id, "ok-1");
	assert.equal(text("src/lib/estimator/release1Store.server.js").includes("console."), false);
});

test("the escalate route ignores a posted clock and mail looks up the stored label", () => {
	const escalate = text("src/routes/api/release1-escalate.ts");
	const mail = text("src/routes/api/release1-mail.ts");
	assert.equal(escalate.includes("body.now"), false);
	assert.equal(escalate.includes("body?.now"), false);
	assert.equal(escalate.includes("appendInAppNotices"), true);
	assert.equal(escalate.includes("noticesToMail"), true);
	assert.equal(escalate.includes("executeServerEscalation"), true);
	assert.equal(mail.includes("body.label"), false);
	assert.equal(mail.includes("storedDocumentLabel"), true);
	assert.equal(mail.includes("That document was not found."), true);
	const documents = {
		proposals: [{ id: "0001", controlNo: "0001" }],
		jobOrders: [{ id: "JO-1", joNo: "JO-001-SW-SAM-26-0001" }],
	};
	assert.equal(storedDocumentLabel(documents, "0001"), "0001");
	assert.equal(storedDocumentLabel(documents, "JO-1"), "JO-001-SW-SAM-26-0001");
	assert.equal(storedDocumentLabel(documents, "Please approve this free text"), "");
});

test("a lost proposal counts as a loss in the sales rep win rate", () => {
	const users = [{ userId: "sales-1", name: "Test Sales" }];
	const both = monitorDashboard({
		users,
		ces: [],
		proposals: [
			{ ownerId: "sales-1", status: "Won", controlNo: "0001" },
			{ ownerId: "sales-1", status: "Lost", controlNo: "0002" },
		],
		now: NOW,
	});
	assert.equal(both.bySalesRep.length, 1);
	assert.equal(both.bySalesRep[0].winRate, 0.5);
	assert.equal(both.bySalesRep[0].salesRepName, "Test Sales");
	assert.equal(String(both.bySalesRep[0].salesRepName).includes("sales-1"), false);
	assert.equal(both.winRate, null);
	const lost = monitorDashboard({
		users,
		ces: [],
		proposals: [{ salesRepId: "sales-1", status: "Lost" }],
		now: NOW,
	});
	assert.equal(lost.bySalesRep[0].winRate, 0);
	assert.equal(lost.bySalesRep[0].salesRepName, "Test Sales");
});

test("the job order PDF is the SY3 form and the quantities file is a PDF with no prices", () => {
	const users = [
		{ userId: "sales-1", name: "Test Sales" },
		{ userId: "backup-1", name: "Backup Signer" },
		{ userId: "mgr-1", name: "Primary Approver" },
	];
	const jo = {
		joNo: "JO-001-SW-SAM-26-0001",
		dateIssued: "2026-10-28",
		client: "Sample Client",
		project: "Walk",
		prNo: "PR 26-360801",
		salesRepId: "sales-1",
		approverId: "backup-1",
		approverFor: "for Primary Approver",
		ceIds: ["CE-1"],
		type: "SW",
		poKind: "PO",
		poFileName: "PO-walk.pdf",
		ceQuantity: [{ description: "Welder", qty: 2, unit: "day", rate: 500, amount: 1234.56 }],
	};
	const form = sy3Form(jo, users);
	assert.equal(form.header.mark, "SY3");
	assert.equal(form.header.title, "Job Order");
	assert.equal(JSON.stringify(form).split(jo.joNo).length, 2);
	assert.equal(form.signatures[0].label, "Prepared by");
	assert.equal(form.signatures[0].name, "Test Sales");
	assert.equal(form.signatures[1].label, "Checked and approved by");
	assert.equal(form.signatures[1].name, "Backup Signer");
	assert.equal(form.signatures[1].note, "for Primary Approver");
	const shown = [...form.fields.map((field) => field.join(" ")), ...form.signatures.map((sig) => `${sig.label} ${sig.name} ${sig.note}`)].join("\n");
	assert.equal(containsPrice(shown), false);
	assert.equal(shown.includes("sales-1"), false);
	assert.equal(shown.includes("backup-1"), false);
	assert.equal(shown.includes("mgr-1"), false);
	const lines = jobOrderFormLines(jo, users);
	assert.equal(lines[0], "SY3 Job Order");
	assert.equal(lines.filter((line) => line.includes(jo.joNo)).length, 1);
	const bytes = jobOrderPdfBytes(jo, users);
	const raw = Buffer.from(bytes).toString("latin1");
	assert.equal(raw.slice(0, 4), "%PDF");
	assert.equal(raw.includes("Prepared by"), true);
	assert.equal(raw.includes("Checked and approved by"), true);
	assert.equal(raw.includes("for Primary Approver"), true);
	assert.equal(raw.includes("1234.56"), false);
	const qty = quantityAttachmentText(jo.ceQuantity);
	assert.match(qty, /Quantities only/);
	assert.equal(containsPrice(qty), false);
	assert.equal(qty.includes("1234.56"), false);
	assert.equal(qty.includes("500"), false);
	const qtyPdf = Buffer.from(quantityAttachmentPdfBytes(jo.ceQuantity)).toString("latin1");
	assert.equal(qtyPdf.slice(0, 4), "%PDF");
	assert.equal(qtyPdf.includes("Quantities only"), true);
	assert.equal(qtyPdf.includes("1234.56"), false);
	const panel = text("src/components/JobOrderPanel.jsx");
	assert.equal(panel.includes("quantityAttachmentPdfBytes"), true);
	assert.equal(panel.includes("-quantities.pdf"), true);
	assert.equal(panel.includes("window.prompt"), false);
});

test("deleting a draft keeps the record and releases its PR through the owner check", () => {
	const draft = { status: "Draft", ownerId: "owner-1", id: "0012", controlNo: "0012", prNo: "PR-1", steps: [], timeline: [] };
	assert.equal(deleteDraftProposal(draft, { byUserId: "other", now: NOW }).ok, false);
	const removed = deleteDraftProposal(draft, { byUserId: "owner-1", now: NOW });
	if (!removed.ok || !removed.proposal || !removed.entry) throw new Error("delete");
	assert.equal(removed.proposal.deleted, true);
	assert.equal(removed.proposal.deletedAt, NOW);
	assert.equal(removed.proposal.prNo, "");
	assert.equal(removed.proposal.controlNo, "0012");
	assert.equal(removed.entry.who, "owner-1");
	assert.equal(removed.entry.at, NOW);
	assert.equal(removed.proposal.timeline.at(-1).who, "owner-1");
	assert.equal(removed.proposal.timeline.at(-1).action, "Draft proposal deleted");
	assert.equal(proposalEditable(removed.proposal), false);
	const registry = [
		{ controlNo: "0012", prNo: "PR-1", ownerId: "owner-1" },
		{ controlNo: "0013", prNo: "PR-B", ownerId: "owner-2" },
	];
	assert.equal(claimProposalNumber({ registry, controlNo: "0012", prNo: "", actorId: "stranger" }).ok, false);
	const released = claimProposalNumber({ registry, controlNo: "0012", prNo: "", actorId: "owner-1" });
	if (!released.ok || !released.registry) throw new Error("release");
	assert.equal(released.registry.find((row) => row.controlNo === "0012").prNo, "");
	assert.equal(released.registry.find((row) => row.controlNo === "0013").prNo, "PR-B");
	const sql = text("supabase/p35-release1-2026-10-28.sql");
	assert.match(sql, /function public.release_proposal_pr/);
	assert.match(sql, /set pr_no = ''/);
	assert.equal(sql.includes("delete from"), false);
	const app = text("src/components/CostEstimatorApp.jsx");
	const start = app.indexOf('if (action === "delete-draft")');
	const handler = app.slice(start, app.indexOf('if (action === "create")', start));
	assert.equal(handler.includes("releaseProposalPr"), true);
	assert.equal(handler.includes("claimProposalNumber"), true);
	assert.equal(handler.includes("claimProposalPr"), false);
	assert.equal(handler.includes("removed.proposal"), true);
	assert.equal(handler.includes("row !== current"), false);
	const workspace = text("src/lib/estimator/supabase-workspace.ts");
	assert.equal(workspace.includes("release_proposal_pr"), true);
	assert.equal(workspace.includes("PGRST202"), true);
});

test("award and cancel require the linked job order status", () => {
	const ces = [{ id: "CE-1", status: "Done" }];
	const documents = {
		"CE-1": { status: "Done", ceStatus: "Done", approval: { status: "accepted" }, timeline: [] },
	};
	const proposal = { id: "0001", controlNo: "0001", status: "Approved", ownerId: "sales-1", timeline: [] };
	const effect = { ceIds: ["CE-1"], proposalControl: "0001", joNo: "JO-001-SW-SAM-26-0001" };
	const blocked = applyAward({ ces, documents, proposal, effect, byUserId: "sales-1", now: NOW, jobOrders: [] });
	if (blocked.ok) throw new Error("award should be refused");
	assert.match(blocked.message, /approved job order/);
	const awarded = applyAward({
		ces,
		documents,
		proposal,
		effect,
		byUserId: "sales-1",
		now: NOW,
		jobOrders: [{ status: "Approved", ceIds: ["CE-1"], joNo: effect.joNo }],
	});
	if (!awarded.ok) throw new Error(awarded.message || "award");
	assert.equal(awarded.ces[0].status, "Awarded");
	assert.equal(awarded.documents["CE-1"].timeline.at(-1).who, "sales-1");
	assert.equal(awarded.documents["CE-1"].timeline.at(-1).at, NOW);
	const stillApproved = applyCancel({
		ces: awarded.ces,
		documents: awarded.documents,
		proposal: awarded.proposal,
		award: awarded.award,
		byUserId: "sales-1",
		remarks: "Client stopped",
		now: NOW,
		jobOrders: [{ status: "Approved", ceIds: ["CE-1"] }],
	});
	if (stillApproved.ok) throw new Error("cancel should be refused");
	assert.match(stillApproved.message, /cancelled job order/);
	const restored = applyCancel({
		ces: awarded.ces,
		documents: awarded.documents,
		proposal: awarded.proposal,
		award: awarded.award,
		byUserId: "sales-1",
		remarks: "Client stopped",
		now: NOW,
		jobOrders: [{ status: "Cancelled", ceIds: ["CE-1"] }],
	});
	if (!restored.ok) throw new Error(restored.message || "cancel");
	assert.equal(restored.ces[0].status, "Done");
	assert.equal(restored.documents["CE-1"].timeline.at(-1).action, "Award cancelled");
	assert.equal(restored.documents["CE-1"].timeline.at(-1).who, "sales-1");
	const old = documents["CE-1"];
	const locked = {
		summary: { id: "CE-1", status: "Done" },
		document: old,
	};
	assert.equal(release1WriteAllowed({
		kind: "ce",
		oldPayload: locked,
		newPayload: {
			summary: { id: "CE-1", status: "Awarded" },
			document: { ...old, status: "Awarded", ceStatus: "Awarded", timeline: [{ who: "sales-1", at: NOW, action: "Awarded" }] },
		},
		jobOrders: [],
	}).ok, false);
	const sql = text("supabase/p35-release1-2026-10-28.sql");
	assert.match(sql, /Award needs an approved job order for this estimate/);
	assert.match(sql, /Cancel needs a cancelled job order for this estimate/);
	assert.match(sql, /ce_release1_jo_status_ok/);
	const workspace = text("src/lib/estimator/supabase-workspace.ts");
	assert.match(workspace, /schema: 2, ce: 3/);
	const app = text("src/components/CostEstimatorApp.jsx");
	const awardAt = app.indexOf("const awarded = applyAward");
	assert.equal(app.slice(awardAt, awardAt + 500).includes("jobOrders:"), true);
	const golive = text("docs/release1-golive.md");
	assert.match(golive, /p35-release1-2026-10-28\.sql/);
	assert.match(golive, /p35-release1-2026-10-28-rollback\.sql/);
	assert.match(golive, /delete from workspace_docs where kind = 'markup'/);
	assert.match(golive, /\{ "toUserId", "template", "docId" \}/);
	assert.match(golive, /do not (set|configure)/i);
});
