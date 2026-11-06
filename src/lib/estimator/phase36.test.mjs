import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deleteDraftProposal } from "./proposal.js";
import { mailForRoster, sendRelease1Mail } from "./release1Mail.server.js";
import { monitorDashboard, salesWorklist, saveInAppNotices } from "./release1Monitor.js";
import { documentsFromRows, loadRelease1Store, loadStoredCe, saveRelease1Store, storedDocumentLabel } from "./release1Store.server.js";

const NOW = "2026-10-28T12:00:00.000Z";
const root = new URL("../../../", import.meta.url);
/** @param {string} path */
const text = (path) => readFileSync(new URL(path, root), "utf8");
const roster = [{ userId: "sales-1", email: "sales@estimator-test.invalid", name: "Test Sales" }];

test("a ce-approved email uses the CE number and a markup email uses the markup label", async () => {
	/** @type {{ url: string, body?: string }[]} */
	const sent = [];
	const ces = await loadStoredCe(
		{ VITE_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" },
		/** @type {typeof fetch} */ (async (url) => {
			assert.match(String(url), /kind=eq\.ce/);
			assert.match(String(url), /doc_id=eq\.CE-9/);
			return {
				ok: true,
				json: async () => [{
					kind: "ce",
					doc_id: "CE-9",
					payload: { summary: { id: "CE-9" }, document: { projectInfo: { docNo: "CE-26-009" } } },
				}],
			};
		}),
		"CE-9",
	);
	const ceLabel = storedDocumentLabel({ ces, markups: [], proposals: [], jobOrders: [] }, "CE-9", "ce");
	assert.equal(ceLabel, "CE-26-009");
	const ceLetter = mailForRoster({ toUserId: "sales-1", template: "ce-approved", label: ceLabel, roster });
	assert.equal(ceLetter.ok, true);
	if (!ceLetter.ok) return;
	const ceSent = await sendRelease1Mail({
		to: ceLetter.to,
		subject: ceLetter.subject,
		text: ceLetter.text,
		env: { RELEASE1_MAIL_KEY: "mail-key", RELEASE1_MAIL_URL: "https://mail.test/send", RELEASE1_MAIL_FROM: "from@estimator-test.invalid" },
		log: () => {},
		fetchImpl: async (url, init) => {
			sent.push({ url: String(url), body: init?.body });
			return { ok: true };
		},
	});
	assert.equal(ceSent.ok, true);
	assert.equal(ceSent.skipped, false);
	const ceBody = JSON.parse(String(sent[0]?.body || "{}"));
	assert.equal(ceBody.subject, "CE approved");
	assert.equal(ceBody.text, "CE-26-009 was approved.");

	const shared = documentsFromRows([
		{ kind: "markup", doc_id: "CE-1-MK", payload: { id: "CE-1-MK", ceId: "CE-1", status: "Approved" } },
		{ kind: "proposal", doc_id: "0004", payload: { id: "0004", controlNo: "0004", ceId: "CE-1", status: "Approved" } },
		{ kind: "ce", doc_id: "CE-1", payload: { summary: { id: "CE-1" }, document: { projectInfo: { docNo: "CE-26-009" } } } },
	]);
	shared.jobOrders = [{ id: "JO-1", joNo: "JO-001-SW-SAM-26-0004", ceId: "CE-1" }];
	const markupLabel = storedDocumentLabel(shared, "CE-1-MK", "markup");
	assert.equal(markupLabel, "CE-26-009");
	assert.equal(markupLabel.includes("CE-1"), false);
	assert.equal(markupLabel.includes("0004"), false);
	assert.equal(markupLabel.includes("JO-001"), false);
	const markupLetter = mailForRoster({ toUserId: "sales-1", template: "approved", label: markupLabel, roster });
	assert.equal(markupLetter.ok, true);
	if (!markupLetter.ok) return;
	await sendRelease1Mail({
		to: markupLetter.to,
		subject: markupLetter.subject,
		text: markupLetter.text,
		env: { RELEASE1_MAIL_KEY: "mail-key", RELEASE1_MAIL_URL: "https://mail.test/send", RELEASE1_MAIL_FROM: "from@estimator-test.invalid" },
		log: () => {},
		fetchImpl: async (_url, init) => {
			sent.push({ url: "", body: init?.body });
			return { ok: true };
		},
	});
	const markupBody = JSON.parse(String(sent[1]?.body || "{}"));
	assert.equal(markupBody.text, "CE-26-009 was approved.");
	assert.equal(markupBody.text.includes("CE-1"), false);
	assert.equal(markupBody.text.includes("0004"), false);
	const route = text("src/routes/api/release1-mail.ts");
	const app = text("src/components/CostEstimatorApp.jsx");
	assert.equal(route.includes("loadStoredCe"), true);
	assert.equal(route.includes('template === "ce-approved"'), true);
	assert.equal(route.includes("body.label"), false);
	assert.equal(app.includes('kind: String(kind || "")'), true);
	assert.equal(app.includes('sendRelease1Mail(built.toUserId, "ce-approved"'), true);
	assert.equal(app.includes('"markup"'), true);
});

test("a notification version conflict is re-read and saved on the next try", async () => {
	const alerts = [{ template: "escalated", toUserId: "backup-1", doc: { id: "p1", controlNo: "0007", ceId: "CE-1" } }];
	/** @type {string[]} */
	const patches = [];
	const env = { VITE_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
	const loaded = {
		url: env.VITE_SUPABASE_URL,
		key: env.SUPABASE_SERVICE_ROLE_KEY,
		rows: [{ kind: "notifications", doc_id: "company", version: 1, payload: [{ id: "stale", type: "Needs your approval" }] }],
		documents: { notifications: [{ id: "stale", type: "Needs your approval" }], notifyMatrix: null },
	};
	const fetchImpl = async (/** @type {URL | RequestInfo} */ url, /** @type {RequestInit | undefined} */ init) => {
		const address = String(url);
		if (init?.method === "PATCH") {
			patches.push(address);
			const body = JSON.parse(String(init.body || "{}"));
			if (address.includes("version=eq.1")) return { ok: true, json: async () => [] };
			assert.equal(address.includes("version=eq.5"), true);
			assert.equal(body.payload.some((/** @type {{ id?: string }} */ row) => row.id === "fresh"), true);
			assert.equal(body.payload.some((/** @type {{ type?: string, toUserId?: string }} */ row) => row.type === "Escalated" && row.toUserId === "backup-1"), true);
			return { ok: true, json: async () => [{ version: 6 }] };
		}
		return {
			ok: true,
			json: async () => [{ kind: "notifications", doc_id: "company", version: 5, payload: [{ id: "fresh", type: "Needs your approval", at: NOW }] }],
		};
	};
	const saved = await saveInAppNotices({
		loaded,
		alerts,
		now: NOW,
		save: (current, notifications) => saveRelease1Store(current, { notifications }, /** @type {typeof fetch} */ (fetchImpl)),
		reload: async () => {
			const again = await loadRelease1Store(env, /** @type {typeof fetch} */ (fetchImpl));
			return again.ok ? again : null;
		},
	});
	assert.equal(saved.ok, true);
	assert.equal(saved.conflict, false);
	assert.equal(saved.attempts, 2);
	assert.equal(patches.length, 2);
	assert.equal(saved.notifications.some((row) => row.type === "Escalated" && row.at === NOW), true);

	let stopped = 0;
	const stuck = await saveInAppNotices({
		loaded,
		alerts,
		now: NOW,
		save: async () => {
			stopped += 1;
			return { ok: false, saved: [], failed: [{ kind: "notifications", id: "company", conflict: true }] };
		},
		reload: async () => loaded,
	});
	assert.equal(stopped, 3);
	assert.equal(stuck.attempts, 3);
	assert.equal(stuck.ok, false);
	assert.equal(stuck.conflict, true);
	const route = text("src/routes/api/release1-escalate.ts");
	assert.equal(route.includes("saveInAppNotices"), true);
	assert.equal(route.includes("noticeSave"), true);
	assert.equal(route.includes("body.now"), false);
	assert.equal(route.includes("body.items"), false);
});

test("a deleted draft stays stored and is left out of the sales worklist and dashboard", () => {
	const users = [{ userId: "sales-1", name: "Test Sales" }];
	const draft = { status: "Draft", ownerId: "sales-1", id: "0009", controlNo: "0009", steps: [], timeline: [], prDate: "2026-10-01T00:00:00.000Z" };
	const removed = deleteDraftProposal(draft, { byUserId: "sales-1", now: NOW });
	if (!removed.ok || !removed.proposal) throw new Error(removed.message || "delete");
	assert.equal(removed.proposal.deleted, true);
	assert.equal(removed.proposal.deletedAt, NOW);
	assert.equal(removed.proposal.timeline.at(-1).who, "sales-1");
	const kept = { ownerId: "sales-1", status: "Sent", controlNo: "0010", prDate: "2026-10-20T00:00:00.000Z" };
	const lost = { ownerId: "sales-1", status: "Lost", controlNo: "0011", deleted: true, deletedAt: NOW };
	const work = salesWorklist({ proposals: [removed.proposal, kept], jobOrders: [], users, now: NOW });
	assert.equal(work.length, 1);
	assert.equal(work[0].id, "0010");
	assert.equal(work[0].ownerName, "Test Sales");
	assert.equal(String(work[0].ownerName).includes("sales-1"), false);
	const dash = monitorDashboard({
		users,
		ces: [{ id: "CE-1", status: "Awarded", salesRepId: "sales-1" }],
		proposals: [removed.proposal, kept, lost, { ownerId: "sales-1", status: "Won", controlNo: "0012" }],
		now: NOW,
	});
	assert.equal(dash.proposalAging.length, 1);
	assert.equal(dash.proposalAging[0].count, 2);
	assert.equal(dash.bySalesRep.length, 1);
	assert.equal(dash.bySalesRep[0].proposalCount, 2);
	assert.equal(dash.bySalesRep[0].winRate, 1);
	assert.equal(removed.proposal.deleted, true);
	const onlyDeleted = monitorDashboard({ users, ces: [], proposals: [removed.proposal], now: NOW });
	assert.equal(onlyDeleted.proposalAging.length, 0);
	assert.equal(onlyDeleted.bySalesRep.length, 0);
});
