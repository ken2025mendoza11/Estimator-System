// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import { calcBOCM, calcBOTE, calcPPE, dolePay, mobDemobPair, projectTotal, resolveDoleDay } from "./ceTotals.js";
import { fillCeTemplate } from "./ceExcelTemplate.js";

const examples = JSON.parse(readFileSync(new URL("./__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const direct = { model: "direct-v1", formula: {} };

test("DOLE multipliers cover each day type and shift", () => {
  const blank = {};
  const rows = [
    ["Regular", "Day", 700, 125, 1],
    ["Regular", "Night", 700, 137.5, 1.1],
    ["Sun/Special", "Day", 700, 169, 1.3],
    ["Sun/Special", "Night", 700, 185.9, 1.43],
    ["Special on rest", "Day", 800, 195, 1.5],
    ["Special on rest", "Night", 800, 214.5, 1.65],
    ["Holiday", "Day", 700, 260, 2],
    ["Holiday", "Night", 700, 286, 2.2],
    ["Holiday on rest", "Day", 500, 338, 2.6],
    ["Holiday on rest", "Night", 500, 371.8, 2.86],
  ];
  rows.forEach(([day, shift, rate, otPct, dayMult]) => {
    const pay = dolePay(rate, day, shift, blank);
    const hourly = rate / 8;
    assert.equal(resolveDoleDay(day) === "regular" ? pay.otFactor : pay.otFactor, day === "Regular" ? 1.25 : 1.3);
    assert.ok(Math.abs(pay.otRate - hourly * (otPct / 100)) < 0.02, `${day} ${shift} ot`);
    assert.ok(Math.abs(pay.dayRate - rate * dayMult) < 0.02, `${day} ${shift} day`);
  });
});

test("mobilization and demobilization are in the onsite total only", () => {
  assert.equal(mobDemobPair(examples.shop.tasks).total, 0);
  assert.equal(mobDemobPair(examples.trading.tasks).total, 0);
  assert.equal(mobDemobPair(examples.onsite.tasks).total, 11600);
  assert.equal(projectTotal(examples.onsite.tasks, direct), 107282.28);
  assert.equal(projectTotal(examples.shop.tasks, direct), 27362.51);
  assert.equal(projectTotal(examples.trading.tasks, direct), 31692.31);
  assert.equal(projectTotal(examples.hybrid.tasks, direct), 166337.1);
});

test("BOTE, BOCM, and PPE row totals", () => {
  const bote = calcBOTE({ qty: 2, days: 3, rate: 100, powerKw: 5, hoursPerDay: 8, kwhRate: 12 }, "shop");
  assert.equal(bote, 2 * 3 * 100 + 5 * 8 * 3 * 12 * 2);
  assert.equal(calcBOTE({ qty: 2, days: 3, rate: 100, powerKw: 5, hoursPerDay: 8, kwhRate: 12 }, "onsite"), 600);
  assert.equal(calcBOCM({ qty: 4, unitCost: 12.5 }), 50);
  assert.equal(calcPPE({ qty: 3, unitCost: 10 }), 30);
});

test("old column names are gone from the screens and the outputs", () => {
  const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
  ["Rate / Unit Cost", "Role / Position", "Line Item"].forEach((phrase) => {
    assert.equal(app.includes(phrase), false, phrase);
  });
});

test("excel template has no unresolved names, no blank item rows, and the same total", async () => {
  const total = projectTotal(examples.onsite.tasks, direct);
  const boteAmount = 2 * 4 * 50 + 1 * 8 * 4 * 10 * 2;
  const filled = await fillCeTemplate({
    total,
    summary: [
      { item: "B.", label: "TOOLS AND EQUIPMENTS", amount: boteAmount },
      { item: "", label: "MOBILIZATION", amount: 5800 },
      { item: "", label: "DEMOBILIZATION", amount: 5800 },
    ],
    pages: {
      BOL: [{ designation: "Rigger", qty: 4, days: 8, unitPrice: 700, amount: 22400 }],
      BOTE: [{ description: "Machine", qty: 2, days: 4, unitPrice: 50, electricity: 640, amount: boteAmount }],
      BOCM: [{ description: "Rod", qty: 4, unitPrice: 12.5, amount: 50 }],
      PPE: [{ description: "Gloves", qty: 3, unitPrice: 10, amount: 30 }],
      MISC: [{ description: "Fare", qty: 1, days: 1, unitPrice: 200, amount: 200 }],
    },
  });
  assert.deepEqual(filled.unresolved, []);
  assert.equal(filled.total, total);
  assert.equal(filled.pageTotals.BOTE, boteAmount);
  assert.equal(filled.pageTotals.BOCM, 50);
  assert.equal(filled.pageTotals.PPE, 30);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(filled.buffer);
  const bote = wb.getWorksheet("BOTE");
  assert.equal(bote.getRow(3).getCell(7).value, boteAmount);
  assert.equal(bote.getRow(4).hidden, true);
  assert.equal(bote.getRow(3).hidden, false);
  const summary = wb.getWorksheet("Summary");
  const totalCell = summary.getRow(14).getCell(3).value;
  assert.equal(totalCell.result, total);
  assert.equal(typeof totalCell.result, "number");
});
