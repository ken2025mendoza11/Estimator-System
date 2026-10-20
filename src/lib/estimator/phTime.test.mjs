import assert from "node:assert/strict";
import test from "node:test";
import { phDate, phStamp, phYear } from "./phTime.js";
import { todayLocal } from "./workflow.js";

test("16:30 UTC is the next Philippine day", () => {
  const instant = new Date("2026-01-01T16:30:00.000Z");
  assert.equal(phDate(instant), "2026-01-02");
  assert.equal(phYear(instant), 2026);
  assert.equal(phStamp(instant, "Estimator"), "Estimator  2026-01-02 00:30");
});

test("midnight UTC is still the same Philippine day", () => {
  const instant = new Date("2026-06-15T00:00:00.000Z");
  assert.equal(phDate(instant), "2026-06-15");
  assert.equal(phStamp(instant, "A"), "A  2026-06-15 08:00");
});

test("todayLocal defaults to Manila", () => {
  assert.equal(todayLocal(), phDate(new Date()));
});
