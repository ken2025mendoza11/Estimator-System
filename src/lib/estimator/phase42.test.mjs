import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { freezeOffsets, freezePlan, stickyBarVisible } from "./stickyTable.js";
import { applyRouteSignatories, routeSignatories, signatoryPending } from "./ceSignatories.js";

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
