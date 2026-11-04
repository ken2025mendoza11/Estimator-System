import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { routeSignatories, signatorySlots } from "./ceSignatories.js";
import { applyRemarkMark, clearAnswers, copyAnswers, estDaysRequired, fileStartPage, markAllYes, prefillRceSigns, remarkFont, remarkPlain, rceHeaderLayout, rowFilesInOrder } from "./rceTemplate.js";

test("RCE template keeps remarks, drops the onsite day rule, and pages row files", () => {
	assert.equal(estDaysRequired({ onsite: true, estDurationDays: "" }, false), true);
	assert.equal(estDaysRequired({ onsite: true, estDurationDays: "" }, true), false);
	const before = { item1: { complete: "", remarks: "keep me", files: [{ name: "a.pdf", pages: 2 }] } };
	const snap = copyAnswers(before);
	const marked = markAllYes(before, ["item1"]);
	assert.equal(marked.item1.complete, "YES");
	assert.equal(marked.item1.remarks, "keep me");
	const cleared = clearAnswers(marked, ["item1"]);
	assert.equal(cleared.item1.complete, "");
	assert.equal(cleared.item1.remarks, "keep me");
	assert.equal(snap.item1.complete, "");
	const styled = applyRemarkMark("note", { bold: true, italic: true, color: "red" });
	assert.equal(remarkPlain(styled), "note");
	assert.equal(remarkFont(styled).font, "bolditalic");
	assert.equal(remarkFont(styled).color, "red");
	const files = rowFilesInOrder({ item1: { files: [{ name: "a.pdf", pages: 2 }] }, item2: { files: [{ name: "b.png" }] } }, ["item1", "item2"]);
	assert.equal(fileStartPage(files, 1), 3);
	const signs = prefillRceSigns({}, [{ assigneeName: "Ada", position: "Cost Estimator" }], []);
	assert.equal(signs.preparedBy, "Ada");
	assert.equal(signs.preparedTitle, "Cost Estimator");
	assert.equal(routeSignatories([{ assigneeName: "Ada" }]).preparedBy, "Ada");
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	assert.equal(app.includes("rceTpl: false"), true);
	assert.equal(seed.includes("rceTpl: true"), true);
	const layout = rceHeaderLayout(true);
	assert.equal(layout.columns, 4);
	assert.equal(layout.mobileColumns, 1);
	assert.equal(layout.mobileMaxPx, 390);
	assert.equal(layout.cells[0].id, "customer");
	assert.equal(layout.cells.filter((cell) => cell.span === 2).length, 5);
	assert.equal(rceHeaderLayout(false).columns, 2);
	const css = readFileSync(new URL("../../estimator.css", import.meta.url), "utf8");
	assert.equal(css.includes(".rce-tpl .rce-field-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }"), true);
	assert.equal(css.includes("@media (max-width: 390px)"), true);
	assert.equal(css.includes(".rce-tpl .rce-cell-customer { order: 1; }"), true);
	assert.equal(css.includes(".rce-tpl .rce-cell-submission { order: 11; }"), true);
	assert.equal(app.includes("rce-cell-customer"), true);
	assert.equal(app.includes("rce-cell-rceNo"), true);
	assert.equal(app.includes("rce-cell-inquiry"), true);
	const route = [
		{ assigneeName: "Ada", position: "Cost Estimator" },
		{ assigneeName: "Ben", position: "Checker" },
		{ assigneeName: "Cara", position: "Noter" },
		{ assigneeName: "Dan", position: "Approver" },
		{ assigneeName: "Eve", position: "Reviewer" },
		{ assigneeName: "Finn", position: "Second checker" },
		{ assigneeName: "Gia", position: "Concur" },
	];
	const slots = signatorySlots({}, route, []);
	assert.equal(slots.length, 7);
	assert.equal(slots.every((slot) => slot.status === "Pending"), true);
	assert.equal(slots[0].name, "Ada");
	assert.equal(slots[0].position, "Cost Estimator");
	assert.equal(slots[6].name, "Gia");
	const signed = signatorySlots({ preparedStamp: "04 Nov 2026 10:00" }, route, []);
	assert.equal(signed[0].pending, false);
	assert.equal(signed[1].status, "Pending");
	assert.equal(app.includes("rce-sign-slots"), true);
	assert.equal(app.includes("signatorySlots"), true);
});
