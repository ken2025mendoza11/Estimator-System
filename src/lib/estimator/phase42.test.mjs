import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { freezeOffsets, freezePlan, stickyBarVisible, stickyScrollCheck } from "./stickyTable.js";
import { applyRouteSignatories, routeSignatories, signatoryPending } from "./ceSignatories.js";
import { ceReviseOnly, ceWithdrawAllowed, planCeWithdraw, withdrawRecipients } from "./ceWithdraw.js";
import { applyHeaderEdit, headerEditDraft, headerEditLocked, HEADER_EDIT_FIELDS, listHeaderValues } from "./ceHeaderEdit.js";
import { applyExportPlan, classifyImportMatch, importedTotal, mapCeSheet } from "./csvImport.js";
import { approveMasterItem, buildNounName, lineDbState, persistPending, requestMasterItem } from "./ceLineDb.js";
import { applyAttachmentEdits, compiledAttachmentNames, copyAttachmentVersion, removeAttachment, renameAttachment, reorderAttachments } from "./ceAttachOrder.js";

test("sticky tables freeze item and project and keep a bottom scrollbar", () => {
	assert.deepEqual(freezePlan(["Item No.", "Estimator", "Project Description", "CE #"]), [0, 2]);
	assert.deepEqual(freezePlan(["No.", "Project"]), [0, 1]);
	assert.deepEqual(freezeOffsets([48, 180]), [0, 48]);
	assert.equal(stickyBarVisible(2400, 390), true);
	assert.equal(stickyBarVisible(320, 390), false);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const css = readFileSync(new URL("../../estimator.css", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("ceTpl1: false"), true);
	assert.equal(app.includes("ceTpl1: src.features?.ceTpl1 === true"), true);
	assert.equal(seed.includes("ceTpl1: true"), true);
	["mon-table-container", "db-table-card", "oif-mon-grid"].forEach((name) => {
		assert.equal(app.includes(`className: "${name}"`) || app.includes(`className: "ce-gridwrap dash-user-gridwrap ${name}"`), true, name);
	});
	assert.equal(app.includes("jsx(StickyTable,"), true);
	assert.equal(css.includes("position:sticky;bottom:0"), true);
	assert.equal(css.includes(".ce-sticky-on thead th{position:sticky;top:0"), true);
	const scrolled = stickyScrollCheck({ rows: 50, rowPx: 36, viewportH: 390, scrolledToRow: 20, tableWidth: 1400, viewportW: 390 });
	assert.equal(scrolled.tableOnScreen, true);
	assert.equal(scrolled.headerStuck, true);
	assert.equal(scrolled.barVisible, true);
	assert.equal(scrolled.atRow, 20);
	const mon = app.slice(app.indexOf("function MonitoringDashboard"), app.indexOf("function clientCodeForCe"));
	assert.equal(mon.includes("jsx(StickyTable,"), true);
	assert.equal(app.includes('tab === "executive" && /* @__PURE__ */ jsx(MonitoringDashboard,'), true);
	assert.equal(app.includes('children: "User Monitoring"'), true);
	assert.equal(app.includes('profile: "user"'), true);
});

test("a new CE signatory block is filled from the approval route and stays unsigned", () => {
	const steps = [
		{ assigneeName: "Ada Estimator", title: "Estimator", position: "Cost Estimator" },
		{ assigneeName: "Ben Lead", title: "Lead", position: "Estimating Lead" },
		{ userId: "u3", title: "Noted" },
		{ assigneeName: "Dana Head", position: "Department Head" },
		{ assigneeName: "Eli Review", position: "Reviewer" },
		{ assigneeName: "Fay Check", position: "Checker" },
		{ assigneeName: "Gus Concur", position: "Concurring Officer" },
	];
	const users = [{ userId: "u3", name: "Cara Note", position: "Noted by" }];
	const filled = routeSignatories(steps, users);
	assert.equal(filled.preparedBy, "Ada Estimator");
	assert.equal(filled.preparedTitle, "Cost Estimator");
	assert.equal(filled.checkedBy, "Ben Lead");
	assert.equal(filled.notedBy, "Cara Note");
	assert.equal(filled.notedTitle, "Noted by");
	assert.equal(filled.approvedBy, "Dana Head");
	assert.equal(filled.reviewedBy, "Eli Review");
	assert.equal(filled.checkedBy2, "Fay Check");
	assert.equal(filled.concurredBy, "Gus Concur");
	assert.equal(filled.concurredTitle, "Concurring Officer");
	assert.equal(filled.preparedStamp, undefined);
	assert.equal(signatoryPending(""), true);
	assert.equal(signatoryPending("Ada 2026-11-03 09:00"), false);
	const project = applyRouteSignatories({ preparedBy: "Kept Name", docNo: "CE-1" }, steps, users);
	assert.equal(project.preparedBy, "Kept Name");
	assert.equal(project.preparedTitle, "Cost Estimator");
	assert.equal(project.docNo, "CE-1");
	const screen = readFileSync(new URL("../../components/CeOfficialSummary.jsx", import.meta.url), "utf8");
	const roleAt = screen.indexOf("ce-sign-role");
	const lineAt = screen.indexOf("ce-sign-line");
	const nameAt = screen.indexOf("ce-sign-name");
	assert.equal(roleAt < nameAt && nameAt < lineAt, true);
	assert.equal(screen.includes("ce-sign-pending"), true);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("ceTpl2: false"), true);
	assert.equal(seed.includes("ceTpl2: true"), true);
});

test("CE withdraw is open before the final signature and blocked after it", () => {
	const open = {
		status: "For approval",
		approval: { status: "in-progress", steps: [{ decision: "" }, { decision: "", isFinal: true }] },
		projectInfo: { preparedStamp: "Ada 2026-11-03 09:00" },
	};
	const middle = {
		status: "For approval",
		approval: { status: "in-progress", steps: [{ decision: "approve" }, { decision: "", isFinal: true }] },
	};
	const done = {
		status: "Done",
		approval: { status: "accepted", steps: [{ decision: "approve", isFinal: true }] },
	};
	assert.equal(ceWithdrawAllowed(open, true), true);
	assert.equal(ceWithdrawAllowed(middle, true), true);
	assert.equal(ceWithdrawAllowed(done, true), false);
	assert.equal(ceWithdrawAllowed(open, false), false);
	assert.equal(ceReviseOnly(open), false);
	assert.equal(ceReviseOnly(done), true);
	const planned = planCeWithdraw(open, { who: "ada", remarks: "Wrong client" });
	assert.equal(planned.ok, true);
	assert.equal(planned.status, "Draft");
	assert.equal(planned.projectInfo.preparedStamp, "");
	assert.equal(planned.approval.steps.every((/** @type {any} */ step) => step.decision === ""), true);
	assert.equal(planned.entry.action, "Withdrawn");
	assert.equal(planned.notify, true);
	assert.equal(planCeWithdraw(done, { who: "ada", remarks: "Too late" }).ok, false);
	assert.equal(planCeWithdraw(open, { who: "ada", remarks: "" }).ok, false);
	const targets = withdrawRecipients({
		approval: {
			steps: [
				{ userId: "u-lead", assigneeName: "Ben Lead" },
				{ assigneeName: "Dana Head", isFinal: true },
			],
		},
	}, [{ name: "Dana Head", userId: "u-head" }]);
	assert.deepEqual(targets, ["u-lead", "u-head"]);
	assert.equal(targets.includes("*"), false);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const body = app.slice(app.indexOf("const handleCeWithdraw"), app.indexOf("const approvalWho"));
	assert.equal(body.includes("withdrawRecipients"), true);
	assert.equal(body.includes('to: "*"'), false);
	assert.equal(body.includes("toUserId"), true);
});

test("header edit updates client, project, and deadline in list readers and locks after submit", () => {
	assert.deepEqual(HEADER_EDIT_FIELDS.map((field) => field.key), [
		"clientName", "clientAddress", "attention", "projectDescription", "rceNo", "jobType", "date", "targetDeadline",
	]);
	assert.equal(HEADER_EDIT_FIELDS.find((field) => field.key === "rceNo")?.readOnly, true);
	const draft = headerEditDraft({
		status: "Draft",
		meta: { client: "Old Co", title: "Old job", date: "2026-11-01" },
		projectInfo: { preparedBy: "Ada" },
		ce: { client: "Old Co", project: "Old job", rceId: "RCE-9" },
		rce: { rceNo: "RCE-9", ceDeadline: "2026-11-20", address: "Cavite" },
	});
	assert.equal(draft.clientName, "Old Co");
	assert.equal(draft.clientAddress, "Cavite");
	assert.equal(draft.rceNo, "RCE-9");
	assert.equal(draft.locked, false);
	assert.equal(headerEditLocked("For approval"), true);
	assert.equal(headerEditLocked("Pending Lead approval"), true);
	const applied = applyHeaderEdit({
		status: "Draft",
		projectInfo: { preparedBy: "Ada", docNo: "CE-1" },
		meta: { subtitle: "keep" },
	}, {
		clientName: "New Co",
		clientAddress: "Laguna",
		attention: "Ken",
		projectDescription: "Pump overhaul",
		rceNo: "SHOULD-NOT-WRITE",
		jobType: "Onsite",
		date: "2026-11-03",
		targetDeadline: "2026-11-18",
	});
	assert.equal(applied.ok, true);
	assert.equal(applied.projectInfo.preparedBy, "Ada");
	assert.equal(applied.projectInfo.docNo, "CE-1");
	assert.equal(applied.projectInfo.client, "New Co");
	assert.equal(applied.projectInfo.location, "Laguna");
	assert.equal(applied.projectInfo.attention, "Ken");
	assert.equal(applied.projectInfo.description, "Pump overhaul");
	assert.equal(applied.projectInfo.rceNo, undefined);
	assert.equal(applied.meta.subtitle, "keep");
	assert.equal(applied.meta.title, "Pump overhaul");
	const listed = listHeaderValues(
		{ client: "Old Co", project: "Old job" },
		{ projectInfo: applied.projectInfo, meta: applied.meta },
		{ ceDeadline: "2026-11-20" },
	);
	assert.equal(listed.client, "New Co");
	assert.equal(listed.project, "Pump overhaul");
	assert.equal(listed.deadline, "2026-11-18");
	assert.equal(listed.attention, "Ken");
	const fallback = listHeaderValues({ client: "Old Co", project: "Old job" }, { projectInfo: { targetDeadline: "" }, meta: {} }, { ceDeadline: "2026-11-20" });
	assert.equal(fallback.deadline, "2026-11-20");
	assert.equal(applyHeaderEdit({ status: "For approval", projectInfo: { client: "Stay" } }, { clientName: "Nope" }).ok, false);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("ceTpl4: false"), true);
	assert.equal(app.includes("ceTpl4: src.features?.ceTpl4 === true"), true);
	assert.equal(seed.includes("ceTpl4: true"), true);
	assert.equal(app.includes("ce-header-drawer"), true);
});

test("old-format CE import ignores an extra column and keeps the file total", () => {
	const headers = ["DESCRIPTION", "QTY.", "U/M", "RATE / UNIT COST", "BRAND"];
	const body = [
		["Welding rod E6013 3.2mm", "5", "kg", "210.00", "Lincoln"],
		["SUBTOTAL", "", "", "", ""],
		["Paint, epoxy primer", "4", "gal", "1850.00", ""],
	];
	const mapped = mapCeSheet(headers, body);
	assert.deepEqual(mapped.ignored, ["BRAND"]);
	assert.equal(mapped.missing.includes("remarks"), true);
	assert.equal(mapped.rows.filter((/** @type {any} */ row) => row.skip).length, 1);
	assert.equal(mapped.rows.filter((/** @type {any} */ row) => row.selected).length, 2);
	const fileTotal = 5 * 210 + 4 * 1850;
	assert.equal(importedTotal(mapped.rows), fileTotal);
	const library = [
		{ description: "ROD, WELDING, E6013, 3.2MM" },
		{ description: "DISC, GRINDING, 4 IN" },
	];
	const exact = classifyImportMatch("ROD, WELDING, E6013, 3.2MM", library, { similarity: 0.78 });
	assert.equal(exact.kind, "exact");
	const fresh = classifyImportMatch("Paint, epoxy primer", library, { similarity: 0.9 });
	assert.equal(fresh.kind, "new");
	const filtered = applyExportPlan({
		sections: [
			{ title: "CE Summary", columns: ["Item", "Total"], rows: [["Labor", "100"]], signs: [{ name: "Ada", stamp: "signed" }] },
			{ title: "BOL", columns: ["Item", "Rate/Day"], rows: [["Welder", "500"]] },
			{ title: "MISC", columns: ["Item", "Amount"], rows: [["Power", "20"]] },
		],
		attachmentFiles: [{ name: "a.pdf" }],
	}, { format: "both", whole: false, parts: ["bol"], hidePrices: true, includeSignatures: false });
	assert.deepEqual(filtered.sections.map((/** @type {any} */ section) => section.title), ["BOL"]);
	assert.equal(filtered.sections[0].rows[0][1], "—");
	assert.equal(filtered.attachmentFiles.length, 0);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("ceTpl5: false"), true);
	assert.equal(app.includes("ceTpl5: src.features?.ceTpl5 === true"), true);
	assert.equal(seed.includes("ceTpl5: true"), true);
	assert.equal(app.includes('"aria-label": "Export"'), true);
	assert.equal(app.includes('"aria-label": "Import wizard"'), true);
	assert.equal(app.includes('"u/m"'), true);
	assert.equal(app.includes('"qty."'), true);
	assert.equal(app.includes('"line item"'), true);
});

test("a line noun is requested for approval and joins the database only after Admin approves", () => {
	assert.equal(buildNounName("bolt hex m12x50 ss304"), "BOLT, HEX, M12 x 50, SS304");
	const roles = ["staff", "sales", "lead", "guest"];
	let pending = /** @type {any[]} */ ([]);
	roles.forEach((role, index) => {
		const made = requestMasterItem({
			id: `req-${index}`,
			raw: "bolt hex m12x50 ss304",
			uom: "pc",
			category: "BOCM",
			requestedBy: `user-${role}`,
			role,
			pending,
			now: "2026-11-04T00:00:00.000Z",
		});
		pending = made.pending;
		assert.equal(made.request.status, "pending");
		assert.equal(made.request.role, role);
	});
	const stored = persistPending(pending);
	assert.equal(JSON.stringify(stored), JSON.stringify(pending));
	assert.equal(stored.length, 4);
	const blocked = approveMasterItem({ pendingId: "req-0", pending: stored, items: [], approverRole: "staff" });
	assert.equal(blocked.ok, false);
	assert.equal(blocked.items.length, 0);
	const approved = approveMasterItem({ pendingId: "req-0", pending: stored, items: [{ description: "EXISTING" }], approverRole: "admin", approverId: "admin-1" });
	assert.equal(approved.ok, true);
	assert.equal(approved.items.length, 2);
	assert.equal(approved.item.description, "BOLT, HEX, M12 x 50, SS304");
	assert.equal(approved.pending.find((row) => row.id === "req-0").status, "approved");
	const again = persistPending(approved.pending);
	assert.equal(again.find((row) => row.id === "req-1").status, "pending");
	const state = lineDbState({
		name: "bolt hex m12x50 ss304",
		pending: again,
		items: [{ description: "BOLT, HEX, M16 x 40, SS304" }],
	});
	assert.equal(state.state, "pending");
	const similar = lineDbState({
		name: "bolt hex m16x40 ss304",
		pending: [],
		items: [{ description: "BOLT, HEX, M16 x 40, SS304" }],
	});
	assert.equal(similar.state === "exact" || similar.state === "similar", true);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("ceTpl6: false"), true);
	assert.equal(app.includes("ceTpl6: src.features?.ceTpl6 === true"), true);
	assert.equal(seed.includes("ceTpl6: true"), true);
	assert.equal(app.includes("Add item to database"), true);
	assert.equal(app.includes("+ Add to DB"), true);
	assert.equal(app.includes("Link match"), true);
});

test("compiled attachments follow the saved order and keep the original extension on rename", () => {
	const files = [
		{ id: "a", name: "spec.pdf", source: "RCE", size: 12 },
		{ id: "b", name: "photo.jpg", source: "Task", size: 40 },
	];
	assert.equal(renameAttachment(files[0], "drawing-final.docx").name, "drawing-final.pdf");
	const ordered = reorderAttachments(files, 0, 1);
	assert.deepEqual(compiledAttachmentNames(ordered), ["1. photo.jpg", "2. spec.pdf"]);
	const blocked = removeAttachment(ordered, "b", "delete");
	assert.equal(blocked.ok, false);
	assert.equal(blocked.files.length, 2);
	const gone = removeAttachment(ordered, "b", "REMOVE");
	assert.deepEqual(gone.files.map((file) => file.id), ["a"]);
	const saved = copyAttachmentVersion(ordered);
	saved[0].name = "changed.jpg";
	assert.equal(ordered[0].name, "photo.jpg");
	const edited = applyAttachmentEdits(files, { order: ["b", "a"], names: { a: "ga-drawing.pdf" }, removed: [] });
	assert.deepEqual(compiledAttachmentNames(edited), ["1. photo.jpg", "2. ga-drawing.pdf"]);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("attachmentFilesInOrder"), true);
	assert.equal(app.includes("ceTpl7: false"), true);
	assert.equal(app.includes("ceTpl7: src.features?.ceTpl7 === true"), true);
	assert.equal(seed.includes("ceTpl7: true"), true);
	assert.equal(app.includes("Type REMOVE"), true);
});



