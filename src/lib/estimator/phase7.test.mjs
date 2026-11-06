// @ts-nocheck
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import nspell from "nspell";
import { blocksFinalApproval, canSubmit, runChecker, versionWithReport } from "./checker.js";

const require = createRequire(import.meta.url);
const dictDir = dirname(require.resolve("dictionary-en"));
const spell = nspell({
	aff: readFileSync(join(dictDir, "index.aff"), "utf8"),
	dic: readFileSync(join(dictDir, "index.dic"), "utf8")
});
const quiet = { correct: () => true, suggest: () => [] };

function task(extra) {
	return {
		id: "t1",
		title: "Tank",
		workType: "shop",
		subtasks: [{
			id: "s1",
			title: "Scope",
			items: { BOL: [], BOTE: [], BOCM: [], PPE: [], MISC: [] },
			...extra
		}]
	};
}

test("existing preflight messages stay, and a nested line is checked", () => {
	const nested = task();
	nested.subtasks[0].children = [{
		id: "s2",
		title: "Child",
		items: { BOTE: [{ id: "i1", description: "Grinder", qty: 1, days: 2, rate: 0, powerKw: 1 }] }
	}];
	const report = runChecker({ tasks: [nested], rceId: "RCE-1", rceAccepted: true, spell: quiet });
	assert.equal(report.errors.some((row) => row.message === "Zero rate — Grinder / Rate/Day"), true);
	assert.equal(report.errors.some((row) => row.message === "Unpriced line “Grinder”."), true);
	const src = readFileSync(new URL("./checker.js", import.meta.url), "utf8");
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	[
		"Shop/Trading tool",
		"No priced line in the breakdown.",
		"No-quote requires a reason.",
		"Linked RCE is not accepted by the Final approver.",
		"Ad-hoc line",
		"missing"
	].forEach((phrase) => {
		assert.equal(src.includes(phrase), true, phrase);
		assert.equal(app.includes(phrase), true, phrase);
	});
	assert.match(app, /checkerV2: src\.features\?\.checkerV2 === true/);
	assert.match(app, /buildCePreflight\(state\.tasks, preflightOpts\)/);
	assert.match(app, /if \(!checkerOn\) saveVersion\(\)/);
	const totals = readFileSync(new URL("./ceTotals.js", import.meta.url), "utf8");
	assert.match(totals, /var calcBOTE = \(i, workType\) => \{\s*const use = num2\(i\.qty\) \* num2\(i\.days\) \* num2\(i\.rate\);/);
});

test("errors block submit, warnings need a reason, and info does not", () => {
	const blocked = { errors: [{ message: "x" }], warnings: [], info: [] };
	assert.equal(canSubmit(blocked, { checked: true, reason: "because" }).ok, false);
	assert.equal(blocksFinalApproval(blocked), true);
	const warn = { errors: [], warnings: [{ message: "y" }], info: [{ message: "z" }] };
	assert.equal(canSubmit(warn, { checked: true, reason: "" }).ok, false);
	assert.equal(canSubmit(warn, { checked: true, reason: "still valid" }).ok, true);
	assert.equal(blocksFinalApproval(warn), false);
	const stored = versionWithReport({ timestamp: "2026-10-20T00:00:00.000Z", tasks: [] }, warn, { reason: "still valid" });
	assert.equal(stored.checker.ackReason, "still valid");
	assert.equal(stored.checker.warnings, 1);
});

test("step 6 warnings, unit, range, onsite per diem, and direct mismatch", () => {
	const row = task();
	row.workType = "";
	row.subtasks[0].items.BOL = [{ id: "b1", role: "Rigger", qty: 1, days: 2, rate: 700, perDiem: "" }];
	row.subtasks[0].items.BOTE = [{ id: "e1", description: "Generator", qty: 1, days: 1, rate: 1500, powerKw: 20 }];
	row.subtasks[0].items.MISC = [{ id: "m1", description: "Van", qty: "abc", days: "", unitCost: 100 }];
	row.subtasks[0].items.BOCM = [{ id: "c1", description: "Rod", qty: 1, unit: "furlong", unitCost: 12 }];
	const report = runChecker({
		tasks: [row],
		rceId: "RCE-1",
		rceAccepted: true,
		spell: quiet,
		pricing: { model: "direct-v1", formula: {} },
		summaryTotal: 1,
		checker: { ranges: { qty: 1000, days: 366, rate: 100, unitCost: 10000000, perDiem: 5000, otHrs: 24, powerKw: 500 } }
	});
	const messages = report.findings.map((item) => item.message);
	assert.equal(messages.some((item) => item.includes("Work type is blank")), true);
	assert.equal(messages.some((item) => item.includes("power is not costed on site")), true);
	assert.equal(messages.some((item) => item.includes("Per diem rate is missing")), true);
	assert.equal(messages.some((item) => item.includes("blank days")), true);
	assert.equal(messages.some((item) => item.includes("is not a number")), true);
	assert.equal(messages.some((item) => item.includes("not a known unit")), true);
	assert.equal(messages.some((item) => item.includes("outside 0–100")), true);
	assert.equal(report.errors.some((item) => item.rule === "direct-mismatch"), true);
	const tuned = runChecker({
		tasks: [row],
		rceId: "RCE-1",
		rceAccepted: true,
		spell: quiet,
		checker: { rules: { step6: { enabled: true, severity: "info" }, "direct-mismatch": { enabled: false } } }
	});
	assert.equal(tuned.info.some((item) => item.rule === "step6"), true);
	assert.equal(tuned.findings.some((item) => item.rule === "direct-mismatch"), false);
});

test("duplicates, near names, and spelling use the dictionary", () => {
	const row = task();
	row.subtasks[0].items.BOTE = [
		{ id: "a", description: "Welding machine", qty: 1, days: 1, rate: 100, powerKw: 1 },
		{ id: "b", description: "Welding machine", qty: 2, days: 1, rate: 100, powerKw: 1 }
	];
	row.subtasks[0].items.BOL = [
		{ id: "l1", role: "Weldor", qty: 1, days: 1, rate: 100, perDiem: 10, dayType: "Regular" },
		{ id: "l2", role: "Weldor", qty: 1, days: 2, rate: 80, perDiem: 10, dayType: "Regular" }
	];
	row.title = "Recieve tank";
	const report = runChecker({
		tasks: [row],
		rceId: "RCE-1",
		rceAccepted: true,
		sowText: "Widgitron",
		spell,
		dictionary: ["Widgitron"],
		db: { BOL: [{ id: "db1", label: "Welder" }], BOTE: [{ id: "db2", label: "Widgitron" }] }
	});
	const dup = report.errors.find((item) => item.rule === "duplicate");
	assert.ok(dup);
	assert.equal(dup.action, "merge");
	assert.equal(dup.keepId, "a");
	assert.equal(dup.dropId, "b");
	assert.equal(dup.nextQty, 3);
	assert.equal(report.warnings.some((item) => item.rule === "activity"), true);
	const near = report.warnings.find((item) => item.rule === "near-name");
	assert.equal(near.action, "use-db");
	assert.equal(near.dbLabel, "Welder");
	assert.equal(report.warnings.some((item) => item.word === "Recieve"), true);
	assert.equal(report.warnings.some((item) => item.word === "Widgitron"), false);
});
