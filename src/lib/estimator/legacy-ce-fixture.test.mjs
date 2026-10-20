import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ce = JSON.parse(
  readFileSync(new URL("./__fixtures__/legacy-ce.json", import.meta.url), "utf8"),
);

/** @param {any[] | undefined} subs @param {(sub: any) => void} visit */
function walk(subs, visit) {
  for (const sub of subs || []) {
    visit(sub);
    walk(sub.children, visit);
  }
}

test("the legacy fixture keeps today's pricing fields", () => {
  assert.equal(ce.id, "CE-TEST-LEGACY");
  assert.equal(ce.status, "Draft");
  assert.equal(ce.pricing, undefined);
  assert.equal(ce.commercial.contingencyPct, 5);
  assert.equal(ce.commercial.discountPct, 2);
  assert.equal(ce.summaryOverrides.C, 20000);
});

test("the legacy fixture has holiday OT, per diem, unsectioned MISC, and a nested subtask", () => {
  /** @type {{ cat: string, item: any }[]} */
  const lines = [];
  let nested = false;
  for (const task of ce.tasks) {
    walk(task.subtasks, (sub) => {
      if ((sub.children || []).length) nested = true;
      for (const cat of Object.keys(sub.items || {})) {
        for (const item of sub.items[cat]) lines.push({ cat, item });
      }
    });
  }
  assert.equal(nested, true);
  assert.ok(lines.some((row) => row.cat === "BOL" && row.item.dayType === "Holiday" && row.item.otHrs > 0));
  assert.ok(lines.some((row) => row.cat === "BOL" && row.item.perDiem > 0));
  assert.ok(lines.some((row) => row.cat === "MISC" && row.item.section === ""));
});
