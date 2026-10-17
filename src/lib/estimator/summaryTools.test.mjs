// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { filterRows, groupSortNotes, itemLocations, keyFor, newLineFor, overrideOr, planMergeIntoScope, scheduleDays, sumBy, summaryItemKey } from "./summaryTools.js";

test("merge-into-scope adds onto a matching line (BOL matches day type + shift)", () => {
  const items = [
    { id: "a", role: "Welder", dayType: "Regular", shift: "Day", qty: 10 },
    { id: "b", role: "Welder", dayType: "Regular", shift: "Night", qty: 3 },
  ];
  assert.deepEqual(planMergeIntoScope(items, "BOL", keyFor("BOL", "Welder", "Regular", "Day"), 2), { mode: "add", itemId: "a", from: 10, to: 12 });
  assert.deepEqual(planMergeIntoScope(items, "BOL", keyFor("BOL", "Welder", "Holiday", "Day"), 2), { mode: "new", from: 0, to: 2 });
  assert.equal(planMergeIntoScope([{ id: "x", item: "Gloves", qty: 4 }], "PPE", "Gloves", 1).to, 5);
  assert.equal(planMergeIntoScope([{ id: "x", description: "Grinder", qty: 1 }], "BOTE", "Drill", 1).mode, "new");
});

test("new lines take schedule days and the database rate", () => {
  assert.equal(scheduleDays({ start: 3, end: 7 }), 5);
  assert.equal(scheduleDays(null), 1);
  const line = newLineFor("BOL", { id: "n", name: "Rigger", dayType: "Holiday", shift: "Night", qty: 2, days: 5, rate: 800, hit: { id: "m1" } });
  assert.equal(line.rate, 800);
  assert.equal(line.days, 5);
  assert.equal(summaryItemKey("BOL", line), "Rigger~Holiday~Night");
  assert.equal(newLineFor("PPE", { id: "p", name: "Hard hat", qty: 3, rate: 150 }).unitCost, 150);
});

test("itemLocations lists every breakdown line including nested subtasks", () => {
  const tasks = [{ id: "t", title: "Scope A", workType: "onsite", subtasks: [{ id: "s1", title: "Sub 1", items: { PPE: [{ id: "i1", item: "Gloves", qty: 2 }] }, children: [{ id: "s2", title: "Sub 2", items: { PPE: [{ id: "i2", item: "Gloves", qty: 1 }] } }] }] }];
  const locs = itemLocations(tasks, "PPE", "Gloves");
  assert.deepEqual(locs.map((l) => l.subtaskId), ["s1", "s2"]);
});

test("notes are grouped Onsite / Shop / Trading and sorted A to Z", () => {
  const out = groupSortNotes([
    { id: "onsite", label: "Onsite", rows: [{ who: "Zeta", notes: "z" }, { who: "alpha", notes: "a" }] },
    { id: "shop", label: "Shop", rows: [] },
    { id: "trading", label: "Trading", rows: [{ who: "B", notes: "y" }, { who: "B", notes: "x" }] },
  ]);
  assert.deepEqual(out.map((g) => g.id), ["onsite", "trading"]);
  assert.deepEqual(out[0].rows.map((r) => r.who), ["alpha", "Zeta"]);
  assert.deepEqual(out[1].rows.map((r) => r.notes), ["x", "y"]);
});

test("search filters visible rows but never the real total", () => {
  const rows = [{ d: "Grinder", subtotal: 100 }, { d: "Drill", subtotal: 50.5 }];
  const shown = filterRows(rows, "grin", (r) => r.d);
  assert.equal(shown.length, 1);
  assert.equal(sumBy(shown, (r) => r.subtotal), 100);
  assert.equal(sumBy(rows, (r) => r.subtotal), 150.5);
  assert.equal(filterRows(rows, "  ", (r) => r.d), rows);
});

test("benefit overrides fall back to the formula when cleared", () => {
  assert.equal(overrideOr(123.4, undefined), 123.4);
  assert.equal(overrideOr(123.4, ""), 123.4);
  assert.equal(overrideOr(123.4, "1,000"), 1000);
});
