import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { issuePdfData } from "../../utils/exportDocuments.js";
import { GO_LIVE_FLAGS, SALES_STAGES, deriveSalesStage, salesPipelineRows, salesWinRate, stageActions } from "./salesStage.js";

test("sales stage is derived for every stage and a Done CE is For markup for its owner", () => {
	assert.equal(SALES_STAGES.length, 10);
	const cases = [
		[{}, "RCE pending"],
		[{ ce: { status: "Ongoing" } }, "CE in progress"],
		[{ ce: { status: "Done" } }, "For markup"],
		[{ ce: { status: "Done" }, markup: { status: "Draft" } }, "For markup"],
		[{ ce: { status: "Done" }, markup: { status: "For approval" } }, "Markup approval"],
		[{ ce: { status: "Done" }, markup: { status: "Approved" } }, "For proposal"],
		[{ ce: { status: "Done" }, markup: { status: "Approved" }, proposal: { status: "Draft" } }, "For proposal"],
		[{ proposal: { status: "For approval" } }, "Proposal approval"],
		[{ proposal: { status: "Sent" } }, "Sent/awaiting"],
		[{ proposal: { status: "Won" } }, "Won"],
		[{ jobOrder: { status: "Approved" } }, "Won"],
		[{ ce: { awardStatus: "Awarded" } }, "Won"],
		[{ proposal: { status: "Lost" } }, "Lost"],
		[{ proposal: { status: "Expired" } }, "Expired"],
	];
	cases.forEach(([input, stage]) => assert.equal(deriveSalesStage(/** @type {any} */ (input)), stage, String(stage)));
	const rows = salesPipelineRows({
		ces: [{ id: "SAMPLE-R1-SALES-READY", ceNo: "SAMPLE-R1-SALES-READY", status: "Done", salesOwnerId: "sales-1", amount: 1000 }],
		ownerId: "sales-1",
	});
	assert.equal(rows.length, 1);
	assert.equal(rows[0].stage, "For markup");
	assert.deepEqual(stageActions("For markup", { owner: true, sales: true }), ["Generate markup"]);
	assert.deepEqual(stageActions("For markup", { sales: true }), []);
	assert.deepEqual(stageActions("For proposal", { manager: true }), ["Generate proposal"]);
	assert.equal(salesWinRate([{ stage: "Won" }, { stage: "Won" }, { stage: "Lost" }, { stage: "For markup" }]), 2 / 3);
	assert.equal(salesWinRate([{ stage: "For markup" }]), null);
	assert.deepEqual(GO_LIVE_FLAGS, ["release1Markup", "release1Proposal", "release1Monitor", "release1WithdrawRequest"]);
});

test("the sidebar title is ESTIMATOR SYSTEM and the CE cover omits contingency", () => {
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const manual = readFileSync(new URL("../../components/SystemManual.jsx", import.meta.url), "utf8");
	assert.equal(app.includes('children: "ESTIMATOR SYSTEM"'), true);
	assert.equal(app.includes('designation: "Cost Estimator"'), true);
	assert.equal(manual.includes("ESTIMATOR SYSTEM"), true);
	const issued = issuePdfData({
		ceNumber: "CE-1",
		cover: { omitContingency: true, contingencyPct: 5, discountPct: 0, grandTotal: 100, netTotal: 100 },
	});
	const cover = issued.sections.find((section) => section.title === "Cover");
	assert.equal(cover.rows.some((/** @type {any} */ row) => row[0] === "Contingency %"), false);
	assert.equal(cover.rows.some((/** @type {any} */ row) => row[0] === "Discount %"), true);
});
