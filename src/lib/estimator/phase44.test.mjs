/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { dolePay, resolveDoleDay } from "./ceTotals.js";
import { allocateUntilFree, isDocNumberClash, rceNeedsNumber, rceNumberLabel, rewritePayloadNumber } from "./docNumbers.js";
import { bolSheetMath, gridsFromWorkbook, importCostWorkbook, workbookKind } from "./kenWorkbook.js";
import { blocksToDocxXml, decideMethodology, docxXmlToBlocks, importDocxBlocks, submitMethodology, xmlToDocxBytes } from "./libraryTemplates.js";
import { createMarkup, markupNumber, nextMarkupRevision } from "./markup.js";
import { isWorkingDay as personalWorkingDay } from "./personalNew.js";
import { companyCalendar, estWorkingDays, isWorkingDay, readCalendar } from "./phCalendar.js";
import { estDaysFromSpan } from "./rceTemplate.js";
import { extraTrustedOrigins, previewDeploymentOrigin, resolvedAuthBaseURL } from "../auth/preview-origins.ts";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
const editor = readFileSync(new URL("../../components/MethodologyEditor.jsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../components/MarkupPanel.jsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("../../components/Phase5Admin.jsx", import.meta.url), "utf8");
const totals = readFileSync(new URL("./ceTotals.js", import.meta.url), "utf8");
const server = readFileSync(new URL("../auth/server.ts", import.meta.url), "utf8");

test("an RCE number is taken on save, not when the form opens", async () => {
	assert.equal(rceNumberLabel(""), "—");
	assert.equal(rceNumberLabel("—"), "—");
	assert.equal(rceNumberLabel("RCE-2026-014"), "RCE-2026-014");
	assert.equal(rceNeedsNumber(""), true);
	assert.equal(rceNeedsNumber("—"), true);
	assert.equal(rceNeedsNumber("RCE-2026-014"), false);
	let serial = 10;
	const openDoesNotAllocate = () => rceNumberLabel("");
	assert.equal(openDoesNotAllocate(), "—");
	assert.equal(serial, 10);
	const saved = await allocateUntilFree(
		async () => {
			serial += 1;
			return `RCE-2026-${String(serial).padStart(3, "0")}`;
		},
		async () => ({ ok: true }),
		{ tries: 8 },
	);
	assert.equal(saved.ok, true);
	assert.equal(saved.number, "RCE-2026-011");
	assert.equal(serial, 11);
	assert.equal((app.match(/takeDocNo\("rce"/g) || []).length, 1);
	assert.equal(app.includes("rceNumberLabel(form.rceNo)"), true);
	assert.equal(app.includes("rceNeedsNumber(rceNo)"), true);
});

test("a used number is replaced quietly, and concurrent saves stay unique", async () => {
	let n = 0;
	const used = new Set(["DOC-1"]);
	const allocate = async () => {
		n += 1;
		return `DOC-${n}`;
	};
	const claim = async (number) => {
		if (used.has(number)) return { ok: false, code: "23505", message: "duplicate key value violates unique constraint" };
		used.add(number);
		return { ok: true };
	};
	const results = await Promise.all(Array.from({ length: 6 }, () => allocateUntilFree(allocate, claim, { tries: 8 })));
	const numbers = results.map((row) => row.number);
	assert.equal(results.every((row) => row.ok), true);
	assert.equal(new Set(numbers).size, 6);
	assert.equal(numbers.includes("DOC-1"), false);
	await assert.rejects(() => allocateUntilFree(async () => {
		throw new Error("network down");
	}, claim, { tries: 8 }), /network down/);
	assert.equal(isDocNumberClash({ code: "23505", message: "unique violation" }), true);
	assert.equal(isDocNumberClash({ message: "Couldn't get a number, try again" }), false);
	const rewritten = rewritePayloadNumber("ce", {
		id: "row-1",
		ceNo: "OLD",
		document: { projectInfo: { docNo: "OLD", client: "A" }, docNo: "OLD" },
		summary: { docNo: "OLD", total: 9 },
	}, "CE-NEW");
	assert.equal(rewritten.id, "row-1");
	assert.equal(rewritten.ceNo, "CE-NEW");
	assert.equal(rewritten.document.projectInfo.docNo, "CE-NEW");
	assert.equal(rewritten.document.projectInfo.client, "A");
	assert.equal(rewritten.summary.total, 9);
	assert.equal(app.includes("tries: 8"), true);
});

test("markup revise copies are -MK, then -MK-R1, then -MK-R2", () => {
	const ceNo = "CE-C1-2026-014";
	assert.equal(markupNumber(ceNo, 0), `${ceNo}-MK`);
	const first = createMarkup({ ceId: ceNo, ceNo, revision: 0, byUserId: "sales-1", directCost: 1000, preset: "100" });
	assert.equal(first.ok, true);
	assert.equal(first.markup.markupNo, `${ceNo}-MK`);
	assert.equal(first.markup.revision, 0);
	const rows = [first.markup];
	const revision = nextMarkupRevision(rows, ceNo);
	assert.equal(revision, 1);
	const second = createMarkup({ ceId: ceNo, ceNo, revision, byUserId: "sales-1", directCost: 1000, parts: first.markup.parts });
	assert.equal(second.markup.markupNo, `${ceNo}-MK-R1`);
	rows.push(second.markup);
	const third = createMarkup({ ceId: ceNo, ceNo, revision: nextMarkupRevision(rows, ceNo), byUserId: "sales-1", directCost: 1000 });
	assert.equal(third.markup.markupNo, `${ceNo}-MK-R2`);
	assert.equal(third.markup.id, third.markup.markupNo);
	assert.equal(app.includes('action === "revise"'), true);
	assert.equal(panel.includes("Revise markup"), true);
});

test("Saturday is a working day unless the company turns it off", () => {
	assert.equal(isWorkingDay("2026-10-17", []), true);
	assert.equal(isWorkingDay("2026-10-18", []), false);
	assert.equal(isWorkingDay("2026-10-17", ["2026-10-17"]), false);
	assert.equal(readCalendar({ saturdayWorking: false }).skipSaturday, true);
	assert.equal(isWorkingDay("2026-10-17", { saturdayWorking: false, holidays: [] }), false);
	assert.equal(companyCalendar({}).saturdayWorking, true);
	assert.equal(companyCalendar({ workingDays: { saturdayWorking: false } }).saturdayWorking, false);
	assert.equal(estWorkingDays("2026-10-16", "2026-10-19", []), 2);
	assert.equal(estDaysFromSpan("2026-10-16", "2026-10-19", { saturdayWorking: false, holidays: [] }), 1);
	assert.equal(personalWorkingDay("2026-10-17"), true);
	assert.equal(personalWorkingDay("2026-10-17", { saturdayWorking: false }), false);
	assert.equal(admin.includes("Saturday is a working day"), true);
	assert.equal(totals.includes("function computeSchedule"), false);
});

test("new DOLE day types follow the 2024 handbook and old fixtures stay", () => {
	const blank = {};
	assert.equal(dolePay(700, "Regular", "Day", blank).otRate, 109.375);
	assert.equal(dolePay(700, "Sun/Special", "Day", blank).otRate, 147.875);
	assert.equal(dolePay(700, "Holiday", "Day", blank).otRate, 227.5);
	assert.ok(Math.abs(dolePay(900, "Regular", "Night", blank).dayRate - 990) < 1e-6);
	assert.equal(resolveDoleDay("Sun/Special"), "rest");
	assert.equal(resolveDoleDay("Special on rest"), "special-rest");
	assert.equal(resolveDoleDay("Holiday on rest"), "holiday-rest");
	assert.equal(resolveDoleDay("Double holiday"), "double-holiday");
	assert.equal(resolveDoleDay("Double holiday on rest"), "double-holiday-rest");
	assert.equal(dolePay(800, "Special on rest", "Day", blank).premium, 1.5);
	assert.equal(dolePay(800, "Holiday on rest", "Day", blank).premium, 2.6);
	assert.equal(dolePay(800, "Double holiday", "Day", blank).premium, 3);
	assert.equal(dolePay(800, "Double holiday on rest", "Day", blank).premium, 3.9);
	const hourly = 800 / 8;
	assert.ok(Math.abs(dolePay(800, "Sun/Special", "Day", blank).otRate / hourly - 1.69) < 1e-9);
	assert.ok(Math.abs(dolePay(800, "Sun/Special", "Night", blank).otRate / hourly - 1.859) < 1e-9);
	assert.ok(Math.abs(dolePay(800, "Holiday", "Day", blank).otRate / hourly - 2.6) < 1e-9);
	assert.equal(totals.includes("Workers-Statutory-Monetary-Benefits-Handbook-2024-Edition.pdf"), true);
	assert.equal(totals.includes("num2(item.qty) * num2(item.days) * num2(item.hoursPerDay) * num2(item.powerKw) * num2(item.kwhRate)"), true);
	for (const label of ["Special on rest", "Holiday on rest", "Double holiday", "Double holiday on rest"]) {
		assert.equal(app.includes(`"${label}"`), true, label);
	}
	const checklist = app.slice(app.indexOf("var RCE_CHECKLIST_ITEMS"), app.indexOf("function emptyRceChecklist"));
	assert.match(checklist, /key: "item6"[\s\S]*?num: "6"[\s\S]*?key: "item8"[\s\S]*?num: "7"/);
	assert.equal(/key: "item8"[\s\S]{0,40}num: "8"/.test(checklist), false);
});

test("Ken's CE workbook and the older Role/Position export import filled rows only", () => {
	const math = bolSheetMath({ qty: 2, days: 3, rate: 700, otHrs: 2 });
	assert.equal(math.subtotalA, 4200);
	assert.equal(math.otRate, 113.75);
	assert.equal(math.subtotalB, 1365);
	assert.equal(math.total, 5565);
	const synthetic = importCostWorkbook({
		SheetNames: ["CE SUMMARY", "BOL", "MOB & DEMOB"],
		grids: {
			BOL: [[
				"ITEM", "MANPOWER LOADING", "QTY", "UOM", "NO. OF DAYS", "RATE PER DAY", "SUB-TOTAL A", "OT HRS PER DAY", "RATE OT/HR", "SUB-TOTAL B", "TOTAL",
			], ["1", "Welder", 2, "pax", 3, 700, "", 2, "", "", ""]],
		},
	});
	assert.equal(synthetic.kind, "ken-ce");
	const welder = synthetic.lines.find((line) => line.description === "Welder");
	assert.equal(welder.selected, true);
	assert.equal(welder.total, 5565);
	assert.equal(synthetic.sections.BOL, 5565);
	assert.equal(synthetic.summaryRefs.C, "BOL!M153");
	assert.equal(synthetic.summaryRefs.A, "MOB & DEMOB!L50");
	assert.equal(synthetic.summaryRefs["G.5"], "MISC.!L64");

	const official = gridsFromWorkbook(XLSX, XLSX.read(readFileSync(new URL("../../../sample-outputs/v2/batches/batch5-refs/old-excel-formats.xlsx", import.meta.url)), { type: "buffer" }));
	assert.equal(workbookKind(official.SheetNames), "ken-ce");
	assert.equal(official.SheetNames.includes("SY3-F-TSG-25") || JSON.stringify(official.grids["CE SUMMARY"] || []).includes("SY3-F-TSG-25"), true);
	const imported = importCostWorkbook(official);
	assert.deepEqual(imported.ignored.sort(), ["Masterlist", "Procurement Masterlist", "TOOLS(NEW)"].sort());
	assert.equal(imported.lines.some((line) => line.description === "PROJECT MANAGER" && line.rate === 800 && line.selected === false), true);
	assert.equal(imported.lines.filter((line) => line.selected).length, 0);
	assert.equal(imported.lines.some((line) => /masterlist|tools\(new\)/i.test(line.description || "")), false);

	const older = gridsFromWorkbook(XLSX, XLSX.read(readFileSync(new URL("../../../sample-outputs/v2/batches/batch5-refs/old-ce-export-format.xlsx", import.meta.url)), { type: "buffer" }));
	assert.equal(workbookKind(older.SheetNames), "old-export");
	const oldImport = importCostWorkbook(older);
	const fitter = oldImport.lines.find((line) => line.description === "Mechanical Fitter" && line.qty === 4);
	assert.equal(fitter.selected, true);
	assert.equal(fitter.total, 14962.5);
	assert.equal(oldImport.sections.BOL, 47156.25);
	assert.equal(app.includes("fillCeTemplate"), true);
});

test("the methodology editor approves only Lead, Head, or Admin and round-trips Word blocks", async () => {
	assert.equal(submitMethodology({ body: "  " }, { by: "est" }).ok, false);
	const pending = submitMethodology({ id: "m1", body: "Keep dry", html: "<p><strong>Title</strong></p>" }, { by: "est", now: "2026-11-06T00:00:00.000Z" });
	assert.equal(pending.ok, true);
	assert.equal(pending.doc.approval.status, "For approval");
	assert.equal(decideMethodology(pending.doc, { level: "staff", decision: "approve", actor: "Staff" }).ok, false);
	const approved = decideMethodology(pending.doc, { level: "lead", decision: "approve", actor: "Lead", now: "2026-11-06T01:00:00.000Z" });
	assert.equal(approved.ok, true);
	assert.equal(approved.doc.approval.status, "Approved");
	assert.equal(approved.doc.approval.decidedBy, "Lead");
	const rejected = decideMethodology(pending.doc, { level: "head", decision: "reject", actor: "Head" });
	assert.equal(rejected.doc.approval.status, "Rejected");
	const blocks = [
		{ type: "heading", text: "Title", bold: true },
		{ type: "list", text: "Keep dry" },
		{ type: "table", rows: [["A", "B"], ["1", "2"]] },
	];
	const xml = blocksToDocxXml(blocks);
	const back = docxXmlToBlocks(xml);
	assert.equal(back.some((row) => row.type === "heading" && row.bold && row.text === "Title"), true);
	assert.equal(back.some((row) => row.type === "list" && row.text === "Keep dry"), true);
	assert.equal(back.some((row) => row.type === "table" && row.rows[0][0] === "A" && row.rows[1][1] === "2"), true);
	const imported = await importDocxBlocks(xmlToDocxBytes(xml));
	assert.equal(imported.some((row) => String(row.text || "").includes("Title") || (row.rows || []).flat().includes("A")), true);
	assert.equal(editor.includes("useEditor"), true);
	for (const label of ["Methodology editor", "Bold", "Bullets", "Equation", "Symbol"]) {
		assert.equal(editor.includes(label), true, label);
	}
	assert.equal(app.includes("methodologyEditor: false"), true);
	assert.equal(seed.includes("methodologyEditor: true"), true);
	assert.equal(app.includes("libraryMethodologies: false"), true);
	assert.equal(seed.includes("libraryMethodologies: true"), true);
});

test("a Vercel preview uses its own origin and Google stays trusted", () => {
	const host = "estimator-system-git-grok-phase-44-ken-3817.vercel.app";
	const env = { VERCEL_ENV: "preview", VERCEL_URL: host, BETTER_AUTH_URL: "https://estimator-system.vercel.app" };
	assert.equal(previewDeploymentOrigin(env), `https://${host}`);
	assert.equal(resolvedAuthBaseURL(env), `https://${host}`);
	const trusted = extraTrustedOrigins(env);
	assert.equal(trusted.includes(`https://${host}`), true);
	assert.equal(trusted.includes("https://accounts.google.com"), true);
	assert.equal(trusted.includes("https://estimator-system-*.vercel.app"), true);
	assert.equal(resolvedAuthBaseURL({ VERCEL_ENV: "production", BETTER_AUTH_URL: "https://estimator-system.vercel.app" }), "https://estimator-system.vercel.app");
	assert.equal(previewDeploymentOrigin({ VERCEL_ENV: "production", VERCEL_URL: host }), "");
	assert.equal(server.includes("extraTrustedOrigins(process.env)"), true);
	assert.equal(server.includes("...previewAllowedHosts"), true);
});
