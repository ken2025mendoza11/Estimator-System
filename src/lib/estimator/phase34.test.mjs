import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { screenOfficialTotal } from "./ceTotals.js";
import { backupSignatureLabel, personName, release1SalesApprovers } from "./departments.js";
import { formatJobOrderNo, jobOrderNoValid, nextYearSequence, registerJobOrderNo } from "./docNumbers.js";
import { canCancelJobOrder, containsPrice, createJobOrder, jobOrderLines, quantityAttachmentText, quantityOnly, submitJobOrder } from "./jobOrder.js";
import { jobOrderFormLines, jobOrderPdfBytes } from "./jobOrderPdf.js";
import { createMarkup } from "./markup.js";
import { claimProposalNumber, createProposal, deleteDraftProposal, proposalLines, reviseProposal } from "./proposal.js";
import { RELEASE1_TEMPLATES, mailForRoster, release1RequestAllowed } from "./release1Mail.server.js";
import { monitorDashboard, runServerEscalation } from "./release1Monitor.js";

const NOW = "2026-10-28T12:00:00.000Z";
const examples = JSON.parse(readFileSync(new URL("./__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const expected = /** @type {Record<string, number>} */ ({ shop: 27362.51, onsite: 95682.28, trading: 31692.31, hybrid: 154737.1 });
const pricing = { model: "direct-v1" };
const root = new URL("../../../", import.meta.url);
/** @param {string} path */
const repo = (path) => new URL(path, root);

test("the proposal total is the approved markup selling price for each direct example", () => {
	for (const key of Object.keys(expected)) {
		const direct = screenOfficialTotal(examples[key].tasks, pricing);
		assert.equal(direct, expected[key], key);
		const markup = createMarkup({ ceId: key, byUserId: "sales-1", directCost: direct, preset: "100", now: NOW });
		if (!markup.ok) throw new Error(markup.message || key);
		const proposal = createProposal({
			controlNo: "0001",
			byUserId: "sales-1",
			ceId: key,
			parts: markup.markup.parts,
			directCost: markup.markup.directCost,
			groups: [{ key: "BOL", label: "BOL", direct: direct + 1 }],
			now: NOW,
		});
		if (!proposal.ok) throw new Error(proposal.message || key);
		assert.equal(proposal.proposal.direct, markup.markup.directCost, key);
		assert.equal(proposal.proposal.total, markup.markup.selling, key);
	}
});

test("mail needs a session or the scheduler secret, and only a roster account gets a fixed template", () => {
	assert.equal(release1RequestAllowed({ userId: "", schedulerHeader: "secret", secret: "" }).ok, false);
	assert.equal(release1RequestAllowed({ userId: "acct-1", secret: "" }).ok, true);
	assert.equal(release1RequestAllowed({ schedulerHeader: "secret", secret: "secret" }).via, "scheduler");
	const letter = mailForRoster({
		toUserId: "sales-1",
		template: "ce-approved",
		label: "CE-1",
		roster: [{ userId: "sales-1", email: "sales@estimator-test.invalid", name: "Test Sales" }],
	});
	assert.equal(letter.ok, true);
	assert.equal(letter.subject, RELEASE1_TEMPLATES["ce-approved"].subject);
	assert.equal(letter.to, "sales@estimator-test.invalid");
	assert.equal(mailForRoster({ toUserId: "missing", template: "approved", label: "CE-1", roster: [] }).ok, false);
	assert.equal(mailForRoster({ toUserId: "sales-1", template: "free-text", label: "CE-1", roster: [{ userId: "sales-1", email: "a@b.c" }] }).ok, false);
	const mail = readFileSync(new URL("./release1Mail.server.js", import.meta.url), "utf8");
	const route = readFileSync(new URL("../../routes/api/release1-mail.ts", import.meta.url), "utf8");
	const escalate = readFileSync(new URL("../../routes/api/release1-escalate.ts", import.meta.url), "utf8");
	assert.equal(route.includes("x-release1-scheduler"), true);
	assert.equal(escalate.includes("executeServerEscalation"), true);
	assert.equal(escalate.includes("body.items"), false);
	assert.equal(mail.includes("VITE_"), false);
});

test("server escalation skips an expired proposal and can move on after the backup", () => {
	const waiting = {
		id: "p1",
		status: "Submitted",
		currentIndex: 0,
		steps: [
			{ userId: "appr-1", backupUserId: "backup-1", since: "2026-10-28T00:00:00.000Z" },
			{ userId: "appr-2" },
		],
		timeline: [],
	};
	const first = runServerEscalation({ markups: [], proposals: [waiting], jobOrders: [] }, NOW);
	assert.equal(first.notices.length, 1);
	assert.equal(first.notices[0].toUserId, "backup-1");
	const second = runServerEscalation({ markups: [], proposals: first.documents.proposals, jobOrders: [] }, NOW);
	assert.equal(second.notices.length, 0);
	const later = runServerEscalation({ markups: [], proposals: first.documents.proposals, jobOrders: [] }, "2026-10-29T12:00:00.000Z");
	assert.equal(later.notices.length, 1);
	assert.equal(later.notices[0].toUserId, "appr-2");
	const expired = runServerEscalation({
		proposals: [{ id: "old", status: "Expired", validUntil: "2026-10-01T00:00:00.000Z", ownerId: "sales-1", steps: waiting.steps, currentIndex: 0 }],
	}, NOW);
	assert.equal(expired.notices.length, 0);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	assert.equal(app.includes("/api/release1-escalate"), false);
	const golive = readFileSync(repo("docs/release1-golive.md"), "utf8");
	assert.equal(golive.includes("x-release1-scheduler"), true);
	assert.equal(golive.includes("RELEASE1_SCHEDULER_SECRET"), true);
	assert.match(golive, /do not (set|configure)/i);
});

test("backup signing and documents use the person's name, never the account id", () => {
	const users = [
		{ userId: "mgr-1", name: "Primary Approver" },
		{ userId: "sales-1", name: "Test Sales" },
	];
	assert.equal(backupSignatureLabel(personName("mgr-1", users)), "for Primary Approver");
	assert.equal(backupSignatureLabel(""), "");
	assert.equal(personName("mgr-1", []), "Unnamed");
	assert.equal(personName("mgr-1", []).includes("mgr-1"), false);
	const proposal = proposalLines({ controlNo: "0001", salesRepId: "sales-1", approverId: "mgr-1", approverFor: "for Primary Approver" }, users).join("\n");
	const order = jobOrderLines({ joNo: "JO-001-SW-SAM-26-0001", salesRepId: "sales-1", approverId: "mgr-1", approverFor: "for Primary Approver", ceIds: ["CE-1"] }, users).join("\n");
	assert.equal(proposal.includes("Test Sales"), true);
	assert.equal(proposal.includes("Primary Approver"), true);
	assert.equal(proposal.includes("mgr-1"), false);
	assert.equal(proposal.includes("sales-1"), false);
	assert.equal(order.includes("mgr-1"), false);
	assert.equal(order.includes("JO-001-SW-SAM-26-0001"), true);
	assert.equal(order.split("JO-001-SW-SAM-26-0001").length, 2);
	const reports = readFileSync(new URL("../../components/Phase6Reports.jsx", import.meta.url), "utf8");
	assert.equal(reports.includes("holderName"), true);
	assert.equal(reports.includes("salesRepName"), true);
	assert.equal(reports.includes("By sales rep"), true);
	assert.equal(reports.includes("holderId"), false);
	assert.equal(reports.includes("salesRepId"), false);
});

test("a job order revision has no hyphen, is registered once, and a taken number is refused", () => {
	assert.equal(formatJobOrderNo(137, "SW", "ABC", 2026, "0137", 0), "JO-137-SW-ABC-26-0137");
	assert.equal(formatJobOrderNo(1, "SW", "ABC", 2026, "0137", 1), "JO-001-SW-ABC-26-0137REV001");
	assert.equal(formatJobOrderNo(1, "SW", "ABC", 2026, "0137", 2), "JO-001-SW-ABC-26-0137REV002");
	assert.equal(jobOrderNoValid("JO-001-SW-ABC-26-0137"), true);
	assert.equal(jobOrderNoValid("JO-001-SW-ABC-26-0137-REV001"), false);
	const first = registerJobOrderNo([], "JO-001-SW-ABC-26-0137REV001");
	assert.equal(first.ok, true);
	assert.equal(registerJobOrderNo([first.joNo], first.joNo).ok, false);
	assert.equal(registerJobOrderNo([], "not-a-jo").ok, false);
	const sql = readFileSync(repo("supabase/p34-release1-2026-10-28.sql"), "utf8");
	assert.equal(sql.includes("insert into public.release1_job_orders"), true);
	assert.equal(sql.includes("on conflict (jo_no)"), false);
	assert.match(sql, /That job order number is already used/);
	assert.match(sql, /\^JO-\\d\{3\}-\(SW\|F\|T\|O\)/);
});

test("the job order form, quantities file, and PO or NTP are required before submit", () => {
	const created = createJobOrder({
		byUserId: "sales-1",
		seq: 1,
		type: "SW",
		clientCode: "SAM",
		year: 2026,
		controlNo: "0001",
		ceIds: ["CE-1", "CE-2"],
		poFileName: "ntp.pdf",
		poStoragePath: "job-order/draft/ntp.pdf",
		poKind: "NTP",
		ceQuantity: { tasks: [{ title: "Retube", items: [{ description: "Welder", qty: 2, unit: "day", rate: 500, amount: 1000 }] }] },
		now: NOW,
	});
	if (!created.ok) throw new Error(created.message || "create");
	const lines = jobOrderFormLines(created.jobOrder, [{ userId: "sales-1", name: "Test Sales" }]);
	assert.equal(lines[0], "SY3 Job Order");
	assert.equal(lines.filter((line) => line.includes(created.jobOrder.joNo)).length, 1);
	const file = quantityAttachmentText(created.jobOrder.ceQuantity);
	assert.match(file, /Quantities only/);
	assert.equal(containsPrice(file), false);
	assert.equal(containsPrice(quantityOnly(created.jobOrder.ceQuantity)), false);
	assert.equal(file.includes("500"), false);
	assert.equal(file.includes("1000"), false);
	const bytes = jobOrderPdfBytes(created.jobOrder, [{ userId: "sales-1", name: "Test Sales" }]);
	assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), "%PDF");
	assert.equal(submitJobOrder({ ...created.jobOrder, poKind: "" }, { byUserId: "sales-1", approverLists: { jobOrder: [{ userId: "mgr-1", backupUserId: "" }] } }).ok, false);
	assert.equal(submitJobOrder({ ...created.jobOrder, poStoragePath: "" }, { byUserId: "sales-1", approverLists: { jobOrder: [{ userId: "mgr-1", backupUserId: "" }] } }).ok, false);
	assert.equal(submitJobOrder(created.jobOrder, { byUserId: "sales-1", approverLists: { jobOrder: [{ userId: "mgr-1", backupUserId: "" }] } }).ok, true);
	const panel = readFileSync(new URL("../../components/JobOrderPanel.jsx", import.meta.url), "utf8");
	assert.equal(panel.includes("window.prompt"), false);
	assert.equal(panel.includes("uploadNamedBlob"), true);
	assert.equal(panel.includes("poStoragePath"), true);
	assert.equal(panel.includes("<select"), true);
	assert.equal(panel.includes('type="file"'), true);
});

test("a sent proposal can be revised, and win rate is split by sales rep", () => {
	const sent = { status: "Sent", ownerId: "sales-1", controlNo: "0001", rev: 0, timeline: [], id: "0001" };
	const revised = reviseProposal(sent, { byUserId: "sales-1", now: NOW });
	assert.equal(revised.ok, true);
	assert.equal(revised.proposal.rev, 1);
	assert.equal(revised.proposal.status, "Draft");
	const dash = monitorDashboard({
		users: [{ userId: "sales-1", name: "Test Sales" }, { userId: "sales-2", name: "Test Sales Two" }],
		ces: [
			{ status: "Awarded", salesRepId: "sales-1", received: "2026-10-01", done: "2026-10-11" },
			{ status: "Done", awardStatus: "Lost", salesRepId: "sales-2", received: "2026-10-01", done: "2026-10-03" },
		],
		proposals: [
			{ salesRepId: "sales-1", prDate: "2026-10-20T00:00:00.000Z" },
			{ ownerId: "sales-2", prDate: "2026-10-01T00:00:00.000Z" },
		],
		now: NOW,
	});
	const one = dash.bySalesRep.find((row) => row.salesRepName === "Test Sales");
	const two = dash.bySalesRep.find((row) => row.salesRepName === "Test Sales Two");
	if (!one || !two) throw new Error("sales rep");
	assert.equal(one.winRate, 1);
	assert.equal(one.proposalCount, 1);
	assert.equal(two.proposalCount, 1);
	assert.equal(two.winRate, 0);
	assert.equal(String(one.salesRepId), "sales-1");
	assert.equal(dash.proposalAging.every((row) => row.salesRepName && !String(row.salesRepName).includes("sales-")), true);
});

test("an empty PR does not delete another claim, and only the owner or an admin can change it", () => {
	const first = claimProposalNumber({ registry: [], controlNo: "12", prNo: "PR-A", actorId: "owner-1" });
	const second = claimProposalNumber({ registry: first.registry, controlNo: "13", prNo: "PR-B", actorId: "owner-2" });
	const cleared = claimProposalNumber({ registry: second.registry, controlNo: "12", prNo: "", actorId: "owner-1" });
	if (!cleared.ok || !cleared.registry) throw new Error("clear");
	assert.equal(cleared.registry.find((row) => row.controlNo === "0012").prNo, "");
	assert.equal(cleared.registry.find((row) => row.controlNo === "0013").prNo, "PR-B");
	assert.equal(claimProposalNumber({ registry: second.registry, controlNo: "13", prNo: "PR-X", actorId: "stranger" }).ok, false);
	assert.equal(claimProposalNumber({ registry: second.registry, controlNo: "", prNo: "PR-X", actorId: "owner-1" }).ok, false);
	const sql = readFileSync(repo("supabase/p34-release1-2026-10-28.sql"), "utf8");
	assert.equal(sql.includes("delete from"), false);
	assert.match(sql, /set pr_no = ''/);
	assert.match(sql, /Only the owner or an admin/);
	const draft = { status: "Draft", ownerId: "owner-1", id: "0012", controlNo: "0012", steps: [], timeline: [] };
	assert.equal(deleteDraftProposal(draft, { byUserId: "other" }).ok, false);
	const removed = deleteDraftProposal(draft, { byUserId: "owner-1", now: NOW });
	if (!removed.ok || !removed.entry) throw new Error("delete");
	assert.equal(removed.entry.who, "owner-1");
	assert.equal(removed.entry.at, NOW);
	assert.equal(deleteDraftProposal({ ...draft, timeline: [{ action: "Proposal submitted" }] }, { byUserId: "owner-1" }).ok, false);
});

test("the job order sequence restarts each year, in code and in the p34 script", () => {
	const year26 = nextYearSequence({}, "2026");
	if (!year26.ok) throw new Error(year26.message);
	const year27 = nextYearSequence({}, "2027");
	if (!year27.ok) throw new Error(year27.message);
	assert.equal(year26.seq, 1);
	assert.equal(year26.yearKey, "26");
	assert.equal(year27.seq, 1);
	assert.equal(year27.yearKey, "27");
	const next = nextYearSequence(year26.counters, 26);
	if (!next.ok) throw new Error(next.message);
	assert.equal(next.seq, 2);
	const restarted = nextYearSequence(next.counters, "2027");
	if (!restarted.ok) throw new Error(restarted.message);
	assert.equal(restarted.seq, 1);
	assert.equal(formatJobOrderNo(year26.seq, "SW", "SAM", "26", "0001"), "JO-001-SW-SAM-26-0001");
	assert.equal(formatJobOrderNo(year27.seq, "SW", "SAM", "27", "0001"), "JO-001-SW-SAM-27-0001");
	const sql = readFileSync(repo("supabase/p34-release1-2026-10-28.sql"), "utf8");
	const rollback = readFileSync(repo("supabase/p34-release1-2026-10-28-rollback.sql"), "utf8");
	assert.equal(sql.includes("next_job_order_seq_for_year"), true);
	assert.equal(sql.includes("release1_job_order_year"), true);
	assert.equal(sql.includes("ce_release1_award_cancel"), true);
	assert.match(sql, /Approved estimates cannot be changed/);
	assert.equal(rollback.includes("next_job_order_seq_for_year"), true);
	assert.match(rollback, /p30 rollback/);
	const workspace = readFileSync(new URL("./supabase-workspace.ts", import.meta.url), "utf8");
	assert.equal(workspace.includes("next_job_order_seq_for_year"), true);
	assert.equal(workspace.includes("next_job_order_seq"), true);
});

test("cancel is limited to the owner, a sales manager, or an admin, and the seed wires sales approvers", () => {
	const jo = { status: "Approved", ownerId: "sales-1" };
	assert.equal(canCancelJobOrder(jo, { byUserId: "sales-2" }), false);
	assert.equal(canCancelJobOrder(jo, { byUserId: "sales-1" }), true);
	assert.equal(canCancelJobOrder(jo, { byUserId: "sales-2", salesManager: true }), true);
	assert.equal(canCancelJobOrder(jo, { byUserId: "admin-1", admin: true }), true);
	const lists = release1SalesApprovers([
		{ userId: "s1", role: "staff", accountDepartment: "Sales", name: "Test Sales", accountStatus: "active" },
		{ userId: "s2", role: "staff", accountDepartment: "Sales", name: "Test Sales Two", accountStatus: "active" },
		{ userId: "m1", role: "lead", accountDepartment: "Sales", designation: "Sales Manager", name: "Test Sales Manager", accountStatus: "active" },
	]);
	if (!lists) throw new Error("approvers");
	assert.equal(lists.markup[0].userId, "m1");
	assert.equal(lists.proposal[0].backupUserId, "s2");
	assert.equal(lists.jobOrder[0].userId, "m1");
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const handlers = app.slice(app.indexOf("const handleMarkup"), app.indexOf("const openArchived"));
	assert.equal(handlers.includes("window.alert"), false);
	assert.equal(handlers.includes("window.prompt"), false);
	assert.equal(handlers.includes("window.confirm"), false);
	assert.equal(handlers.includes("directCost: markup.directCost"), true);
	assert.equal(handlers.includes("applyAward"), true);
	assert.equal(handlers.includes("applyCancel"), true);
	assert.equal(app.includes('sendRelease1Mail(built.toUserId, "ce-approved"'), true);
	const reason = readFileSync(new URL("../../components/ReasonAsk.jsx", import.meta.url), "utf8");
	assert.equal(reason.includes("window.prompt"), false);
	assert.equal(reason.includes("window.alert"), false);
	assert.equal(reason.includes("window.confirm"), false);
	const step33 = readFileSync(repo("scripts/step33.test.mjs"), "utf8");
	assert.equal(step33.includes("applyAward"), true);
	assert.equal(step33.includes("applyCancel"), true);
	assert.equal(step33.includes("markProposalWon"), false);
});
