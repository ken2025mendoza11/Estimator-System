// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { brandingVars, cleanBranding } from "./branding.js";
import {
	combinedTotal,
	familyKey,
	missingSuffixRpc,
	nextAddendum,
	nextAlternate,
	nextUpdateCopy,
	parseCeNumber,
	planSuffix,
	reasonAllowed,
	urgentPlan
} from "./docSuffixes.js";
import { foldFamilyRows } from "./monitoringFamilies.js";
import { addWorkingDays, isSunday, isWorkingDay, workingDaysBetween } from "./phCalendar.js";
import { applyLineRates, constantDrift, priceDrifts, resyncPlan } from "./priceCheck.js";
import { bumpScopeUsage, resourceSeed, saveAsScope } from "./scopeLibrary.js";

test("suffixes parse the base number and do not invent a new series", () => {
	const plain = parseCeNumber("CE-2026-001");
	assert.equal(plain.ok, true);
	assert.equal(plain.base, "CE-2026-001");
	assert.equal(plain.letter, "");
	const coded = parseCeNumber("CE-C1-2026-014-B-AD2-U1-R3");
	assert.equal(coded.base, "CE-C1-2026-014");
	assert.equal(coded.letter, "B");
	assert.equal(coded.addendum, 2);
	assert.equal(coded.update, 1);
	assert.equal(coded.revision, 3);
	assert.equal(familyKey("CE-C1-2026-014-B-AD2-U1-R3"), "CE-C1-2026-014");
	assert.equal(familyKey("ce-c1-2026-014"), familyKey("CE-C1-2026-014-A"));
});

test("alternates need a lead or head and a reason, and stop at D", () => {
	assert.equal(nextAlternate({ ids: [], base: "CE-2026-001", level: "staff", reason: "Site change" }).ok, false);
	assert.equal(nextAlternate({ ids: [], base: "CE-2026-001", level: "lead", reason: "  " }).ok, false);
	assert.equal(reasonAllowed("Other", ["Site change"]), false);
	assert.equal(reasonAllowed("site change", ["Site change"]), true);
	const first = nextAlternate({ ids: ["CE-2026-001"], base: "CE-2026-001", level: "head", reason: "Site change" });
	assert.equal(first.id, "CE-2026-001-A");
	const second = nextAlternate({ ids: ["CE-2026-001", first.id], base: "CE-2026-001", level: "admin", reason: "Client option" });
	assert.equal(second.id, "CE-2026-001-B");
	const full = nextAlternate({
		ids: ["CE-2026-001-A", "CE-2026-001-B", "CE-2026-001-C", "CE-2026-001-D-AD1"],
		base: "CE-2026-001",
		level: "lead",
		reason: "Another"
	});
	assert.equal(full.ok, false);
});

test("addendum is only when awarded, and update copies do not take a new serial", () => {
	assert.equal(nextAddendum({ ids: ["CE-2026-001"], stem: "CE-2026-001", awarded: false }).ok, false);
	assert.equal(nextAddendum({ ids: ["CE-2026-001"], stem: "CE-2026-001", awarded: true }).id, "CE-2026-001-AD1");
	assert.equal(nextAddendum({ ids: ["CE-2026-001-B"], stem: "CE-2026-001-B", awarded: true }).id, "CE-2026-001-B-AD1");
	assert.equal(nextAddendum({ ids: ["CE-2026-001-AD1"], stem: "CE-2026-001", awarded: true }).id, "CE-2026-001-AD2");
	const update = nextUpdateCopy({ ids: ["CE-2026-001-B-AD1"], stem: "CE-2026-001-B-AD1" });
	assert.equal(update.id, "CE-2026-001-B-AD1-U1");
	assert.equal(nextUpdateCopy({ ids: [update.id], stem: "CE-2026-001-B-AD1" }).id, "CE-2026-001-B-AD1-U2");
	assert.equal(update.id.includes("CE-2026-001-B-AD1"), true);
	assert.equal(/CE-2026-002/.test(update.id), false);
});

test("urgent keeps the next normal number and never a CE-M series", () => {
	const urgent = urgentPlan("CE-C1-2026-015");
	assert.equal(urgent.ok, true);
	assert.equal(urgent.id, "CE-C1-2026-015");
	assert.equal(urgent.tag, "RCE to follow");
	assert.equal(urgentPlan("CE-M-2026-001").ok, false);
	const src = readFileSync(new URL("./docSuffixes.js", import.meta.url), "utf8");
	assert.equal(src.includes("CE-M-"), false);
	assert.equal(/\bprojectTotal\s*\(/.test(src), false);
});

test("combined total is the original plus approved addendums only", () => {
	const total = combinedTotal([
		{ id: "CE-2026-001", amount: "24,542.00", status: "Done", awardStatus: "Awarded" },
		{ id: "CE-2026-001-A", amount: "9999", status: "Done", awardStatus: "Awarded" },
		{ id: "CE-2026-001-AD1", amount: "1000.50", status: "Done", awardStatus: "Awarded" },
		{ id: "CE-2026-001-AD2", amount: "500", status: "Ongoing", awardStatus: "" },
		{ id: "CE-2026-001-U1", amount: "800", status: "Done", awardStatus: "Awarded" }
	]);
	assert.equal(total, 25542.5);
	assert.equal(planSuffix("ad", { ids: [], stem: "CE-2026-001", awarded: false }).ok, false);
});

test("a missing suffix function falls back, and a real error does not", () => {
	assert.equal(missingSuffixRpc({ code: "PGRST202", message: "Could not find the function public.next_ce_suffix" }), true);
	assert.equal(missingSuffixRpc({ message: "next_ce_suffix does not exist" }), true);
	assert.equal(missingSuffixRpc({ message: "permission denied" }), false);
});

test("Sundays and listed holidays are not working days; Saturday still is", () => {
	assert.equal(isSunday("2026-10-18"), true);
	assert.equal(isWorkingDay("2026-10-18", []), false);
	assert.equal(isWorkingDay("2026-10-17", []), true);
	assert.equal(isWorkingDay("2026-10-17", ["2026-10-17"]), false);
	assert.equal(addWorkingDays("2026-10-16", 1, []), "2026-10-17");
	assert.equal(addWorkingDays("2026-10-17", 1, []), "2026-10-19");
	assert.equal(addWorkingDays("2026-10-16", 1, ["2026-10-17"]), "2026-10-19");
	assert.equal(workingDaysBetween("2026-10-16", "2026-10-19", []), 2);
});

test("family fold is one expandable row and does not replace the revision fold", () => {
	const rows = foldFamilyRows([
		{ id: "CE-2026-001", ceId: "CE-2026-001", ceDisplay: "CE-2026-001", status: "Done", amount: "100", awardStatus: "Awarded", revRank: 0 },
		{ id: "CE-2026-001-A", ceId: "CE-2026-001-A", ceDisplay: "CE-2026-001-A", status: "Ongoing", amount: "40", revRank: 0 },
		{ id: "CE-2026-001-AD1", ceId: "CE-2026-001-AD1", ceDisplay: "CE-2026-001-AD1", status: "Done", amount: "10", awardStatus: "Awarded", revRank: 0 },
		{ id: "CE-2026-002", ceId: "CE-2026-002", ceDisplay: "CE-2026-002", status: "Ongoing", amount: "5", urgentTag: "RCE to follow", revRank: 0 }
	]);
	assert.equal(rows.length, 2);
	const family = rows.find((row) => row.ceDisplay === "CE-2026-001");
	assert.equal(family.family, true);
	assert.equal(family.familyMembers.length, 3);
	assert.deepEqual(family.familyTags, ["A", "AD1"]);
	assert.equal(family.combinedAmount, 110);
	assert.equal(rows.find((row) => row.ceId === "CE-2026-002").familyTags.includes("RCE to follow"), true);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	assert.match(app, /function foldMonitoringRows\(rows\)/);
	assert.match(app, /familiesOn \? foldFamilyRows\(liveRows\) : foldMonitoringRows\(liveRows\)/);
});

test("price check follows clonedFrom.idMap and logs all, selected, or keep", () => {
	const source = { tasks: [{ id: "t", subtasks: [{ id: "s", items: { BOL: [{ id: "old", role: "Welder", rate: 100 }] } }] }] };
	const clone = {
		clonedFrom: { idMap: { old: "new" } },
		tasks: [{ id: "t2", subtasks: [{ id: "s2", items: { BOL: [{ id: "new", role: "Welder", rate: 80 }] } }] }]
	};
	const drifts = priceDrifts({
		clone,
		source,
		idMap: clone.clonedFrom.idMap,
		masterlist: { manpower: [{ id: "m1", role: "Welder", dailyRate: 120 }] }
	});
	assert.equal(drifts.length, 1);
	assert.equal(drifts[0].sourceLineId, "old");
	assert.equal(drifts[0].masterRate, 120);
	const all = resyncPlan({ mode: "all", drifts });
	assert.equal(all.patches[0].rate, 120);
	assert.equal(all.log.mode, "all");
	const selected = resyncPlan({ mode: "selected", drifts, selectedIds: [] });
	assert.equal(selected.patches.length, 0);
	const keep = resyncPlan({ mode: "keep", drifts });
	assert.equal(keep.patches.length, 0);
	assert.equal(keep.log.mode, "keep");
	const tasks = applyLineRates(clone.tasks, all.patches);
	assert.equal(tasks[0].subtasks[0].items.BOL[0].rate, 120);
	assert.deepEqual(constantDrift({ steelDensity: 7.85, deposition: { SMAW: 0.6 } }, { steelDensity: 7.85, deposition: { SMAW: 0.7 } }), [
		{ key: "deposition.SMAW", stored: 0.6, current: 0.7 }
	]);
});

test("scope library can record owner, official, and usage, and with-resources is not empty", () => {
	const saved = saveAsScope({ name: "Tank", owner: "Ada", official: true, jobType: "onsite", snapshot: { tasks: [] } });
	assert.equal(saved.owner, "Ada");
	assert.equal(saved.official, true);
	assert.equal(saved.usage, 0);
	assert.equal(bumpScopeUsage(saved).usage, 1);
	const onsite = resourceSeed("onsite");
	assert.equal(onsite.BOL.length > 0 && onsite.BOTE.length > 0 && onsite.PPE.length > 0, true);
	assert.equal(resourceSeed("shop").BOL[0].role, "Welder");
	assert.equal(resourceSeed("trading").BOCM.length, 1);
	assert.equal(onsite.BOL[0].rate, 0);
});

test("branding variables are only the six-digit colors, and the suffix SQL is additive", () => {
	assert.deepEqual(brandingVars({ bg: "#112233", ink: "red", brass: "#aabbcc" }), { "--bg": "#112233", "--brass": "#aabbcc" });
	assert.deepEqual(cleanBranding(null), {});
	const sql = readFileSync(new URL("../../../supabase/p5-numbering-suffixes-2026-10-20.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
	const rollback = readFileSync(new URL("../../../supabase/p5-numbering-suffixes-2026-10-20-rollback.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
	assert.match(sql, /next_ce_suffix/);
	assert.equal(/next_doc_no/i.test(sql), false);
	assert.equal(/estimator_files_/i.test(sql), false);
	assert.match(rollback, /next_ce_suffix/);
	assert.match(rollback, /ce_suffix_alloc/);
	assert.equal(/next_doc_no/i.test(rollback), false);
	assert.equal(/estimator_files_/i.test(rollback), false);
});
