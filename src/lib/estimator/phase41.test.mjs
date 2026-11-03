import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import { calcBOCM, calcBOTE, calcPPE, categoryOnTask, buildOfficialBaseRows, dolePay, mobDemobPair, projectTotal } from "./ceTotals.js";
import { createJobOrder, normalizeLeadtime, patchJobOrder } from "./jobOrder.js";
import { buildCeExcelModel, fillCeTemplate } from "./ceExcelTemplate.js";

const examples = JSON.parse(readFileSync(new URL("./__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const direct = { model: "direct-v1", formula: {} };
const template = readFileSync(new URL("../../../public/templates/ce-template.xlsx", import.meta.url));

test("DOLE multipliers cover each day type and shift", () => {
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
  rows.forEach((row) => {
    const day = String(row[0]);
    const shift = String(row[1]);
    const rate = Number(row[2]);
    const otPct = Number(row[3]);
    const dayMult = Number(row[4]);
    const pay = dolePay(rate, day, shift);
    const hourly = rate / 8;
    assert.equal(pay.otFactor, day === "Regular" ? 1.25 : 1.3);
    assert.ok(Math.abs(pay.otRate - hourly * (otPct / 100)) < 0.02, `${day} ${shift} ot`);
    assert.ok(Math.abs(pay.dayRate - rate * dayMult) < 0.02, `${day} ${shift} day`);
  });
});

test("mobilization and demobilization follow the sheet, or zero", () => {
  assert.equal(mobDemobPair(examples.shop.tasks).total, 0);
  assert.equal(mobDemobPair(examples.trading.tasks).total, 0);
  assert.equal(mobDemobPair(examples.onsite.tasks).total, 0);
  assert.equal(projectTotal(examples.onsite.tasks, direct), 95682.28);
  assert.equal(projectTotal(examples.shop.tasks, direct), 27362.51);
  assert.equal(projectTotal(examples.trading.tasks, direct), 31692.31);
  assert.equal(projectTotal(examples.hybrid.tasks, direct), 154737.1);
  const typed = mobDemobPair(examples.onsite.tasks, {
    mobilization: { lines: [{ qty: 2, days: 3, rate: 100 }] },
    demobilization: { total: 40 },
  });
  assert.equal(typed.mobilization, 600);
  assert.equal(typed.demobilization, 40);
  assert.equal(mobDemobPair(examples.onsite.tasks, { mobilization: 80 }).demobilization, 0);
  assert.equal(projectTotal(examples.onsite.tasks, direct, { mobilization: 10, demobilization: 5 }), 95697.28);
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

test("excel page totals match the summary, with no blank item rows", async () => {
  const tasks = examples.onsite.tasks;
  const total = projectTotal(tasks, direct);
  const filled = await fillCeTemplate(ExcelJS, template, buildCeExcelModel({
    tasks,
    pricing: direct,
    ceNumber: "SY3-CE-TEST",
    sections: [{ title: "CE Summary", projectBlock: { client: "Client", description: "Job", quantity: 1 } }],
  }));
  assert.deepEqual(filled.unresolved, []);
  assert.equal(filled.total, total);
  assert.equal(filled.pageTotals.BOL + filled.pageTotals.BOTE + filled.pageTotals.BOCM + filled.pageTotals.PPE + filled.pageTotals.MISC + filled.pageTotals.MOB + filled.pageTotals.DEMOB + 6721.15, total);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(filled.buffer);
  assert.equal(wb.getWorksheet("Summary"), undefined);
  for (const name of ["CE SUMMARY", "SOW Breakdown", "SCOPE", "MOB & DEMOB", "BOL", "BOTE", "BOCM", "PPE", "MISC."]) {
    assert.ok(wb.getWorksheet(name), name);
  }
  const bote = wb.getWorksheet("BOTE");
  if (!bote) throw new Error("BOTE sheet missing");
  assert.equal(bote.getRow(12).hidden, true);
  const summary = wb.getWorksheet("CE SUMMARY");
  if (!summary) throw new Error("CE SUMMARY missing");
  /** @param {string} addr */
  const cell = (addr) => {
    const value = summary.getCell(addr).value;
    if (value && typeof value === "object" && "formula" in value) {
      if (value.result == null || value.result === "") return 0;
      return value.result;
    }
    return value;
  };
  assert.equal(cell("L15"), filled.pageTotals.MOB);
  assert.equal(cell("L16"), filled.pageTotals.DEMOB);
  assert.equal(cell("L17"), filled.pageTotals.BOL);
  assert.equal(cell("L25"), filled.pageTotals.BOTE);
  assert.equal(cell("L26"), filled.pageTotals.BOCM);
  assert.equal(cell("L27"), filled.pageTotals.PPE);
  assert.equal(cell("L36"), total);
  assert.equal(summary.getRow(24).hidden, false);
  const label = (row) => [summary.getCell(`B${row}`).value, summary.getCell(`C${row}`).value, summary.getCell(`D${row}`).value].map((value) => String(value || "")).join(" ");
  assert.equal(label(15).includes("MOBILIZATION"), true);
  assert.equal(label(16).includes("DEMOBILIZATION"), true);
  assert.equal(label(17).includes("MANPOWER"), true);
  assert.equal(label(24).includes("BENEFITS"), true);
  let visible = 0;
  for (let r = 15; r <= 34; r++) {
    if (summary.getRow(r).hidden) continue;
    visible += Number(cell(`L${r}`)) || 0;
  }
  assert.equal(Math.round(visible * 100) / 100, Math.round(Number(cell("L36")) * 100) / 100);
});

test("each CE page total equals its summary line", () => {
  const tasks = examples.onsite.tasks;
  const sheets = {
    mobilization: { lines: [{ qty: 2, days: 1, rate: 150 }] },
    demobilization: { lines: [{ amount: 80 }] },
  };
  const official = buildOfficialBaseRows(tasks, direct, sheets);
  /** @param {string} key */
  const line = (key) => {
    const row = official.rows.find((item) => item.key === key);
    if (!row) throw new Error(key);
    return row.computed;
  };
  /** @param {string} cat */
  const sumCat = (cat) => tasks.reduce((/** @type {number} */ sum, /** @type {any} */ task) => sum + categoryOnTask(task, cat, direct), 0);
  assert.equal(line("B"), sumCat("BOTE"));
  assert.equal(line("C"), sumCat("BOCM"));
  assert.equal(line("D"), sumCat("PPE"));
  assert.equal(line("E"), sumCat("MISC"));
  assert.equal(line("MOB"), 300);
  assert.equal(line("DEMOB"), 80);
  const manpower = official.rows.find((row) => row.key === "A");
  if (!manpower) throw new Error("A");
  assert.equal(line("A"), manpower.computed);
  const pair = mobDemobPair(tasks, sheets);
  assert.equal(projectTotal(tasks, direct, sheets), official.total);
  assert.equal(pair.mobilization, line("MOB"));
  assert.equal(pair.demobilization, line("DEMOB"));
});

test("job order keeps lead time, mobilization, and annex A", () => {
  const created = createJobOrder({
    byUserId: "sales-1",
    seq: 1,
    type: "SW",
    clientCode: "ABC",
    year: 2026,
    controlNo: "0137",
    ceIds: ["CE-1"],
    poStoragePath: "job-order/draft/po.pdf",
    poFileName: "po.pdf",
    leadtime: [{ span: "One (1) Day", text: "Mobilization" }, ["Two (2) Days", "Pull-out"]],
    mobilization: "2026-11-16",
    mobilizationNote: "As per client's advice",
    annexA: true,
  });
  assert.equal(created.ok, true);
  assert.equal(created.jobOrder.annexA, true);
  assert.equal(created.jobOrder.mobilization, "2026-11-16");
  assert.deepEqual(normalizeLeadtime(created.jobOrder.leadtime), [
    { span: "One (1) Day", text: "Mobilization" },
    { span: "Two (2) Days", text: "Pull-out" },
  ]);
  const patched = patchJobOrder(created.jobOrder, { annexA: false, mobilizationNote: "Hold" });
  assert.equal(patched.ok, true);
  assert.equal(patched.jobOrder.annexA, false);
  assert.equal(patched.jobOrder.mobilizationNote, "Hold");
  assert.equal(patched.jobOrder.joNo, created.jobOrder.joNo);
});
