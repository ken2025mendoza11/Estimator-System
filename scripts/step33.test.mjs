import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectTotal } from "../src/lib/estimator/ceTotals.js";
import { containsPrice, createJobOrder, decideJobOrder, jobOrderLines, submitJobOrder, cancelJobOrder, applyAward, applyCancel } from "../src/lib/estimator/jobOrder.js";
import { createMarkup, decideMarkup, submitMarkup } from "../src/lib/estimator/markup.js";
import { createProposal, decideProposal, submitProposal } from "../src/lib/estimator/proposal.js";
import { buildDirectCes } from "./seed-documents.mjs";
import { LOGIN_IDS, RELEASE1_STAGES, SAMPLE_ROLES, buildSampleSet } from "./seed-samples.mjs";

const NOW = "2026-10-28T00:00:00.000Z";
const examples = JSON.parse(readFileSync(new URL("../src/lib/estimator/__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const golden = readFileSync(new URL("../src/lib/estimator/ceTotals.golden.test.mjs", import.meta.url), "utf8");
const directLock = readFileSync(new URL("../src/lib/estimator/ceTotals.direct.test.mjs", import.meta.url), "utf8");
const directTotals = {
	shop: 27362.51,
	onsite: 95682.28,
	trading: 31692.31,
	hybrid: 154737.1,
};

const lists = {
	markup: [{ userId: LOGIN_IDS.lead, backupUserId: LOGIN_IDS.head }],
	proposal: [{ userId: LOGIN_IDS.head, backupUserId: LOGIN_IDS.admin }],
	jobOrder: [{ userId: LOGIN_IDS.lead, backupUserId: LOGIN_IDS.head }],
};

test("the TEST seed has one sample at each Release 1 stage for every role", () => {
	const sample = buildSampleSet();
	for (const role of SAMPLE_ROLES) {
		const tag = role.toUpperCase();
		const rce = sample.docs.find((doc) => doc.id === `SAMPLE-R1-${tag}-RCE`);
		const ce = sample.docs.find((doc) => doc.id === `SAMPLE-R1-${tag}-CE`);
		const markupCe = sample.docs.find((doc) => doc.id === `SAMPLE-R1-${tag}-MARKUP`);
		const markup = sample.docs.find((doc) => doc.kind === "markup" && doc.payload?.ceId === markupCe?.id);
		const proposal = sample.docs.find((doc) => doc.id === `SAMPLE-R1-${tag}-PROPOSAL`);
		const awarded = sample.docs.find((doc) => doc.id === `SAMPLE-R1-${tag}-AWARDED`);
		const won = sample.docs.find((doc) => doc.id === `SAMPLE-R1-${tag}-WON`);
		const orders = (sample.jobOrders || []).filter((row) => row.ownerId === LOGIN_IDS[role]);
		assert.equal(rce?.status, "Accepted", role);
		assert.equal(ce?.status, "Done", role);
		assert.equal(markup?.kind, "markup", role);
		assert.equal(markup.payload.status, "Approved", role);
		assert.equal(markup.payload.directCost, 1000000);
		assert.equal(markup.payload.selling, 2000000);
		assert.equal(markup.payload.timeline[0].who, LOGIN_IDS[role]);
		assert.equal(Object.hasOwn(markupCe.payload.summary, "markup"), false, role);
		assert.equal(proposal?.kind, "proposal", role);
		assert.equal(proposal.payload.status, "Approved");
		assert.equal(proposal.payload.groups[0].direct, 1000000);
		assert.equal(Object.hasOwn(proposal.payload.groups[0], "amount"), false);
		assert.equal(awarded?.status, "Awarded", role);
		assert.equal(Object.hasOwn(awarded.payload.summary, "awardStatus"), false, role);
		assert.equal(Object.hasOwn(awarded.payload.summary, "awardJo"), false, role);
		assert.equal(Object.hasOwn(awarded.payload.summary, "markup"), false, role);
		assert.equal(won?.payload.status, "Won", role);
		assert.equal(orders.length, 2, role);
		assert.equal(orders.some((row) => row.status === "Submitted"), true);
		assert.equal(orders.some((row) => row.status === "Approved"), true);
		const approvedOrder = orders.find((row) => row.status === "Approved");
		assert.equal(approvedOrder.poKind, "PO");
		assert.equal(approvedOrder.award.previousCeStatus[awarded.id], "Done");
		assert.equal(approvedOrder.award.previousProposalStatus, "Approved");
		for (const row of orders) assert.equal(containsPrice(row.ceQuantity), false, row.id);
	}
	assert.equal(RELEASE1_STAGES.length, 6);
});

test("RCE to CE to markup to proposal to job order awards, and cancel restores both", () => {
	const sales = LOGIN_IDS.staff;
	const rce = { id: "RCE-WALK", status: "Accepted" };
	const ce = { id: "CE-WALK", status: "Done", rceId: rce.id };
	const documents = {
		"CE-WALK": {
			ceStatus: "Done",
			status: "Done",
			approval: { status: "accepted" },
			timeline: [],
		},
	};
	assert.equal(rce.status, "Accepted");
	assert.equal(ce.rceId, rce.id);
	const direct = 1000000;
	const created = createMarkup({ ceId: ce.id, byUserId: sales, directCost: direct, preset: "100", now: NOW });
	if (!created.ok || !created.markup) throw new Error(created.message || "markup");
	const submitted = submitMarkup(created.markup, { byUserId: sales, approverLists: lists, now: NOW });
	if (!submitted.ok || !submitted.markup) throw new Error(submitted.message || "submit markup");
	const approvedMarkup = decideMarkup(submitted.markup, { actorId: LOGIN_IDS.lead, decision: "approve", now: NOW });
	if (!approvedMarkup.ok || !approvedMarkup.markup) throw new Error(approvedMarkup.message || "approve markup");
	assert.equal(approvedMarkup.markup.status, "Approved");
	assert.equal(approvedMarkup.markup.directCost, direct);
	assert.equal(approvedMarkup.markup.selling, 2000000);
	assert.equal(approvedMarkup.markup.timeline.at(-1).who, LOGIN_IDS.lead);

	const drafted = createProposal({
		controlNo: "3601",
		byUserId: sales,
		ceId: ce.id,
		ceNo: ce.id,
		ceRev: "0",
		parts: approvedMarkup.markup.parts,
		directCost: approvedMarkup.markup.directCost,
		groups: [{ key: "BOL", label: "BOL", direct }],
		prNo: "PR 26-360801",
		prDate: "2026-10-28",
		clauses: "Pay on award.",
		client: "Sample Client",
		project: "Walk",
		now: NOW,
	});
	if (!drafted.ok || !drafted.proposal) throw new Error(drafted.message || "proposal");
	const submittedProposal = submitProposal(drafted.proposal, { byUserId: sales, approverLists: lists, now: NOW });
	if (!submittedProposal.ok || !submittedProposal.proposal) throw new Error(submittedProposal.message || "submit proposal");
	const approvedProposal = decideProposal(submittedProposal.proposal, { actorId: LOGIN_IDS.head, decision: "approve", now: NOW });
	if (!approvedProposal.ok || !approvedProposal.proposal) throw new Error(approvedProposal.message || "approve proposal");
	assert.equal(approvedProposal.proposal.status, "Approved");
	assert.equal(approvedProposal.proposal.total, 2000000);
	assert.equal(approvedProposal.proposal.direct, direct);
	assert.equal(approvedProposal.proposal.timeline.at(-1).who, LOGIN_IDS.head);

	const draftedJo = createJobOrder({
		byUserId: sales,
		seq: 7,
		type: "SW",
		clientCode: "SAM",
		year: 2026,
		controlNo: approvedProposal.proposal.controlNo,
		ceIds: [ce.id],
		poFileName: "PO-walk.pdf",
		poStoragePath: "job-order/CE-WALK/PO-walk.pdf",
		poKind: "PO",
		dateIssued: "2026-10-28",
		prNo: approvedProposal.proposal.prNo,
		ceQuantity: [{ description: "Welder", qty: 2, unit: "day", rate: 500, amount: 1234.56 }],
		now: NOW,
	});
	if (!draftedJo.ok || !draftedJo.jobOrder) throw new Error(draftedJo.message || "job order");
	assert.equal(containsPrice(draftedJo.jobOrder.ceQuantity), false);
	assert.equal(jobOrderLines(draftedJo.jobOrder).some((line) => line.includes("1234.56") || line.includes("500")), false);
	const submittedJo = submitJobOrder(draftedJo.jobOrder, { byUserId: sales, approverLists: lists, now: NOW });
	if (!submittedJo.ok || !submittedJo.jobOrder) throw new Error(submittedJo.message || "submit job order");
	const approvedJo = decideJobOrder(submittedJo.jobOrder, { actorId: LOGIN_IDS.lead, decision: "approve", now: NOW });
	if (!approvedJo.ok || !approvedJo.jobOrder || !approvedJo.effect?.award) throw new Error("approve job order");
	const awarded = applyAward({
		ces: [ce],
		documents,
		proposal: approvedProposal.proposal,
		effect: approvedJo.effect,
		byUserId: sales,
		now: NOW,
	});
	if (!awarded.ok) throw new Error(awarded.message || "award");
	assert.equal(awarded.ces[0].status, "Awarded");
	assert.equal(Object.hasOwn(awarded.ces[0], "awardStatus"), false);
	assert.equal(Object.hasOwn(awarded.documents["CE-WALK"], "awardJo"), false);
	assert.equal(awarded.documents["CE-WALK"].timeline.at(-1).who, sales);
	assert.equal(awarded.documents["CE-WALK"].timeline.at(-1).action, "Awarded");
	assert.equal(awarded.proposal.status, "Won");
	assert.equal(awarded.proposal.timeline.at(-1).who, sales);
	assert.equal(awarded.award.previousCeStatus["CE-WALK"], "Done");
	assert.equal(awarded.award.previousProposalStatus, "Approved");
	assert.equal(approvedJo.jobOrder.timeline.at(-1).who, LOGIN_IDS.lead);

	const cancelled = cancelJobOrder({ ...approvedJo.jobOrder, award: awarded.award }, { byUserId: sales, remarks: "Client stopped", now: NOW });
	if (!cancelled.ok || !cancelled.effect?.clear) throw new Error(cancelled.message || "cancel");
	const restored = applyCancel({
		ces: awarded.ces,
		documents: awarded.documents,
		proposal: awarded.proposal,
		award: awarded.award,
		byUserId: sales,
		remarks: "Client stopped",
		now: NOW,
	});
	if (!restored.ok) throw new Error(restored.message || "restore");
	assert.equal(restored.ces[0].status, "Done");
	assert.equal(restored.documents["CE-WALK"].ceStatus, "Done");
	assert.equal(restored.documents["CE-WALK"].timeline.at(-1).action, "Award cancelled");
	assert.equal(restored.documents["CE-WALK"].timeline.at(-1).who, sales);
	assert.equal(restored.proposal.status, "Approved");
	assert.equal(restored.proposal.timeline.at(-1).action, "Award cancelled");
	assert.equal(restored.proposal.timeline.at(-1).who, sales);
	assert.equal(cancelled.jobOrder.timeline.at(-1).who, sales);
	const missing = applyAward({
		ces: [],
		documents,
		proposal: approvedProposal.proposal,
		effect: approvedJo.effect,
		byUserId: sales,
		now: NOW,
	});
	assert.equal(missing.ok, false);
	const blank = applyAward({
		ces: [{ id: ce.id, status: "" }],
		documents,
		proposal: approvedProposal.proposal,
		effect: approvedJo.effect,
		byUserId: sales,
		now: NOW,
	});
	assert.equal(blank.ok, false);
});

test("the four direct-v1 totals are unchanged", () => {
	const docs = buildDirectCes(examples);
	assert.equal(docs.length, 4);
	for (const doc of docs) {
		const key = doc.id.replace("CE-EX-", "").toLowerCase();
		assert.equal(projectTotal(doc.tasks, doc.pricing), directTotals[key], doc.id);
	}
	assert.equal(golden.includes("31692.31"), true);
	assert.equal(directLock.includes("27362.51"), true);
	assert.equal(directLock.includes("95682.28"), true);
	assert.equal(directLock.includes("154737.1"), true);
});
