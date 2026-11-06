import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../estimator.css", import.meta.url), "utf8");
const card = readFileSync(new URL("../../components/SalesUserCard.jsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../../components/MethodologyEditor.jsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../components/MethodologiesPanel.jsx", import.meta.url), "utf8");

test("the user card shows department and position badges, never a StaffRole label", () => {
	assert.equal(card.includes("StaffRole"), false);
	assert.equal(card.includes("Role · {role}"), true);
	assert.equal(card.includes("set by Admin"), true);
	assert.equal(card.includes("TEST BUILD ONLY"), true);
	assert.equal(card.includes("My Profile"), true);
	assert.equal(card.includes("E-signature"), true);
	assert.equal(/role\$\/i\.test\(source\)/.test(card), true);
});

test("monitoring actions are icon buttons and the database does not force a second scrollbar", () => {
	assert.equal(app.includes('className: "mon-icon-btn is-chat"'), true);
	assert.equal(app.includes('className: "mon-icon-btn is-ok"'), true);
	assert.equal(app.includes('aria-label": followText'), true);
	assert.equal(app.includes('label: "Approve with comment"'), true);
	assert.equal(app.includes('label: "Request edit"'), true);
	assert.equal(app.includes("calc(100% + 320px)"), false);
	assert.equal(app.includes('synthetic: "actions"'), true);
	assert.equal(css.includes("overflow:scroll auto"), false);
	assert.equal(css.includes(".ce-sticky-scroller { overflow-x: hidden; overflow-y: auto; }"), true);
	assert.equal(css.includes("min-width: max-content"), true);
	assert.equal(css.includes(".mon-icon-btn"), true);
});

test("the methodology ribbon is one strip over a typing page and has no equation control", () => {
	assert.equal(editor.includes("method-ribbon"), true);
	assert.equal(editor.includes("method-sheet"), true);
	assert.equal(editor.includes("Equation"), false);
	assert.equal(editor.includes('aria-label="Font"'), true);
	assert.equal(editor.includes('aria-label="Paragraph"'), true);
	assert.equal(editor.includes('aria-label="Symbol"'), true);
	assert.equal(panel.includes("+ New methodology"), true);
	assert.equal(panel.includes("Import Word"), true);
	assert.equal(panel.includes("Export Word"), true);
	assert.equal((panel.match(/\+ New methodology/g) || []).length, 1);
});
