import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { freezeOffsets, freezePlan, stickyBarVisible } from "./stickyTable.js";

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
