import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { markThreadRead, postMessage, threadParticipants, threadVisible, unreadCount } from "./ceThread.js";
import { blocksToDocxXml, chosenTemplate, docPreviewUrl, docxXmlToBlocks, htmlToBlocks, importDocxBlocks, libraryTabLabel, numberPlan, previewDocs, salesSafeExport, stripCeTemplate, stripOifTemplate, stripRceTemplate, saveMethodology, templateChoices, xmlToDocxBytes } from "./libraryTemplates.js";
import { followLabel, salesChipMatch, teamNewRows, trackerSteps } from "./stageBui.js";
import { bellForUser, documentTitle, markAllRead, unreadBell } from "./notifyBell.js";
import { addWorkingDays, isWorkingDay, manilaDate, markSeen, openStage, showNewForUser } from "./personalNew.js";

const week = { weekendDays: [0, 6], holidays: ["2026-11-04"] };

test("NEW is personal, expires after one working day, and a viewer does not clear it", () => {
	assert.equal(isWorkingDay("2026-11-07", week), false);
	assert.equal(isWorkingDay("2026-11-07", { weekendDays: [0], holidays: [] }), true);
	assert.equal(isWorkingDay("2026-11-04", week), false);
	assert.equal(addWorkingDays("2026-11-03", 1, week), "2026-11-05");
	const created = "2026-11-02T02:00:00.000Z";
	assert.equal(manilaDate(created), "2026-11-02");
	const input = { userId: "est-1", targetedIds: ["est-1", "lead-1"], seenBy: {}, createdAt: created, now: "2026-11-02T10:00:00.000Z", config: week };
	assert.equal(showNewForUser(input), true);
	assert.equal(showNewForUser({ ...input, userId: "viewer" }), false);
	const seen = markSeen({}, "viewer", "2026-11-02T10:00:00.000Z");
	assert.equal(showNewForUser({ ...input, seenBy: seen }), true);
	assert.equal(showNewForUser({ ...input, seenBy: markSeen({}, "est-1", "2026-11-02T11:00:00.000Z") }), false);
	assert.equal(showNewForUser({ ...input, now: "2026-11-06T02:00:00.000Z" }), false);
	assert.equal(openStage({}), "Unopened");
	assert.equal(openStage({ openedByAssigneeOrLead: true }), "Pending");
	assert.equal(openStage({ hasCe: true, openedByAssigneeOrLead: false }), "CE in progress");
});

test("threads, the bell, and library strips keep the current rules", () => {
	const thread = { participants: ["est-1", "sales-1"], messages: [], seen: {} };
	assert.equal(threadVisible("other", thread.participants), false);
	const posted = postMessage(thread, { from: "est-1", text: "Need the drawing", now: "2026-11-04T01:00:00.000Z" });
	assert.equal(posted.ok, true);
	assert.equal(unreadCount(posted.thread, "sales-1"), 1);
	assert.equal(unreadCount(markThreadRead(posted.thread, "sales-1", "2026-11-04T02:00:00.000Z"), "sales-1"), 0);
	assert.equal(unreadCount(posted.thread, "est-1"), 0);
	const routeCe = { assigneeId: "est-1", salesOwnerId: "sales-1", leadId: "lead-1", approverIds: ["appr-1"], adminIds: ["admin-1"] };
	const started = { participants: ["est-1"], messages: [], seen: {} };
	const owner = postMessage(started, { from: "sales-1", text: "See the drawing", now: "2026-11-04T01:10:00.000Z", ce: routeCe });
	assert.equal(owner.ok, true);
	assert.deepEqual(threadParticipants(routeCe), ["est-1", "lead-1", "sales-1", "appr-1", "admin-1"]);
	assert.equal(threadVisible("sales-1", owner.thread.participants), true);
	const outsider = postMessage(owner.thread, { from: "other", text: "no", now: "2026-11-04T01:20:00.000Z", ce: routeCe });
	assert.equal(outsider.ok, false);
	assert.equal(outsider.message, "Only participants can post.");
	const reply = postMessage(owner.thread, { from: "sales-1", text: "Attached", now: "2026-11-04T01:30:00.000Z", ce: routeCe });
	assert.equal(reply.ok, true);
	assert.equal(reply.notices.some((/** @type {any} */ row) => row.toUserId === "*" || row.toUserId === "sales-1"), false);
	assert.equal(unreadBell(bellForUser(reply.notices, "est-1")), 1);
	assert.equal(unreadBell(bellForUser(reply.notices, "sales-1")), 0);
	const events = [{ toUserId: "sales-1", read: false }, { toUserId: "est-1", read: false }];
	assert.equal(unreadBell(events), 2);
	assert.equal(unreadBell(markAllRead(events, "2026-11-04T03:00:00.000Z")), 0);
	assert.equal(documentTitle(2), "(2) Estimator System");
	assert.equal(documentTitle(0), "Estimator System");
	assert.equal(libraryTabLabel(false, "nav"), "Scope Library");
	assert.equal(libraryTabLabel(true, "nav"), "Library");
	assert.equal(libraryTabLabel(true, "ce"), "Cost Estimate");
	assert.equal(libraryTabLabel(true, "task"), "Per Task");
	const ce = stripCeTemplate({ client: "Acme", projectInfo: { client: "Acme", project: "Pump" }, notes: "old", attachments: [{}], approval: { status: "accepted" } });
	assert.equal(ce.client, "");
	assert.equal(ce.projectInfo.project, "");
	assert.equal(ce.notes, "");
	assert.equal(ce.attachments.length, 0);
	assert.equal(ce.approval, null);
	const rce = stripRceTemplate({ customer: "Acme", checklist: { item1: { complete: "YES" } }, rceDate: "2026-11-01", attachments: [{}], preparedStamp: "x" });
	assert.equal(rce.customer, "");
	assert.equal(rce.checklist.item1.complete, "YES");
	assert.equal(rce.rceDate, "");
	assert.equal(rce.preparedStamp, "");
	const oif = stripOifTemplate({ oifNo: "OIF-1", date: "2026-11-01", measurements: [1], signatures: [{}] });
	assert.equal(oif.oifNo, "");
	assert.equal(oif.date, "");
	assert.deepEqual(oif.measurements, [1]);
	assert.equal(numberPlan("revise", { number: "CE-1", rev: 1 }).number, "CE-1");
	assert.equal(numberPlan("revise", { number: "CE-1", rev: 1 }).rev, 2);
	assert.equal(numberPlan("use-as-new", { number: "CE-1", rev: 1 }).number, "");
	assert.equal(numberPlan("duplicate", { number: "RCE-1" }).sameNumber, false);
	assert.deepEqual(previewDocs({ rce: { rceNo: "RCE-1", status: "Accepted" }, ce: null }), [{ kind: "RCE", id: "RCE-1", status: "Accepted" }]);
	const listed = previewDocs({ rce: { rceNo: "RCE-1", status: "Accepted" }, ce: null, markup: null, proposal: { controlNo: "PR-1", status: "Sent" } });
	assert.deepEqual(listed.map((doc) => doc.kind), ["RCE", "Proposal"]);
	const opened = docPreviewUrl(listed[1]);
	if (!opened) throw new Error("missing preview");
	assert.equal(opened.url.startsWith("data:application/pdf,"), true);
	assert.equal(opened.id, "PR-1");
	assert.equal(opened.downloadName, "PR-1.pdf");
	const cePreview = docPreviewUrl({ kind: "CE", id: "CE-9", status: "Done" });
	if (!cePreview) throw new Error("missing ce preview");
	assert.equal(cePreview.salesSafe, true);
	assert.equal(docPreviewUrl({ kind: "RCE" }), null);
	const safe = salesSafeExport({ cover: { contingencyPct: 5 } }, true);
	assert.equal(safe.cover.omitContingency, true);
	assert.equal(safe.salesSafe, true);
	const blocks = docxXmlToBlocks('<w:p><w:pStyle w:val="Heading1"/><w:r><w:rPr><w:b/></w:rPr><w:t>Title</w:t></w:r></w:p><w:p><w:numPr></w:numPr><w:r><w:rPr><w:i/></w:rPr><w:t>Item</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:t>A</w:t></w:tc></w:tr></w:tbl>');
	assert.equal(blocks.some((row) => row.type === "heading" && row.bold && row.text === "Title"), true);
	assert.equal(blocks.some((row) => row.type === "list" && row.italic), true);
	assert.equal(blocks.some((row) => row.type === "table"), true);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	["personalNewTag", "salesPipelineMonitoring", "ceThreads", "notificationsBell", "libraryMethodologies", "templatesFromDocs", "monitoringExport", "salesDocPreview"].forEach((flag) => {
		assert.equal(app.includes(`${flag}: false`), true, flag);
		assert.equal(seed.includes(`${flag}: true`), true, flag);
	});
	assert.equal(readFileSync(new URL("../../../supabase/p43-seen-threads-2026-11-04.sql", import.meta.url), "utf8").includes("create table if not exists public.doc_reads"), true);
	const steps = trackerSteps("For markup");
	assert.equal(steps.filter((step) => step.done).length, 3);
	assert.equal(steps[3].label, "Markup for approval");
	assert.equal(salesChipMatch({ stage: "Won" }, "Awarded/Lost"), true);
	assert.equal(salesChipMatch({ stage: "For markup" }, "Awarded/Lost"), false);
	assert.equal(followLabel({ waitingInfo: true }, { estimator: true }), "Follow up");
	assert.equal(followLabel({ waitingInfo: true }, { sales: true }), "Respond");
	assert.equal(followLabel({ stage: "Sent/awaiting" }, { sales: true }), "Follow up");
	const fresh = teamNewRows([{ targetedIds: ["est-1"], seenBy: {}, createdAt: "2026-11-04T01:00:00.000Z" }], { userId: "est-1", now: "2026-11-04T02:00:00.000Z", config: week });
	assert.equal(fresh.length, 1);
	const saved = saveMethodology([], { id: "m1", name: "Weld", body: "Keep dry", updatedAt: "2026-11-04" });
	assert.equal(saved[0].versions[0].body, "Keep dry");
	const xml = blocksToDocxXml([{ type: "heading", text: "Title", bold: true }]);
	assert.equal(xml.includes("Heading1"), true);
	assert.equal(docxXmlToBlocks(xml).some((row) => row.type === "heading" && row.text === "Title"), true);
});

test("a docx round trip keeps the heading, list, table, bold, and italic", async () => {
	const blocks = [
		{ type: "heading", text: "Title", bold: true },
		{ type: "list", text: "Item", italic: true },
		{ type: "table", rows: [["Cell"]] },
	];
	const xml = blocksToDocxXml(blocks);
	const read = docxXmlToBlocks(xml);
	assert.equal(read.some((row) => row.type === "heading" && row.bold && row.text === "Title"), true);
	assert.equal(read.some((row) => row.type === "list" && row.italic && row.text === "Item"), true);
	assert.equal(read.some((row) => row.type === "table" && row.rows[0][0] === "Cell"), true);
	const imported = await importDocxBlocks(xmlToDocxBytes(xml));
	assert.equal(imported.some((row) => row.type === "heading" && row.text.includes("Title")), true);
	assert.equal(imported.some((row) => row.type === "list" && row.italic && row.text.includes("Item")), true);
	assert.equal(imported.some((row) => row.type === "table" && row.rows.flat().includes("Cell")), true);
	assert.equal(htmlToBlocks("<p><strong>Bold</strong> <em>Italic</em></p>").some((row) => row.bold && row.italic), true);
	const templates = [
		{ id: "old", name: "Old shop", type: "RCE", date: "2026-01-01", snapshot: { customer: "Old" } },
		{ id: "picked", name: "Site visit", type: "OIF", updatedAt: "2026-11-04T01:00:00.000Z", snapshot: { projectDescription: "Pump" } },
	];
	assert.equal(templateChoices(templates)[1].date, "2026-11-04");
	assert.equal(chosenTemplate(templates, "picked").id, "picked");
	assert.equal(chosenTemplate(templates, "picked").snapshot.projectDescription, "Pump");
	assert.equal(chosenTemplate(templates, "missing"), null);
	assert.notEqual(chosenTemplate(templates, "picked").id, templates[0].id);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	assert.equal(app.includes("chosenTemplate(oifTemplatesNow"), true);
	assert.equal(app.includes("chosenTemplate(rceTemplatesNow"), true);
	assert.equal(app.includes("oifTemplatesNow[0]"), false);
	assert.equal(app.includes("rceTemplatesNow[0]"), false);
});
