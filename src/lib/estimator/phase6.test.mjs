// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boteLineSnapshot, equipmentRateCard, legacyBoteAmount, perDayRate } from "./equipmentRates.js";
import { mobileApprove, mobileCanApprove, mobileSummary } from "./mobileView.js";
import { evaluateFormula } from "./rateFormula.js";
import { accuracy, buildReport, reportSheet, winRate } from "./reports.js";

const ITEM = {
	id: "eq-1",
	description: "Welding machine",
	cost: 100000,
	life: 5,
	salvage: 10000,
	hours: 8,
	days: 20,
	maintenance: 10,
	rental: 15
};

test("the rate parser accepts the four formulas and refuses eval", () => {
	const hour = evaluateFormula("(cost - salvage) / life / hours * (1 + maintenance / 100)", ITEM);
	assert.equal(hour.ok, true);
	assert.equal(Math.round(hour.value * 100) / 100, 2475);
	assert.equal(evaluateFormula("cost + unknown", ITEM).ok, false);
	assert.equal(evaluateFormula("cost()", ITEM).ok, false);
	assert.equal(evaluateFormula("life / 0", { ...ITEM, life: 0 }).ok, false);
	const src = readFileSync(new URL("./rateFormula.js", import.meta.url), "utf8");
	assert.equal(/\beval\s*\(/.test(src), false);
	assert.equal(/new Function/.test(src), false);
});

test("manual override wins, and a new line stores a per-day snapshot", () => {
	const formula = {
		version: 3,
		hour: "(cost - salvage) / life / hours * (1 + maintenance / 100)",
		day: "(cost - salvage) / life * (1 + maintenance / 100)",
		rental: "(cost - salvage) / life * (1 + maintenance / 100) * (1 + rental / 100)",
		project: "(cost - salvage) / life * (1 + maintenance / 100) * days"
	};
	const manual = equipmentRateCard({ ...ITEM, rates: { day: { mode: "manual", override: 1500 } } }, formula);
	assert.equal(manual.day.amount, 1500);
	assert.equal(manual.day.source, "manual");
	assert.equal(manual.hour.source, "formula");
	const snap = boteLineSnapshot(ITEM, formula, "hour");
	assert.equal(snap.ok, true);
	assert.equal(snap.rateType, "hour");
	assert.equal(snap.rate, 19800);
	assert.equal(snap.rateVersion, 3);
	assert.equal(snap.rateSnapshot.selected, 2475);
	assert.equal(perDayRate(ITEM, formula, "project"), 19800);
	const old = { qty: 2, days: 3, rate: 100 };
	assert.equal(old.rateType, undefined);
	assert.equal(legacyBoteAmount(old), 600);
});

test("win rate is awarded divided by awarded plus not awarded", () => {
	const rows = [
		{ awardStatus: "Awarded", status: "Done" },
		{ awardStatus: "Awarded", status: "Done" },
		{ awardStatus: "Lost", status: "Done" },
		{ awardStatus: "Not awarded", status: "Done" },
		{ status: "Ongoing" }
	];
	assert.equal(winRate(rows), 0.5);
	assert.equal(winRate([{ status: "Draft" }]), null);
	const report = buildReport([
		{ awardStatus: "Awarded", status: "Done", assignedTo: "Ada", received: "2026-10-01", done: "2026-10-11", amount: 1000, awardAmount: 900 },
		{ awardStatus: "Lost", status: "Done", assignedTo: "Ada", received: "2026-10-01", done: "2026-10-05" },
		{ status: "Ongoing", assignedTo: "Ben" }
	], { bol: 50, bote: 50, bocm: 0, ppe: 0, misc: 0 });
	assert.equal(report.winRate, 0.5);
	assert.equal(report.pipeline.Ongoing, 1);
	assert.equal(report.workload.Ben, 1);
	assert.equal(report.workload.Ada, undefined);
	assert.equal(report.speedDays, 7);
	assert.equal(report.costMix.shares.bol, 0.5);
	assert.ok(Math.abs(accuracy(report && [
		{ awardStatus: "Awarded", amount: 1000, awardAmount: 900 }
	]) - 0.9) < 1e-9);
	const sheet = reportSheet(report);
	assert.equal(sheet[0][0], "Report");
	assert.equal(sheet.some((row) => row[0] === "Win rate" && row[1] === "50%"), true);
});

test("mobile approve uses the step 8 engine and stays read-only without it", () => {
	const summary = mobileSummary({
		kind: "ce",
		id: "CE-2026-001",
		ceList: [{ id: "CE-2026-001", client: "Ada Co", project: "Tank", status: "For approval", assignedTo: "Ben" }],
		documents: {
			"CE-2026-001": {
				approval: {
					engine: "v2",
					status: "in-progress",
					steps: [{ id: "s1", role: "lead", title: "Review", isFinal: true }]
				}
			}
		}
	});
	assert.equal(summary.found, true);
	assert.equal(summary.lines[1][1], "Ada Co");
	assert.equal(mobileCanApprove(summary, "Ida", "lead"), true);
	const decided = mobileApprove(summary, "Ida", "lead", "2026-10-20T00:00:00.000Z");
	assert.equal(decided.ok, true);
	assert.equal(decided.approval.engine, "v2");
	assert.equal(mobileApprove(summary, "Ben", "staff").ok, false);
	const off = mobileSummary({ kind: "ce", id: "missing", ceList: [], documents: {} });
	assert.equal(off.found, false);
	assert.equal(mobileCanApprove(off, "Ida", "lead"), false);
});

test("the app keeps the three flags off and does not change calcBOTE", () => {
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	assert.match(app, /equipmentRates: src\.features\?\.equipmentRates === true/);
	assert.match(app, /reports: src\.features\?\.reports === true/);
	assert.match(app, /mobileViewer: src\.features\?\.mobileViewer === true/);
	const totals = readFileSync(new URL("./ceTotals.js", import.meta.url), "utf8");
	assert.match(totals, /var calcBOTE = \(i, workType\) => \{\s*const use = num2\(i\.qty\) \* num2\(i\.days\) \* num2\(i\.rate\);/);
	const route = readFileSync(new URL("../../routes/view.$kind.$id.tsx", import.meta.url), "utf8");
	assert.match(route, /\/view\/\$kind\/\$id/);
	const tree = readFileSync(new URL("../../routeTree.gen.ts", import.meta.url), "utf8");
	assert.match(tree, /\/view\/\$kind\/\$id/);
});
