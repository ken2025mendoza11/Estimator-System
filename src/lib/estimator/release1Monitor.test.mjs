import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { holderId } from "./monitoringFamilies.js";
import { matrixAllows } from "./notifyMatrix.js";
import { escalationDue } from "./reminders.js";
import { sendRelease1Mail } from "./release1Mail.server.js";
import {
	escalateWaiting,
	expiringProposals,
	monitorDashboard,
	pendingApprovals,
	reassignDoc,
	release1MailRequest,
	runEscalation,
	salesWorklist,
	takeOverApproved,
} from "./release1Monitor.js";

const NOW = "2026-10-28T12:00:00.000Z";
const SINCE = "2026-10-28T00:00:00.000Z";

test("a sales list shows status, age, and the account that holds it", () => {
	const rows = salesWorklist({
		now: NOW,
		proposals: [{
			controlNo: "0012",
			status: "Submitted",
			prDate: "2026-10-18T00:00:00.000Z",
			ownerId: "sales-1",
			currentIndex: 0,
			steps: [{ userId: "appr-1", backupUserId: "backup-1", usedBackup: true }],
		}],
		jobOrders: [{
			joNo: "JO-007-SW-ABC-26-0012",
			status: "Approved",
			dateIssued: "2026-10-26",
			ownerId: "sales-2",
		}],
	});
	assert.equal(rows[0].kind, "proposal");
	assert.equal(rows[0].status, "Submitted");
	assert.equal(rows[0].ageDays, 10);
	assert.equal(rows[0].holderId, "backup-1");
	assert.equal(rows[0].ownerId, "sales-1");
	assert.equal(rows[1].id, "JO-007-SW-ABC-26-0012");
	assert.equal(rows[1].ageDays, 2);
	assert.equal(rows[1].holderId, "sales-2");
	assert.equal(holderId({ currentIndex: 0, steps: [{ userId: "appr-1" }] }), "appr-1");
});

test("pending approvals go overdue at 12 hours and not before", () => {
	const waiting = {
		kind: "proposal",
		id: "0012",
		controlNo: "0012",
		status: "Submitted",
		currentIndex: 0,
		steps: [{ userId: "appr-1", since: SINCE }],
	};
	const due = pendingApprovals([waiting], NOW)[0];
	const early = pendingApprovals([waiting], "2026-10-28T11:59:00.000Z")[0];
	assert.equal(due.holderId, "appr-1");
	assert.equal(due.hours, 12);
	assert.equal(due.overdue, true);
	assert.equal(early.overdue, false);
	assert.equal(escalationDue(SINCE, NOW, 12), true);
	assert.equal(escalationDue(SINCE, "2026-10-28T11:59:00.000Z", 12), false);
});

test("the dashboard reuses win rate and turnaround and ages proposals by sales account", () => {
	const dash = monitorDashboard({
		now: "2026-10-28T00:00:00.000Z",
		ces: [
			{ awardStatus: "Awarded", status: "Awarded", received: "2026-10-01", done: "2026-10-11" },
			{ awardStatus: "Lost", status: "Done", received: "2026-10-01", done: "2026-10-05" },
			{ awardStatus: "", status: "Ongoing", received: "2026-10-01", done: "" },
		],
		proposals: [
			{ salesRepId: "rep-1", prDate: "2026-10-20T00:00:00.000Z" },
			{ ownerId: "rep-1", prDate: "2026-10-26T00:00:00.000Z" },
			{ salesRepId: "rep-2", prDate: "2026-10-01T00:00:00.000Z" },
		],
	});
	assert.equal(dash.winRate, 0.5);
	assert.equal(dash.ceTurnaroundDays, 7);
	const first = dash.proposalAging.find((row) => row.salesRepId === "rep-1");
	const second = dash.proposalAging.find((row) => row.salesRepId === "rep-2");
	if (!first || !second) throw new Error("missing aging row");
	assert.equal(first.count, 2);
	assert.equal(first.oldestDays, 8);
	assert.equal(second.count, 1);
	assert.equal(second.oldestDays, 27);
});

test("after 12 hours a waiting step moves to its backup, or the next level when there is none", () => {
	const withBackup = {
		id: "p1",
		status: "For approval",
		currentIndex: 0,
		steps: [
			{ userId: "appr-1", backupUserId: "backup-1", since: SINCE },
			{ userId: "appr-2" },
		],
		timeline: [],
	};
	const first = escalateWaiting(withBackup, NOW);
	assert.equal(first.ok, true);
	if (!first.ok) return;
	assert.equal(first.toUserId, "backup-1");
	assert.equal(first.notice, "Escalated");
	assert.equal(first.doc.steps[0].usedBackup, true);
	assert.equal(first.doc.timeline[0].who, "appr-1");
	assert.equal(first.doc.timeline[0].action, "Escalated");
	const again = escalateWaiting(first.doc, "2026-10-29T12:00:00.000Z");
	assert.equal(again.ok, true);
	if (!again.ok) return;
	assert.equal(again.toUserId, "appr-2");
	assert.equal(again.doc.currentIndex, 1);
	const same = escalateWaiting(first.doc, NOW);
	assert.equal(same.ok, false);
	assert.equal(same.message, "Not due.");

	const noBackup = {
		status: "Submitted",
		currentIndex: 0,
		steps: [
			{ userId: "appr-1", since: SINCE },
			{ userId: "appr-2" },
		],
		timeline: [],
	};
	const next = escalateWaiting(noBackup, NOW);
	assert.equal(next.ok, true);
	if (!next.ok) return;
	assert.equal(next.doc.currentIndex, 1);
	assert.equal(next.toUserId, "appr-2");
	assert.equal(next.doc.steps[0].decision, "escalated");
	assert.equal(next.doc.timeline[0].who, "appr-1");
	const early = escalateWaiting(noBackup, "2026-10-28T11:00:00.000Z");
	if (early.ok) throw new Error("not due yet");
	assert.equal(early.message, "Not due.");
	const stuck = escalateWaiting({
		status: "Submitted",
		currentIndex: 0,
		steps: [{ userId: "appr-1", since: SINCE }],
	}, NOW);
	if (stuck.ok) throw new Error("nowhere to escalate");
	assert.equal(stuck.message, "No backup or next level.");
	assert.equal(runEscalation([withBackup, { status: "Draft" }], NOW).length, 1);
});

test("approved and sent proposals that expire within a week are flagged", () => {
	const rows = expiringProposals([
		{ controlNo: "0001", status: "Approved", validUntil: "2026-10-30T00:00:00.000Z", ownerId: "rep-1" },
		{ controlNo: "0002", status: "Sent", validUntil: "2026-12-01T00:00:00.000Z", ownerId: "rep-2" },
		{ controlNo: "0003", status: "Draft", validUntil: "2026-10-29T00:00:00.000Z", ownerId: "rep-1" },
	], "2026-10-28T00:00:00.000Z");
	assert.deepEqual(rows.map((row) => row.id), ["0001"]);
	assert.equal(rows[0].toUserId, "rep-1");
	assert.equal(rows[0].notice, "Proposal expiring");
});

test("another Sales account can take over after approval, and only an authorised user can reassign", () => {
	const approved = { status: "Approved", ownerId: "sales-1", timeline: [] };
	assert.equal(takeOverApproved({ doc: approved, actorId: "sales-2", sales: false }).ok, false);
	assert.equal(takeOverApproved({ doc: approved, actorId: "sales-1", sales: true }).ok, false);
	assert.equal(takeOverApproved({ doc: { status: "Draft", ownerId: "sales-1" }, actorId: "sales-2", sales: true }).ok, false);
	const taken = takeOverApproved({ doc: approved, actorId: "sales-2", sales: true, now: NOW });
	assert.equal(taken.ok, true);
	if (!taken.ok) return;
	assert.equal(taken.doc.ownerId, "sales-2");
	assert.equal(taken.doc.timeline[0].who, "sales-2");
	assert.equal(taken.doc.timeline[0].action, "Taken over");
	assert.equal(reassignDoc({ doc: approved, actorId: "admin-1", toUserId: "sales-3", authorized: false }).ok, false);
	const moved = reassignDoc({ doc: approved, actorId: "admin-1", toUserId: "sales-3", authorized: true, now: NOW });
	assert.equal(moved.ok, true);
	if (!moved.ok) return;
	assert.equal(moved.doc.ownerId, "sales-3");
	assert.equal(moved.doc.timeline[0].who, "admin-1");
	assert.equal(moved.doc.timeline[0].remarks, "sales-3");
});

test("email is skipped without a key, and the key is never logged", async () => {
	const secret = "mail-key-should-not-log";
	const skipped = /** @type {string[]} */ ([]);
	const empty = await sendRelease1Mail({
		to: "sales@example.com",
		subject: "Escalated",
		env: { RELEASE1_MAIL_KEY: "" },
		log: (message) => skipped.push(message),
	});
	assert.equal(empty.skipped, true);
	assert.equal(skipped.join(" ").includes(secret), false);
	const noUrl = /** @type {string[]} */ ([]);
	await sendRelease1Mail({
		to: "sales@example.com",
		env: { RELEASE1_MAIL_KEY: secret, RELEASE1_MAIL_URL: "" },
		log: (message) => noUrl.push(message),
	});
	assert.equal(noUrl.join("").includes(secret), false);
	const logs = /** @type {string[]} */ ([]);
	let auth = "";
	const sent = await sendRelease1Mail({
		to: "sales@example.com",
		subject: "Escalated",
		text: "0012",
		env: { RELEASE1_MAIL_KEY: secret, RELEASE1_MAIL_URL: "https://mail.example/send", RELEASE1_MAIL_FROM: "ops@example.com" },
		log: (message) => logs.push(message),
		fetchImpl: async (_url, init) => {
			auth = init.headers?.Authorization || "";
			return { ok: true };
		},
	});
	assert.equal(sent.ok, true);
	assert.equal(sent.skipped, false);
	assert.equal(auth, `Bearer ${secret}`);
	assert.equal(logs.join("").includes(secret), false);
	assert.equal(release1MailRequest("sales-1", [{ userId: "sales-1", email: "sales@example.com" }], "Returned", "0012")?.to, "sales@example.com");
	assert.equal(release1MailRequest("sales-1", [], "Returned", "0012"), null);
});

test("the monitor flag is off until the TEST seed, and new notices can be turned off", () => {
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	const reports = readFileSync(new URL("../../components/Phase6Reports.jsx", import.meta.url), "utf8");
	const mail = readFileSync(new URL("./release1Mail.server.js", import.meta.url), "utf8");
	const route = readFileSync(new URL("../../routes/api/release1-escalate.ts", import.meta.url), "utf8");
	const env = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
	const monitor = readFileSync(new URL("./release1Monitor.js", import.meta.url), "utf8");
	assert.equal(app.includes("release1Monitor: false"), true);
	assert.equal(seed.includes("release1Monitor: true"), true);
	assert.equal(app.includes("/api/release1-escalate"), false);
	assert.equal(app.includes("/api/release1-mail"), true);
	assert.equal(reports.includes("#b45309"), true);
	assert.equal(reports.includes("Sales list"), true);
	assert.equal(reports.includes("Pending approvals"), true);
	assert.equal(reports.includes("Proposal aging"), true);
	assert.equal(monitor.includes("ceTotals"), false);
	assert.equal(mail.includes("VITE_"), false);
	assert.equal(route.includes("VITE_"), false);
	assert.equal(env.includes("RELEASE1_MAIL_KEY="), true);
	assert.equal(env.includes("RELEASE1_MAIL_URL="), true);
	assert.equal(env.includes("RELEASE1_MAIL_FROM="), true);
	assert.equal(matrixAllows(null, "Escalated"), true);
	assert.equal(matrixAllows(null, "Proposal expiring"), true);
	assert.equal(matrixAllows(null, "Document approved"), true);
	assert.equal(matrixAllows(null, "Returned"), true);
	assert.equal(matrixAllows([{ event: "Escalated", enabled: false }], "Escalated"), false);
	assert.equal(matrixAllows([{ event: "Escalated", enabled: false }], "A new notice"), true);
});
