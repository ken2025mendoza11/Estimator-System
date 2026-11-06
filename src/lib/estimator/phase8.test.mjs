// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { runChecker } from "./checker.js";
import { stitchPdfAttachments } from "./pdfAnnex.js";
import {
	addQuotation,
	annexesForExport,
	availabilityKeysFrom,
	ceEditorOpen,
	ceIsUnlocked,
	dbPriceOf,
	documentQuotationMirrorRow,
	finalizePending,
	lineFromQuote,
	mergePending,
	missingPhase8Table,
	pendingReminderPlan,
	phase8Findings,
	quotationMirrorRow,
	quotationReference,
	recommendPending,
	sha256Hex,
	submitPending,
	tryMirror,
	withClientLocation
} from "./phase8.js";

const ABC = new TextEncoder().encode("abc");
const ABC_HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

test("a repeated file hashes once and the cost estimate stores only the id", async () => {
	const hash = await sha256Hex(ABC);
	assert.equal(hash, ABC_HASH);
	const first = addQuotation([], {
		sha256: hash,
		fileName: "quote.pdf",
		byteLength: 3,
		dataUrl: "data:application/pdf;base64,YWI=",
		at: "2026-10-20T00:00:00.000Z"
	});
	const second = addQuotation(first.library, { sha256: hash, fileName: "again.pdf", dataUrl: "data:application/pdf;base64,eHg=" });
	assert.equal(first.duplicate, false);
	assert.equal(second.duplicate, true);
	assert.equal(second.library.length, 1);
	assert.equal(second.quotation.id, first.quotation.id);
	const ref = quotationReference(first.quotation.id);
	assert.deepEqual(ref, { quotationId: first.quotation.id, includeAnnex: true });
	assert.equal("dataUrl" in ref, false);
	const mirror = quotationMirrorRow(first.quotation);
	assert.equal(mirror.sha256, hash);
	assert.equal("dataUrl" in mirror, false);
	const link = documentQuotationMirrorRow("CE-1", ref);
	assert.equal(link.quotation_id, first.quotation.id);
	assert.equal("dataUrl" in link, false);
});

test("a quote price is used only when the database price is missing", () => {
	const db = { id: "ml-1", description: "Valve", unit: "pc", unitCost: 100 };
	const kept = lineFromQuote({ quoteLine: { id: "ql-1", description: "Valve", unit: "pc", qty: 2, unitCost: 40 }, dbItem: db, id: "line-1", category: "BOCM" });
	assert.equal(kept.unitCost, 100);
	assert.equal(kept.priceSource, "db");
	assert.equal(dbPriceOf({ rate: 0, unitCost: 0 }, "BOCM"), 0);
	const quoted = lineFromQuote({ quoteLine: { id: "ql-2", description: "Gasket", qty: 1, unitCost: 40 }, dbItem: { id: "ml-2", description: "Gasket" }, id: "line-2", category: "BOCM" });
	assert.equal(quoted.unitCost, 40);
	assert.equal(quoted.priceSource, "quote");
	assert.equal(quoted.masterlistId, "ml-2");
});

test("availability keys are not seeded and a location stays on the client", () => {
	assert.deepEqual(availabilityKeysFrom(undefined), []);
	assert.deepEqual(availabilityKeysFrom([{ label: "In stock" }, { label: "In stock" }]), [{ id: "in-stock", label: "In stock" }]);
	const client = withClientLocation({ id: "c1", clientCode: "ACME", fullName: "Acme", address: "Manila" }, { label: "Plant", address: "Cebu", city: "Cebu" });
	assert.equal(client.address, "Manila");
	assert.equal(client.fullName, "Acme");
	assert.equal(client.locations.length, 1);
	assert.equal(client.locations[0].city, "Cebu");
});

test("pending records need a reviewer, then an admin, and only unlocked estimates move", () => {
	const record = submitPending({
		kind: "item",
		payload: { id: "ml-new", description: "Valve" },
		actor: "Lead",
		now: "2026-10-13T00:00:00.000Z",
		replacesId: "ml-old",
		id: "pr-1"
	});
	assert.equal(recommendPending({ record, actor: "Staff", level: "staff", now: "2026-10-14T00:00:00.000Z" }).ok, false);
	const recommended = recommendPending({ record, actor: "Lead", level: "lead", now: "2026-10-14T00:00:00.000Z", note: "Use it" });
	assert.equal(recommended.ok, true);
	assert.equal(finalizePending({ record: recommended.record, actor: "Lead", level: "lead", now: "2026-10-15T00:00:00.000Z" }).ok, false);
	const final = finalizePending({ record: recommended.record, actor: "Admin", level: "admin", now: "2026-10-15T00:00:00.000Z" });
	assert.equal(final.ok, true);
	const merged = mergePending({
		record: final.record,
		now: "2026-10-16T00:00:00.000Z",
		ces: [
			{ id: "CE-OPEN", status: "Ongoing", tasks: [{ id: "t", subtasks: [{ id: "s", items: { BOCM: [{ id: "l", masterlistId: "ml-old", unitCost: 5 }] } }] }] },
			{ id: "CE-LOCK", status: "For approval", tasks: [{ id: "t2", subtasks: [{ id: "s2", items: { BOCM: [{ id: "l2", masterlistId: "ml-old" }] } }] }] }
		]
	});
	assert.equal(merged.ok, true);
	assert.equal(merged.record.status, "merged");
	assert.deepEqual(merged.skipped, ["CE-LOCK"]);
	assert.equal(merged.ces[0].doc.tasks[0].subtasks[0].items.BOCM[0].masterlistId, "ml-new");
	assert.equal(merged.ces[0].doc.tasks[0].subtasks[0].items.BOCM[0].unitCost, 5);
	assert.equal(ceIsUnlocked("Done"), false);
	assert.equal(ceIsUnlocked("For revision"), true);
	assert.equal(ceEditorOpen("For approval"), false);
	assert.equal(ceEditorOpen("Done"), false);
	assert.equal(ceEditorOpen("Ongoing"), true);
});

test("reminders stay lazy and escalation waits N working days", () => {
	const now = new Date("2026-10-20T02:30:00.000Z");
	const quiet = pendingReminderPlan({
		record: { status: "submitted", submittedAt: "2026-10-20T00:00:00.000Z", lastNotifiedAt: "" },
		now,
		escalateAfter: 3
	});
	assert.equal(quiet.slots.length, 1);
	assert.equal(quiet.escalate, false);
	const late = pendingReminderPlan({
		record: { status: "recommended", submittedAt: "2026-10-13T00:00:00.000Z", lastNotifiedAt: "2026-10-20T00:00:00.000Z" },
		now,
		escalateAfter: 3
	});
	assert.equal(late.escalate, true);
	assert.ok(late.days >= 3);
});

test("checker rules stay quiet until the matching flag is on", () => {
	const tasks = [{
		id: "t",
		title: "Task",
		workType: "shop",
		subtasks: [{ id: "s", title: "Sub", items: { BOL: [], BOTE: [], BOCM: [{ id: "l", description: "Valve", qty: 1, unitCost: 40, masterlistId: "ml-old", quotationLineId: "ql", priceSource: "quote", dbPrice: 100 }], PPE: [], MISC: [] } }]
	}];
	const off = phase8Findings({ tasks, features: {} });
	assert.equal(off.length, 0);
	const on = runChecker({
		tasks,
		rceId: "RCE-1",
		rceAccepted: true,
		features: { quotations: true, availability: true, clientLocations: true, pendingRecords: true },
		quotations: [],
		quotationRefs: [{ quotationId: "qt-missing" }],
		items: [{ id: "ml-old", availabilityKey: "" }],
		clientName: "Acme",
		clients: [{ fullName: "Acme", clientCode: "ACME", locations: [] }],
		pendingRecords: [{ status: "submitted", replacesId: "ml-old", payload: { id: "ml-new" } }]
	});
	const messages = on.findings.map((row) => row.message);
	assert.ok(messages.includes("Quote price used on “Valve” while a database price exists."));
	assert.ok(messages.includes("Quotation “qt-missing” is not in the library."));
	assert.ok(messages.includes("“Valve” has no availability key."));
	assert.ok(messages.includes("Client “Acme” has no location."));
	assert.ok(messages.includes("“Valve” is still a pending record."));
	const quiet = runChecker({ tasks, rceId: "RCE-1", rceAccepted: true });
	assert.equal(quiet.findings.some((row) => row.rule === "quote-over-db"), false);
});

test("unticked annexes are left off the stitched PDF", async () => {
	async function onePage() {
		const pdf = await PDFDocument.create();
		pdf.addPage([200, 200]);
		return pdf.save();
	}
	const base = await onePage();
	const extra = await onePage();
	const kept = await stitchPdfAttachments(base, [{ include: true, bytes: extra }, { include: false, bytes: extra }]);
	const doc = await PDFDocument.load(kept);
	assert.equal(doc.getPageCount(), 2);
	const annexes = annexesForExport(
		[{ id: "qt-1", dataUrl: "data:application/pdf;base64,YQ==", fileName: "a.pdf" }],
		[{ quotationId: "qt-1", includeAnnex: true }],
		{ "qt-1": true }
	);
	assert.equal(annexes[0].include, false);
});

test("a missing mirror table is detected and the flags default off", async () => {
	assert.equal(missingPhase8Table({ code: "42P01", message: "relation \"quotations\" does not exist" }), true);
	assert.equal(missingPhase8Table({ message: "permission denied" }), false);
	const missing = await tryMirror({ from: () => ({ upsert: async () => ({ error: { code: "42P01", message: "relation quotations does not exist" } }) }) }, "quotations", [{ id: "qt-1" }]);
	assert.equal(missing.missing, true);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	assert.match(app, /quotations: false/);
	assert.match(app, /availability: false/);
	assert.match(app, /clientLocations: false/);
	assert.match(app, /pendingRecords: false/);
	assert.match(app, /quotations: src\.features\?\.quotations === true/);
	assert.match(app, /if \(!annexes\.length\)/);
	const sql = readFileSync(new URL("../../../supabase/p8-quotations-2026-10-20.sql", import.meta.url), "utf8");
	assert.equal(/alter table public\.clients/i.test(sql), false);
	assert.equal(/alter table public\.masterlist_items/i.test(sql), false);
});
