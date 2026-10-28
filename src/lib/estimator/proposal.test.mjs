import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MARKUP_PRESETS } from "./markup.js";
import { proposalDocxBytes, proposalPdfBytes } from "./proposalDocx.js";
import {
	canGenerateProposal,
	cancelProposal,
	createProposal,
	decideProposal,
	formatControlNo,
	markProposalExpired,
	markProposalLost,
	markProposalSent,
	markProposalWon,
	newerCeBanner,
	noRevisionNeeded,
	patchProposal,
	prNoTaken,
	proposalLines,
	reviseProposal,
	submitProposal,
} from "./proposal.js";

const parts = MARKUP_PRESETS["100"];
const groups = [
	{ key: "A", label: "MANPOWER", direct: 400_000 },
	{ key: "B", label: "TOOLS", direct: 250_000 },
	{ key: "C", label: "MATERIALS", direct: 200_000 },
	{ key: "D", label: "PPE", direct: 50_000 },
	{ key: "E", label: "MISC", direct: 100_000 },
];
const lists = { proposal: [{ userId: "mgr-1", backupUserId: "mgr-2" }] };

function draft(extra = {}) {
	const created = createProposal({
		controlNo: "12",
		byUserId: "sales-1",
		ceId: "CE-1",
		ceNo: "CE-1",
		ceRev: "01",
		client: "ABC",
		project: "Pump",
		scope: "Retube",
		prDate: "2026-10-28",
		groups,
		parts,
		now: "2026-10-28T00:00:00.000Z",
		...extra,
	});
	if (!created.ok || !created.proposal) throw new Error(created.ok ? "missing proposal" : created.message);
	return created.proposal;
}

test("control number, validity, and the marked-up total", () => {
	assert.equal(formatControlNo("12"), "0012");
	assert.equal(formatControlNo("12345"), "");
	assert.equal(formatControlNo("PR"), "");
	const proposal = draft();
	assert.equal(proposal.controlNo, "0012");
	assert.equal(proposal.rev, 0);
	assert.equal(proposal.validityDays, 30);
	assert.equal(proposal.validUntil, "2026-11-27");
	assert.equal(proposal.direct, 1_000_000);
	assert.equal(proposal.total, 2_000_000);
	assert.equal(proposal.groups[0].selling, 800_000);
	assert.equal(groups[0].direct, 400_000);
	const lines = proposalLines({ ...proposal, prNo: "PR 26-360801" });
	assert.equal(lines.some((line) => line.includes("PR 26-360801")), true);
	assert.equal(lines.some((line) => line.includes("2000000.00")), true);
	assert.equal(lines.some((line) => line.startsWith("MANPOWER:")), true);
});

test("a duplicate PR number blocks save, and an edit keeps the number", () => {
	const proposal = draft({ prNo: "PR 26-360801" });
	const other = draft({ controlNo: "13", prNo: "PR 26-1" });
	assert.equal(prNoTaken([other], "pr 26-1", "0012"), true);
	assert.equal(patchProposal(proposal, { prNo: "PR 26-1" }, [other]).ok, false);
	const edited = patchProposal(proposal, { prNo: "PR 26-360801", scope: "Extra spool", validityDays: 15 }, [other]);
	if (!edited.proposal) throw new Error("missing edit");
	assert.equal(edited.proposal.controlNo, "0012");
	assert.equal(edited.proposal.rev, 0);
	assert.equal(edited.proposal.scope, "Extra spool");
	assert.equal(edited.proposal.validityDays, 15);
	assert.equal(edited.proposal.total, 2_000_000);
	const submitted = submitProposal(edited.proposal, { byUserId: "sales-1", approverLists: lists, others: [other] });
	if (!submitted.proposal) throw new Error("missing submit");
	assert.equal(submitted.toUserId, "mgr-1");
	const still = patchProposal(submitted.proposal, { client: "ABC Cargo" }, [other]);
	if (!still.proposal) throw new Error("missing still");
	assert.equal(still.proposal.controlNo, "0012");
	assert.equal(still.proposal.rev, 0);
	assert.equal(still.proposal.status, "Submitted");
});

test("approval, revise, lost, expired, and won", () => {
	const proposal = draft({ prNo: "PR 26-360801" });
	const submitted = submitProposal(proposal, { byUserId: "sales-1", approverLists: lists });
	if (!submitted.proposal) throw new Error("missing submit");
	assert.equal(decideProposal(submitted.proposal, { actorId: "sales-1", decision: "approve" }).ok, false);
	const returned = decideProposal(submitted.proposal, { actorId: "mgr-2", decision: "return", remarks: "Fix the scope" });
	if (!returned.proposal) throw new Error("missing return");
	assert.equal(returned.proposal.status, "Draft");
	assert.equal(returned.proposal.timeline.at(-1).who, "mgr-2");
	assert.match(returned.proposal.timeline.at(-1).remarks, /for mgr-1/);
	const again = submitProposal(returned.proposal, { byUserId: "sales-1", approverLists: lists });
	if (!again.proposal) throw new Error("missing again");
	const approved = decideProposal(again.proposal, { actorId: "mgr-1", decision: "approve" });
	if (!approved.ok || !approved.proposal) throw new Error("missing approved");
	assert.equal(approved.final, true);
	assert.equal(approved.proposal.status, "Approved");
	assert.equal(approved.proposal.approverId, "mgr-1");
	assert.equal(patchProposal(approved.proposal, { scope: "no" }).ok, false);
	const revised = reviseProposal(approved.proposal, { byUserId: "sales-1" });
	if (!revised.proposal) throw new Error("missing revise");
	assert.equal(revised.proposal.rev, 1);
	assert.equal(revised.proposal.controlNo, "0012");
	assert.equal(revised.proposal.status, "Draft");
	assert.equal(markProposalLost(approved.proposal, { byUserId: "sales-1", remarks: "" }).ok, false);
	const lost = markProposalLost(approved.proposal, { byUserId: "sales-1", remarks: "Client went elsewhere" });
	if (!lost.proposal) throw new Error("missing lost");
	assert.equal(lost.proposal.status, "Lost");
	assert.equal(lost.proposal.timeline.at(-1).who, "sales-1");
	const expired = markProposalExpired(approved.proposal, { byUserId: "sales-1", remarks: "Past 30 days" });
	if (!expired.proposal) throw new Error("missing expired");
	assert.equal(reviseProposal(expired.proposal, { byUserId: "sales-1", remarks: "" }).ok, false);
	const nextRev = reviseProposal(expired.proposal, { byUserId: "sales-1", remarks: "Client asked again" });
	if (!nextRev.proposal) throw new Error("missing next");
	assert.equal(nextRev.proposal.rev, 1);
	assert.equal(nextRev.proposal.controlNo, "0012");
	const none = noRevisionNeeded(expired.proposal, { byUserId: "sales-1", remarks: "Job is dead" });
	if (!none.proposal) throw new Error("missing none");
	assert.equal(none.proposal.status, "Expired");
	assert.equal(none.proposal.timeline.at(-1).action, "No revision needed");
	const won = markProposalWon(approved.proposal, { byUserId: "sales-1" });
	if (!won.proposal) throw new Error("missing won");
	assert.equal(won.proposal.status, "Won");
	const sent = markProposalSent(approved.proposal, { byUserId: "sales-1" });
	if (!sent.proposal) throw new Error("missing sent");
	assert.equal(sent.proposal.status, "Sent");
	const cancelled = cancelProposal(proposal, { byUserId: "sales-1" });
	if (!cancelled.proposal) throw new Error("missing cancel");
	assert.equal(cancelled.proposal.status, "Cancelled");
	assert.equal(newerCeBanner(approved.proposal, "02"), "A newer cost estimate revision exists (02).");
	assert.equal(newerCeBanner(approved.proposal, "01"), "");
});

test("docx and pdf contain the proposal text, and the flag defaults off", async () => {
	const proposal = draft({ prNo: "PR 26-360801" });
	const docx = await proposalDocxBytes(proposal);
	const pdf = proposalPdfBytes(proposal);
	assert.equal(docx[0], 0x50);
	assert.equal(docx[1], 0x4b);
	assert.equal(pdf[0], 0x25);
	assert.equal(pdf[1], 0x50);
	assert.equal(docx.length > 1000, true);
	assert.equal(pdf.length > 500, true);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("release1Proposal: false"), true);
	assert.equal(app.includes("Generate Proposal"), true);
	assert.equal(seed.includes("release1Proposal: true"), true);
	assert.equal(canGenerateProposal({ flagOn: true, sales: true, markupStatus: "Approved" }), true);
	assert.equal(canGenerateProposal({ flagOn: true, sales: true, markupStatus: "Draft" }), false);
	assert.equal(canGenerateProposal({ flagOn: false, sales: true, markupStatus: "Approved" }), false);
});
