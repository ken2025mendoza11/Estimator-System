import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatJobOrderNo } from "./docNumbers.js";
import {
	canGenerateJobOrder,
	cancelJobOrder,
	containsPrice,
	createJobOrder,
	decideJobOrder,
	jobOrderLines,
	patchJobOrder,
	reviseJobOrder,
	submitJobOrder,
} from "./jobOrder.js";

const lists = { jobOrder: [{ userId: "mgr-1", backupUserId: "mgr-2" }] };
const ce = {
	tasks: [{
		title: "Retube",
		subtasks: [{
			items: {
				BOL: [{ role: "Welder", qty: 2, days: 3, rate: 500, unitCost: 80.5 }],
				BOCM: [{ description: "Tube", qty: 10, unit: "pc", unitCost: 1234.56, amount: 12345.6 }],
			},
		}],
	}],
};

function draft() {
	const created = createJobOrder({
		byUserId: "sales-1",
		seq: 7,
		type: "SW",
		clientCode: "abc",
		year: 2026,
		controlNo: "0012",
		ceIds: ["CE-1"],
		client: "ABC",
		project: "Pump",
		prNo: "PR 26-360801",
		poRef: "PO-9",
		salesPosition: "Sales Rep",
		inCharge: "Engr Cruz",
		inChargePosition: "Site lead",
		clientContact: "Mr Tan",
		clientContactPosition: "Manager",
		duration: "30 days",
		dateIssued: "2026-10-28",
		ceQuantity: ce,
		now: "2026-10-28T00:00:00.000Z",
	});
	if (!created.ok || !created.jobOrder) throw new Error(created.ok ? "missing" : created.message);
	return created.jobOrder;
}

test("the job order number and revision", () => {
	assert.equal(formatJobOrderNo(7, "sw", "abc", 2026, "0012"), "JO-007-SW-ABC-26-0012");
	assert.equal(formatJobOrderNo(7, "SW", "ABC", 2026, "0012", 1), "JO-007-SW-ABC-26-0012REV001");
	assert.equal(formatJobOrderNo(7, "ZZ", "ABC", 2026, "0012"), "");
	const jo = draft();
	assert.equal(jo.joNo, "JO-007-SW-ABC-26-0012");
	assert.equal(jo.rev, 0);
	assert.equal(jo.joNo.includes("REV"), false);
	const revised = reviseJobOrder({ ...jo, status: "Approved", finalApproved: true }, { byUserId: "sales-1" });
	if (!revised.ok || !revised.jobOrder) throw new Error("missing revise");
	assert.equal(revised.jobOrder.joNo, "JO-007-SW-ABC-26-0012REV001");
	assert.equal(revised.jobOrder.seq, 7);
	assert.equal(revised.jobOrder.status, "Draft");
});

test("no prices on the job order, the text, or the quantity attachment", () => {
	const jo = draft();
	const lines = jobOrderLines(jo).join("\n");
	assert.equal(lines.includes("500"), false);
	assert.equal(lines.includes("1234.56"), false);
	assert.equal(lines.includes("80.5"), false);
	assert.equal(containsPrice(jo.ceQuantity), false);
	assert.equal(containsPrice(lines), false);
	const qty = JSON.stringify(jo.ceQuantity);
	assert.equal(qty.includes("Welder"), true);
	assert.equal(qty.includes("\"qty\":2"), true);
	assert.equal(qty.includes("rate"), false);
	assert.equal(qty.includes("unitCost"), false);
	assert.equal(qty.includes("amount"), false);
	assert.equal(qty.includes("500"), false);
	assert.equal(qty.includes("1234.56"), false);
});

test("approval awards the estimate and the proposal, and cancel clears both", () => {
	let jo = draft();
	assert.equal(submitJobOrder(jo, { byUserId: "sales-1", approverLists: lists }).ok, false);
	jo = patchJobOrder(jo, { poFileName: "PO-9.pdf", poKind: "PO", poStoragePath: "job-order/JO-007/PO-9.pdf" }).jobOrder;
	const edited = patchJobOrder(jo, { duration: "45 days" });
	if (!edited.jobOrder) throw new Error("missing edit");
	assert.equal(edited.jobOrder.joNo, jo.joNo);
	assert.equal(edited.jobOrder.rev, 0);
	const submitted = submitJobOrder(edited.jobOrder, { byUserId: "sales-1", approverLists: lists });
	if (!submitted.ok || !submitted.jobOrder) throw new Error("missing submit");
	assert.equal(submitted.toUserId, "mgr-1");
	const approved = decideJobOrder(submitted.jobOrder, { actorId: "mgr-2", decision: "approve", approverName: "Sales Manager" });
	if (!approved.ok || !approved.jobOrder) throw new Error("missing approve");
	assert.equal(approved.final, true);
	assert.equal(approved.jobOrder.approverFor, "for Sales Manager");
	assert.equal(approved.jobOrder.timeline.at(-1).who, "mgr-2");
	assert.equal(approved.effect?.award, true);
	assert.deepEqual(approved.effect?.ceIds, ["CE-1"]);
	assert.equal(approved.effect?.proposalControl, "0012");
	assert.equal(patchJobOrder(approved.jobOrder, { duration: "1 day" }).ok, false);
	assert.equal(cancelJobOrder(approved.jobOrder, { byUserId: "sales-1", remarks: "" }).ok, false);
	const cancelled = cancelJobOrder(approved.jobOrder, { byUserId: "sales-1", remarks: "Client stopped" });
	if (!cancelled.ok || !cancelled.jobOrder) throw new Error("missing cancel");
	assert.equal(cancelled.jobOrder.status, "Cancelled");
	assert.equal(cancelled.effect?.clear, true);
	assert.equal(cancelled.jobOrder.timeline.at(-1).who, "sales-1");
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("release1JobOrder: false"), true);
	assert.equal(app.includes("Generate Job Order"), true);
	assert.equal(seed.includes("release1JobOrder: true"), true);
	assert.equal(canGenerateJobOrder({ flagOn: true, sales: true, proposalStatus: "Approved" }), true);
	assert.equal(canGenerateJobOrder({ flagOn: true, sales: true, proposalStatus: "Draft" }), false);
});
