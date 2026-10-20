// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canSwitchPricing,
  directBolGroups,
  directColumnTotals,
  directInputWarnings,
  dolePay,
  offerDirectSwitch,
  projectTotal,
  calcMISC,
  screenOfficialTotal,
} from "./ceTotals.js";

const examples = JSON.parse(readFileSync(new URL("./__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const legacy = JSON.parse(readFileSync(new URL("./__fixtures__/legacy-ce.json", import.meta.url), "utf8"));
const direct = { model: "direct-v1", formula: {} };

const EXPECT = {
  shop: { A: 12800, A1: 2820.51, B: 4900, C: 1800, D: 342, E: 4700, total: 27362.51 },
  onsite: { A: 57261.13, A1: 6721.15, B: 12000, C: 0, D: 2700, E: 17000, total: 95682.28 },
  trading: { A: 0, A1: 0, B: 2500, C: 24692.31, D: 0, E: 4500, total: 31692.31 },
  hybrid: { A: 70061.13, A1: 9541.66, B: 19400, C: 26492.31, D: 3042, E: 26200, total: 154737.1 },
};

test("legacy totals stay today's numbers when the pricing model is missing", () => {
  assert.equal(projectTotal(examples.shop.tasks), 24542);
  assert.equal(projectTotal(examples.onsite.tasks), 89445.63);
  assert.equal(projectTotal(examples.trading.tasks), 31692.31);
  assert.equal(projectTotal(examples.hybrid.tasks), 145679.94);
  assert.equal(projectTotal(legacy.tasks), 5576.01);
});

test("direct-v1 matches section D to the centavo", () => {
  for (const name of Object.keys(EXPECT)) {
    const cols = directColumnTotals(examples[name].tasks, direct);
    for (const key of Object.keys(EXPECT[name])) {
      assert.equal(cols[key], EXPECT[name][key], `${name} ${key}`);
    }
    assert.equal(projectTotal(examples[name].tasks, direct), EXPECT[name].total, name);
  }
  assert.equal(directColumnTotals(examples.shop.tasks, direct).bolSheet, 12800);
  assert.equal(directColumnTotals(examples.onsite.tasks, direct).bolSheet, 43961.13);
});

test("the DOLE helper matches the unit checks", () => {
  const blank = {};
  assert.equal(dolePay(700, "Regular", "Day", blank).otRate, 109.375);
  assert.equal(dolePay(700, "Sun/Special", "Day", blank).otRate, 147.875);
  assert.equal(dolePay(700, "Holiday", "Day", blank).otRate, 227.5);
  assert.ok(Math.abs(dolePay(900, "Regular", "Night", blank).dayRate - 990) < 1e-6);
  assert.equal(calcMISC({ qty: 2, days: 0, unitCost: 300 }, direct), 0);
  assert.equal(calcMISC({ qty: 2, days: "", unitCost: 300 }, direct), 600);
  assert.equal(calcMISC({ qty: 2, days: 0, unitCost: 300 }), 600);
});

test("only a draft or ongoing estimate can switch, and an approved one cannot", () => {
  assert.equal(canSwitchPricing("Draft"), true);
  assert.equal(canSwitchPricing("Ongoing"), true);
  assert.equal(canSwitchPricing("For approval"), false);
  assert.equal(canSwitchPricing("Done"), false);
  assert.equal(canSwitchPricing("accepted"), false);
});

test("the screen total equals the export total, and an override is ignored", () => {
  for (const name of Object.keys(EXPECT)) {
    const ce = examples[name];
    const screen = screenOfficialTotal(ce.tasks, direct, { C: 20000 });
    assert.equal(screen, EXPECT[name].total, name);
    assert.equal(screen, projectTotal(ce.tasks, direct), name);
  }
  assert.equal(screenOfficialTotal(examples.shop.tasks, undefined, examples.shop.summaryOverrides), 23342);
  assert.equal(screenOfficialTotal(examples.hybrid.tasks, undefined, examples.hybrid.summaryOverrides), 137987.63);
});

test("the direct BOL sheet grand is row A minus per diem", () => {
  assert.equal(directBolGroups(examples.shop.tasks, direct).grandTotal, 12800);
  assert.equal(directBolGroups(examples.onsite.tasks, direct).grandTotal, 43961.13);
});

test("an approved estimate never gets the switch offer", () => {
  assert.equal(offerDirectSwitch({ flag: true, status: "For approval", pricing: null, readOnly: false }), false);
  assert.equal(offerDirectSwitch({ flag: true, status: "Done", pricing: null, readOnly: false }), false);
  assert.equal(offerDirectSwitch({ flag: true, status: "accepted", pricing: null, readOnly: false }), false);
  assert.equal(offerDirectSwitch({ flag: false, status: "Draft", pricing: null, readOnly: false }), false);
  assert.equal(offerDirectSwitch({ flag: true, status: "Draft", pricing: direct, readOnly: false }), false);
  assert.equal(offerDirectSwitch({ flag: true, status: "Draft", pricing: null, readOnly: true }), false);
  assert.equal(offerDirectSwitch({ flag: true, status: "Ongoing", pricing: null, readOnly: false }), true);
});

test("onsite generator power is a warning and shop power is not", () => {
  assert.equal(directInputWarnings(examples.shop.tasks).some((row) => row.code === "onsite-power"), false);
  assert.equal(directInputWarnings(examples.onsite.tasks).some((row) => row.code === "onsite-power"), true);
});
