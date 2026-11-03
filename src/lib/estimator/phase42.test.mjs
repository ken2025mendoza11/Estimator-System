import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { freezeOffsets, freezePlan, stickyBarVisible } from "./stickyTable.js";
import { applyRouteSignatories, routeSignatories, signatoryPending } from "./ceSignatories.js";
import { ceReviseOnly, ceWithdrawAllowed, planCeWithdraw } from "./ceWithdraw.js";
import { applyHeaderEdit, headerEditDraft, headerEditLocked, HEADER_EDIT_FIELDS, listHeaderValues } from "./ceHeaderEdit.js";

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

