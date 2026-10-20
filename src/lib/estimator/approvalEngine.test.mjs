// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
	actorCanDecide,
	approvalEngineOn,
	beginEngineApproval,
	decideApproval,
	fixComment,
	nextEngineRevision,
	openStepIndexes,
	planEdit,
	planRevise,
	planUpdate,
	validateFlowSteps,
} from "./approvalEngine.js";

const NOW = "2026-10-20T02:00:00.000Z";
const STAFF = { actor: "Test Staff", level: "staff" };
const LEAD = { actor: "Test Lead", level: "lead" };
const HEAD = { actor: "Test Head", level: "head" };
const ADMIN = { actor: "Test Admin", level: "admin" };
const OTHER = { actor: "Other Lead", level: "lead" };

const CE_FLOW = {
	mode: "mixed",
	steps: [
		{ id: "ce-1", title: "Prepared by Estimator", role: "staff" },
		{ id: "ce-2", title: "Reviewed by Lead", role: "lead" },
		{ id: "ce-3", title: "Approved by Head", role: "head", isFinal: true },
	],
};

function start(flow, extra = {}) {
	return beginEngineApproval({
		docType: "ce",
		docNo: "CE-100",
		rev: "0",
		owner: "Test Staff",
		actor: "Test Staff",
		userId: "11111111-1111-4111-8111-111111111111",
		now: NOW,
		flow,
		...extra,
	});
}

function sign(approval, who, decision, remarks = "") {
	return decideApproval(approval, { ...who, decision, remarks, now: NOW });
}

test("the flag is on only when approvalEngineV2 is exactly true", () => {
	assert.equal(approvalEngineOn(undefined), false);
	assert.equal(approvalEngineOn({ features: {} }), false);
	assert.equal(approvalEngineOn({ features: { approvalEngineV2: false } }), false);
	assert.equal(approvalEngineOn({ features: { approvalEngineV2: "true" } }), false);
	assert.equal(approvalEngineOn({ features: { approvalEngineV2: true } }), true);
});

test("a blank role cannot be saved", () => {
	const bad = validateFlowSteps([{ id: "x", title: "Review", role: "" }]);
	assert.equal(bad.ok, false);
	assert.equal(bad.message, "A step needs a role.");
	assert.equal(validateFlowSteps(CE_FLOW.steps).ok, true);
});

test("mixed routing with the seeded users, and admin cannot sign", () => {
	const begun = start(CE_FLOW);
	assert.equal(begun.ok, true);
	const approval = begun.approval;
	assert.equal(approval.engine, "v2");
	assert.equal(approval.mode, "mixed");
	assert.equal(approval.steps[0].decision, "prepared");
	assert.equal(approval.steps[0].by, "Test Staff");
	assert.equal(actorCanDecide(approval, STAFF), false);
	assert.equal(actorCanDecide(approval, LEAD), true);
	assert.equal(openStepIndexes(approval).includes(2), false);
	assert.equal(actorCanDecide(approval, ADMIN), false);
	const adminTry = sign(approval, ADMIN, "approve");
	assert.equal(adminTry.ok, false);
	const lead = sign(approval, LEAD, "approve", "looks right");
	assert.equal(lead.ok, true);
	assert.equal(lead.final, false);
	assert.equal(actorCanDecide(lead.approval, HEAD), true);
	assert.equal(actorCanDecide(lead.approval, ADMIN), false);
	const head = sign(lead.approval, HEAD, "approve");
	assert.equal(head.ok, true);
	assert.equal(head.final, true);
	assert.equal(head.approval.status, "accepted");
	assert.equal(head.bumpRev, false);
});

test("sequential opens one step at a time", () => {
	const begun = start({
		mode: "sequential",
		steps: [
			{ id: "ce-1", title: "Prepared by Estimator", role: "staff" },
			{ id: "ce-2", title: "Reviewed by Lead", role: "lead", assigneeName: "Test Lead" },
			{ id: "ce-3", title: "Approved by Head", role: "head", isFinal: true },
		],
	});
	assert.deepEqual(openStepIndexes(begun.approval), [1]);
	const early = sign(begun.approval, HEAD, "approve");
	assert.equal(early.ok, false);
	const lead = sign(begun.approval, LEAD, "approve");
	assert.deepEqual(openStepIndexes(lead.approval), [2]);
	const head = sign(lead.approval, HEAD, "approve");
	assert.equal(head.final, true);
});

test("parallel lets the final approver sign before reviewers, and an open comment blocks them", () => {
	const begun = start({ ...CE_FLOW, mode: "parallel" });
	assert.equal(actorCanDecide(begun.approval, HEAD), true);
	assert.equal(actorCanDecide(begun.approval, LEAD), true);
	const commented = sign(begun.approval, LEAD, "approve-comment", "check the rate");
	assert.equal(commented.approval.comments[0].status, "Open");
	assert.equal(actorCanDecide(commented.approval, HEAD), false);
	const blocked = sign(commented.approval, HEAD, "approve");
	assert.equal(blocked.ok, false);
	assert.match(blocked.reason, /open comments/i);
	const fixed = fixComment(commented.approval, { commentId: commented.approval.comments[0].id, actor: "Test Staff", now: NOW });
	assert.equal(fixed.approval.comments[0].status, "Fixed");
	const head = sign(fixed.approval, HEAD, "approve");
	assert.equal(head.ok, true);
	assert.equal(head.final, true);
});

test("mixed final waits for every reviewer and for fixed comments", () => {
	const flow = {
		mode: "mixed",
		steps: [
			{ id: "p", title: "Prepared by Estimator", role: "staff" },
			{ id: "a", title: "Review A", role: "lead", assigneeName: "Test Lead" },
			{ id: "b", title: "Review B", role: "lead", assigneeName: "Other Lead" },
			{ id: "f", title: "Approved by Head", role: "head", isFinal: true },
		],
	};
	const begun = start(flow);
	const open = openStepIndexes(begun.approval);
	assert.deepEqual(open, [1, 2]);
	assert.equal(actorCanDecide(begun.approval, HEAD), false);
	const note = sign(begun.approval, LEAD, "approve-comment", "hold");
	assert.equal(actorCanDecide(note.approval, OTHER), true);
	const both = sign(note.approval, OTHER, "approve");
	assert.equal(actorCanDecide(both.approval, HEAD), false);
	const fixed = fixComment(both.approval, { commentId: both.approval.comments[0].id, actor: "Test Staff", now: NOW });
	assert.equal(actorCanDecide(fixed.approval, HEAD), true);
	const head = sign(fixed.approval, HEAD, "approve");
	assert.equal(head.final, true);
	const second = sign(begun.approval, LEAD, "approve");
	const again = sign(second.approval, LEAD, "approve");
	assert.equal(again.ok, false);
	assert.match(again.reason, /already signed/i);
});

test("a named owner is taken off the final step and the backup is used", () => {
	const flow = {
		mode: "sequential",
		steps: [
			{ id: "1", title: "Prepared by Estimator", role: "staff" },
			{ id: "2", title: "Reviewed by Lead", role: "lead", assigneeName: "Test Lead" },
		],
		final: { role: "head", title: "Final", assigneeName: "Test Staff" },
		backup: { role: "head", title: "Backup", assigneeName: "Test Head" },
	};
	const begun = start(flow);
	assert.equal(begun.ok, true);
	const final = begun.approval.steps.find((step) => step.isFinal);
	assert.equal(final.assigneeName, "Test Head");
	assert.equal(actorCanDecide(begun.approval, HEAD), false);
	const missing = start({ ...flow, backup: null });
	assert.equal(missing.ok, false);
	assert.equal(missing.message, "The owner cannot approve this document, and no backup is set.");
	const alsoOwner = start({ ...flow, backup: { role: "head", assigneeName: "Test Staff" } });
	assert.equal(alsoOwner.ok, false);
});

test("a later admin edit does not change an in-flight snapshot", () => {
	const steps = CE_FLOW.steps.map((step) => ({ ...step }));
	const begun = start({ mode: "mixed", steps });
	steps[1].title = "Changed after start";
	steps.push({ id: "extra", title: "Extra", role: "head" });
	assert.equal(begun.approval.flowSnapshot.steps[1].title, "Reviewed by Lead");
	assert.equal(begun.approval.flowSnapshot.steps.length, 3);
	assert.equal(begun.approval.steps[1].title, "Reviewed by Lead");
});

test("legacy approvals are not decided here, and reject is refused", () => {
	assert.equal(decideApproval({ status: "in-progress", steps: [] }, { decision: "accept" }), null);
	assert.equal(fixComment({ status: "in-progress" }, {}), null);
	const begun = start(CE_FLOW);
	const rejected = sign(begun.approval, LEAD, "reject", "no");
	assert.equal(rejected.ok, false);
	assert.equal(rejected.reason, "Reject is not available.");
});

test("request edit does not advance, and edit keeps the number and clears signatures", () => {
	const begun = start({ ...CE_FLOW, mode: "sequential" });
	const asked = sign(begun.approval, LEAD, "request-edit", "fix the qty");
	assert.equal(asked.ok, true);
	assert.equal(asked.editRequested, true);
	assert.equal(asked.approval.status, "edit-requested");
	assert.equal(asked.ceStatus, "For revision");
	assert.equal(asked.approval.steps[1].decision, "");
	assert.equal(asked.approval.comments[0].status, "Open");
	const edited = planEdit(asked.approval, { actor: "Test Staff", now: NOW });
	assert.equal(edited.ok, true);
	assert.equal(edited.approval.docNo, "CE-100");
	assert.equal(edited.approval.rev, "0");
	assert.equal(edited.approval.changeKind, "edit");
	assert.equal(edited.approval.steps[1].decision, "");
	assert.equal(edited.approval.steps[1].by, "");
	assert.equal(edited.approval.status, "in-progress");
	assert.equal(edited.approval.commentLog.length, 1);
});

test("revise keeps the old rev in force until the new one is approved", () => {
	const first = start(CE_FLOW);
	const lead = sign(first.approval, LEAD, "approve");
	const accepted = sign(lead.approval, HEAD, "approve");
	const revised = planRevise({
		approval: accepted.approval,
		rev: "0",
		actor: "Test Staff",
		owner: "Test Staff",
		now: NOW,
		flow: CE_FLOW,
	});
	assert.equal(revised.ok, true);
	assert.equal(revised.issuedRev, "0");
	assert.equal(revised.pendingRev, "01");
	assert.equal(revised.bumpRev, false);
	assert.equal(revised.approval.rev, "01");
	assert.equal(revised.approval.inForce.status, "in-force");
	assert.equal(revised.approval.inForce.rev, "0");
	const againLead = sign(revised.approval, LEAD, "approve");
	const againHead = sign(againLead.approval, HEAD, "approve");
	assert.equal(againHead.final, true);
	assert.equal(againHead.bumpRev, true);
	assert.equal(againHead.revNo, "01");
	assert.equal(againHead.approval.inForce.status, "Superseded");
	assert.equal(nextEngineRevision("01"), "02");
	assert.equal(nextEngineRevision(""), "01");
	assert.equal(nextEngineRevision("0"), "01");
});

test("an update is internal and is not issued", () => {
	const first = planUpdate({ rev: "0", updateCount: 0, docNo: "CE-100", docType: "ce" });
	assert.equal(first.ok, true);
	assert.equal(first.issued, false);
	assert.equal(first.status, "Internal");
	assert.equal(first.label, "Rev 0 - Update 1");
	assert.equal(first.approval.issued, false);
	assert.equal(first.approval.status, "internal");
	const second = planUpdate({ rev: "0", updateCount: first.approval.updateNo });
	assert.equal(second.label, "Rev 0 - Update 2");
});

test("dashboard accept maps to approve only through decideApproval", () => {
	const begun = start({ ...CE_FLOW, mode: "sequential" });
	const lead = sign(begun.approval, LEAD, "accept");
	assert.equal(lead.ok, true);
	assert.equal(lead.approval.steps[1].decision, "approve");
});
