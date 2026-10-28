import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	acceptSalesCeRequest,
	actorMayAcceptCeRequest,
	costingApproverForRequest,
	planSalesCeRequest,
	rceWithdrawAllowed,
	withdrawLog,
} from "./ceRequest.js";

const users = [
	{ userId: "sales-1", name: "Sales One", accountDepartment: "Sales" },
	{ userId: "cost-1", name: "Cost One", accountDepartment: "Cost Estimating" },
	{ userId: "cost-2", name: "Cost Two", accountDepartment: "Cost Estimating" },
];

const lists = {
	markup: [
		{ userId: "sales-1", backupUserId: "" },
		{ userId: "cost-1", backupUserId: "cost-2" },
	],
};

/** @param {any[]} steps @param {string} [status] */
function submitted(steps, status = "For approval") {
	return { status, approval: { status: "in-progress", engine: "v2", steps } };
}

test("withdraw stays open after a first approval and closes when the final approver approves", () => {
	const midway = submitted([
		{ role: "staff", decision: "prepared" },
		{ role: "lead", decision: "approve", isFinal: false },
		{ role: "head", decision: "", isFinal: true },
	]);
	assert.equal(rceWithdrawAllowed(midway, false), false);
	assert.equal(rceWithdrawAllowed(midway, true), true);
	const legacy = {
		status: "For approval",
		approval: {
			status: "in-progress",
			steps: [{ decision: "prepared" }, { decision: "accept" }, { decision: "", isFinal: true }],
		},
	};
	assert.equal(rceWithdrawAllowed(legacy, false), false);
	assert.equal(rceWithdrawAllowed(legacy, true), true);
	const done = submitted([
		{ role: "staff", decision: "prepared" },
		{ role: "lead", decision: "approve", isFinal: false },
		{ role: "head", decision: "approve", isFinal: true },
	], "Accepted");
	assert.equal(rceWithdrawAllowed(done, true), false);
	assert.equal(rceWithdrawAllowed({ status: "Pending" }, true), true);
	assert.equal(rceWithdrawAllowed({ status: "For approval" }, true), true);
	assert.equal(rceWithdrawAllowed({ status: "Rejected" }, true), true);
	assert.equal(rceWithdrawAllowed({ status: "For revision" }, true), true);
	assert.equal(rceWithdrawAllowed({ status: "Draft" }, true), false);
	assert.equal(rceWithdrawAllowed({ status: "" }, true), false);
	assert.equal(rceWithdrawAllowed({ status: "Cancelled", approval: { status: "in-progress" } }, true), false);
	assert.equal(rceWithdrawAllowed(null, true), false);
});

test("withdraw and the sales request are logged by account id and sales cannot edit", () => {
	assert.equal(withdrawLog({ who: "", remarks: "stop" }).ok, false);
	assert.equal(withdrawLog({ who: "sales-1", remarks: "  " }).ok, false);
	const logged = withdrawLog({ who: "sales-1", remarks: "Client pulled the job" });
	if (!logged.entry) throw new Error("missing withdraw entry");
	assert.equal(logged.ok, true);
	assert.equal(logged.entry.who, "sales-1");
	assert.equal(logged.entry.action, "Withdrawn");
	const approver = costingApproverForRequest({ approverLists: lists, users, departmentsOn: true });
	assert.equal(approver.userId, "cost-1");
	assert.equal(approver.backupUserId, "cost-2");
	const planned = planSalesCeRequest({
		kind: "revision",
		remark: "Price the extra spool",
		byUserId: "sales-1",
		approver,
	});
	if (!planned.request || !planned.entry) throw new Error("missing request");
	assert.equal(planned.ok, true);
	assert.equal(planned.salesMayEdit, false);
	assert.equal(planned.request.toUserId, "cost-1");
	assert.equal(planned.entry.who, "sales-1");
	assert.equal(Object.hasOwn(planned.request, "tasks"), false);
	assert.equal(actorMayAcceptCeRequest(planned.request, "sales-1"), false);
	assert.equal(actorMayAcceptCeRequest(planned.request, "cost-2"), true);
	const refused = acceptSalesCeRequest({ request: planned.request, actorId: "sales-1" });
	assert.equal(refused.ok, false);
	assert.equal(refused.salesMayEdit, false);
	const accepted = acceptSalesCeRequest({
		request: planned.request,
		actorId: "cost-1",
		owner: "Estimator",
		approval: { rev: "01", status: "accepted", engine: "v2" },
		flow: {
			mode: "sequential",
			steps: [
				{ role: "staff", title: "Prepared by Estimator" },
				{ role: "head", title: "Approved by Head", isFinal: true },
			],
		},
	});
	if (!accepted.approval) throw new Error("missing approval");
	assert.equal(accepted.ok, true);
	assert.equal(accepted.next, "revision");
	assert.equal(accepted.salesMayEdit, false);
	assert.equal(accepted.entry.who, "cost-1");
	assert.equal(accepted.approval.changeKind, "revise");
	assert.equal(accepted.approval.status, "in-progress");
	const fresh = planSalesCeRequest({ kind: "new", remark: "Split the shop work", byUserId: "sales-1", approver });
	if (!fresh.request) throw new Error("missing new request");
	const opened = acceptSalesCeRequest({ request: fresh.request, actorId: "cost-1" });
	assert.equal(opened.ok, true);
	assert.equal(opened.next, "new-ce");
	assert.equal(opened.salesMayEdit, false);
	assert.equal(opened.approval, undefined);
	assert.equal(planSalesCeRequest({ kind: "revision", remark: "again", byUserId: "sales-1", approver, existing: planned.request }).ok, false);
	assert.equal(planSalesCeRequest({ kind: "revision", remark: "", byUserId: "sales-1", approver }).ok, false);
});

test("the flag defaults off and the test seed turns it on", () => {
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("release1WithdrawRequest: false"), true);
	assert.equal(app.includes("release1WithdrawRequestOn"), true);
	assert.equal(app.includes("Request revision"), true);
	assert.equal(app.includes("Request new CE"), true);
	assert.equal(seed.includes("release1WithdrawRequest: true"), true);
	assert.equal(app.includes('s.decision === "approve"'), true);
});
