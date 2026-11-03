import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import { calcBOCM, calcBOTE, calcPPE, dolePay, mobDemobPair, projectTotal } from "./ceTotals.js";
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

test("each CE page total equals its summary line", async () => {
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const { fileURLToPath } = await import("node:url");
  if (!globalThis.document) {
    const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {}, click() {}, classList: { add() {}, remove() {} } });
    globalThis.document = { createElement: el, body: el(), querySelector() { return null; }, documentElement: el() };
  }
  if (!globalThis.localStorage) {
    const box = new Map();
    globalThis.localStorage = { getItem: (key) => box.get(key) || null, setItem: (key, value) => box.set(key, String(value)), removeItem: (key) => box.delete(key) };
  }
  if (!globalThis.window) globalThis.window = globalThis;
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const vite = await createServer({
    configFile: false,
    root,
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    logLevel: "error",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) } },
  });
  try {
    const mod = await vite.ssrLoadModule("/scripts/pdf-page-totals.js");
    const { summary, pages } = await mod.renderedPageChecks();
    ["BOL", "BOTE", "BOCM", "PPE", "MISC", "MOB", "DEMOB"].forEach((key) => {
      assert.notEqual(summary[key], null, `summary ${key}`);
      if (pages[key] == null) assert.equal(summary[key], 0, key);
      else assert.equal(pages[key], summary[key], key);
    });
  } finally {
    await vite.close();
  }
});

test("CE lists use the saved mob and demob sheet totals", () => {
  const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
  [
    "projectTotal(tasks, doc?.pricing, doc?.mobSheets)",
    "projectTotal(tasks, pricing, mobSheets)",
    "projectTotal(doc.tasks, doc.pricing, doc.mobSheets)",
    "projectTotal(doc?.tasks || [], doc?.pricing, doc?.mobSheets)",
    "projectTotal(tasksOfType(tasks, w.id), pricing, mobSheets)",
    "mobSheetTotals(state.tasks, snaps)",
  ].forEach((snippet) => assert.equal(app.includes(snippet), true, snippet));
  const sheets = { mobilization: 10, demobilization: 5 };
  assert.equal(projectTotal(examples.onsite.tasks, direct, sheets), 95697.28);
  assert.equal(projectTotal(examples.onsite.tasks, direct), 95682.28);
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

test("inspection screen follows the inspection PDF section order", () => {
  const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
  const staff = readFileSync(new URL("../../components/staffModules.jsx", import.meta.url), "utf8");
  const screen = app.slice(app.indexOf('className: "oif-sheet"'), app.indexOf("function ElCalculatorView"));
  const order = ["A. JOB TYPE", "B. WORK PIECE MEASUREMENT", "C. SCOPE OF WORK", "D. MATERIALS", "G. ACTIVITY DURATION WITH MANPOWER", "H. PHOTOS", "I. REMARKS AND NOTES"];
  let at = 0;
  order.forEach((label) => {
    const next = screen.indexOf(label, at);
    assert.equal(next > at, true, label);
    at = next;
  });
  assert.equal(screen.indexOf("H. PHOTOS") > screen.indexOf("A. JOB TYPE"), true);
  const form = staff.slice(staff.indexOf("export function InspectionFormView"), staff.indexOf("const EL_STANDARDS"));
  assert.equal(form.includes("RFQ NO."), false);
  assert.equal(form.includes("ONSITE INSPECTOR"), false);
  assert.equal(form.includes("RCE NO."), true);
  assert.equal(form.includes("DATE INSPECTED"), true);
  assert.equal(form.includes("CLIENT ADDRESS"), true);
  at = 0;
  ["A. JOB TYPE", "B. WORK PIECE MEASUREMENT", "C. SCOPE OF WORK", "D. MATERIALS", "G. ACTIVITY DURATION WITH MANPOWER", "H. PHOTOS"].forEach((label) => {
    const next = form.indexOf(label, at);
    assert.equal(next > at, true, label);
    at = next;
  });
});
