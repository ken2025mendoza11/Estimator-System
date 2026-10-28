import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	MARKUP_PRESETS,
	actorMayDecideMarkup,
	applyMarkupPreset,
	canGenerateMarkup,
	createMarkup,
	decideMarkup,
	readDirectCost,
	sellingFromDirect,
	setMarkupParts,
	submitMarkup,
	totalPercent,
} from "./markup.js";

const lists = {
	markup: [
		{ userId: "mgr-1", backupUserId: "mgr-2" },
		{ userId: "head-1", backupUserId: "" },
	],
};

test("presets and a 1,000,000 direct cost", () => {
	assert.deepEqual(MARKUP_PRESETS["100"], { profit: 35, contingency: 15, markup: 50 });
	assert.deepEqual(MARKUP_PRESETS["75"], { profit: 35, contingency: 10, markup: 30 });
	assert.deepEqual(MARKUP_PRESETS["65"], { profit: 35, contingency: 10, markup: 20 });
	assert.equal(totalPercent(MARKUP_PRESETS["100"]), 100);
	assert.equal(totalPercent(MARKUP_PRESETS["75"]), 75);
	assert.equal(totalPercent(MARKUP_PRESETS["65"]), 65);
	assert.equal(sellingFromDirect(1_000_000, MARKUP_PRESETS["100"]), 2_000_000);
	assert.equal(sellingFromDirect(1_000_000, MARKUP_PRESETS["75"]), 1_750_000);
	assert.equal(sellingFromDirect(1_000_000, MARKUP_PRESETS["65"]), 1_650_000);
});

test("direct cost is read from totals and is not recomputed when percents change", () => {
	const buckets = { MOB: 100, DEMOB: 50, BOL: 200, BOTE: 10, BOCM: 20, PPE: 5, MISC: 15, contingency: 999 };
	assert.equal(readDirectCost(buckets), 400);
	assert.equal(buckets.contingency, 999);
	assert.equal(readDirectCost(1_000_000), 1_000_000);
	assert.equal(readDirectCost({ official: 1_000_000 }), 1_000_000);
	const created = createMarkup({ ceId: "CE-1", byUserId: "sales-1", directCost: 1_000_000, preset: "100", now: "2026-10-28T00:00:00.000Z" });
	if (!created.markup) throw new Error("missing markup");
	assert.equal(created.markup.selling, 2_000_000);
	assert.equal(created.markup.timeline[0].who, "sales-1");
	assert.equal(created.markup.timeline[0].action, "Markup created");
	const edited = setMarkupParts(created.markup, { profit: 40, contingency: 10, markup: 20 });
	if (!edited.markup) throw new Error("missing edited");
	assert.equal(edited.markup.directCost, 1_000_000);
	assert.equal(edited.markup.preset, "");
	assert.equal(totalPercent(edited.markup.parts), 70);
	assert.equal(edited.markup.selling, 1_700_000);
	const again = applyMarkupPreset(edited.markup, "65");
	if (!again.markup) throw new Error("missing preset");
	assert.equal(again.markup.directCost, 1_000_000);
	assert.equal(again.markup.selling, 1_650_000);
	assert.equal(again.markup.preset, "65");
});

test("markup approval uses the admin list and logs the account id", () => {
	const created = createMarkup({ ceId: "CE-1", byUserId: "sales-1", totals: { total: 1_000_000 }, preset: "75" });
	if (!created.markup) throw new Error("missing markup");
	assert.equal(submitMarkup(created.markup, { byUserId: "other", approverLists: lists }).ok, false);
	assert.equal(submitMarkup(created.markup, { byUserId: "sales-1", approverLists: { markup: [] } }).ok, false);
	const submitted = submitMarkup(created.markup, { byUserId: "sales-1", approverLists: lists, now: "2026-10-28T01:00:00.000Z" });
	if (!submitted.markup) throw new Error("missing submit");
	assert.equal(submitted.ok, true);
	assert.equal(submitted.toUserId, "mgr-1");
	assert.equal(submitted.markup.status, "For approval");
	assert.equal(submitted.markup.selling, 1_750_000);
	assert.equal(setMarkupParts(submitted.markup, { profit: 1, contingency: 1, markup: 1 }).ok, false);
	assert.equal(actorMayDecideMarkup(submitted.markup, "sales-1"), false);
	assert.equal(actorMayDecideMarkup(submitted.markup, "mgr-2"), true);
	assert.equal(decideMarkup(submitted.markup, { actorId: "mgr-2", decision: "return", remarks: "" }).ok, false);
	const returned = decideMarkup(submitted.markup, { actorId: "mgr-2", decision: "return", remarks: "Lower the margin", now: "2026-10-28T02:00:00.000Z" });
	if (!returned.markup) throw new Error("missing return");
	assert.equal(returned.markup.status, "Returned");
	assert.equal(returned.markup.steps[0].byUserId, "mgr-2");
	assert.equal(returned.markup.steps[0].forUserId, "mgr-1");
	assert.match(returned.markup.timeline.at(-1).remarks, /for mgr-1/);
	assert.equal(returned.markup.timeline.at(-1).who, "mgr-2");
	const resubmitted = submitMarkup(returned.markup, { byUserId: "sales-1", approverLists: lists, parts: MARKUP_PRESETS["65"] });
	if (!resubmitted.markup) throw new Error("missing resubmit");
	assert.equal(resubmitted.markup.selling, 1_650_000);
	assert.equal(resubmitted.markup.directCost, 1_000_000);
	const mid = decideMarkup(resubmitted.markup, { actorId: "mgr-1", decision: "approve" });
	if (!mid.markup) throw new Error("missing mid");
	assert.equal(mid.markup.status, "For approval");
	assert.equal(mid.toUserId, "head-1");
	assert.equal(mid.markup.timeline.at(-1).who, "mgr-1");
	const done = decideMarkup(mid.markup, { actorId: "head-1", decision: "approve" });
	if (!done.markup) throw new Error("missing done");
	assert.equal(done.final, true);
	assert.equal(done.markup.status, "Approved");
	assert.equal(done.markup.directCost, 1_000_000);
	assert.equal(setMarkupParts(done.markup, MARKUP_PRESETS["100"]).ok, false);
});

test("generate shows only for Sales on an approved CE, and the flag defaults off", () => {
	assert.equal(canGenerateMarkup({ flagOn: true, sales: true, status: "Done" }), true);
	assert.equal(canGenerateMarkup({ flagOn: true, sales: true, status: "Accepted" }), true);
	assert.equal(canGenerateMarkup({ flagOn: true, sales: true, status: "Awarded" }), true);
	assert.equal(canGenerateMarkup({ flagOn: true, sales: true, status: "For approval" }), false);
	assert.equal(canGenerateMarkup({ flagOn: true, sales: true, status: "Draft" }), false);
	assert.equal(canGenerateMarkup({ flagOn: true, sales: false, status: "Done" }), false);
	assert.equal(canGenerateMarkup({ flagOn: false, sales: true, status: "Done" }), false);
	assert.equal(canGenerateMarkup({ flagOn: true, sales: true, status: "Done", existing: { status: "Draft" } }), false);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	const src = readFileSync(new URL("./markup.js", import.meta.url), "utf8");
	assert.equal(app.includes("release1Markup: false"), true);
	assert.equal(app.includes("Generate Markup"), true);
	assert.equal(seed.includes("release1Markup: true"), true);
	assert.equal(src.includes("ceTotals"), false);
	assert.equal(src.includes("projectTotal"), false);
});
