import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { checksumTotal, commercialNet, finiteNumber, miscAmount, qtyUnitAmount, roundMoney } from "./money.js";
import { overrideOr } from "./summaryTools.js";

const appUrl = new URL("../../components/CostEstimatorApp.jsx", import.meta.url);
const movedUrl = new URL("./ceTotals.js", import.meta.url);
const examples = JSON.parse(readFileSync(new URL("./__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const legacy = JSON.parse(readFileSync(new URL("./__fixtures__/legacy-ce.json", import.meta.url), "utf8"));

const NAMES = [
  "num2",
  "DAY_TYPES",
  "CATS",
  "WORK_TYPES",
  "DEFAULT_TEMPLATE_FORMULA",
  "activeTemplateFormula",
  "formulaNum",
  "normalizeTemplateFormula",
  "formulaNow",
  "dayTypeMultiplier",
  "normalizeWorkType",
  "taskWorkType",
  "tasksOfType",
  "chargesPower",
  "calcBOL",
  "calcBOTE",
  "calcBOCM",
  "calcPPE",
  "calcMISC",
  "miscBucket",
  "buildOfficialBaseRows",
  "boteElectricityCost",
  "itemSubtotal",
  "categoryTotal",
  "subtaskTotal",
  "flattenSubs",
  "categoryOnTask",
  "botePowerOnTask",
  "taskTotal",
  "projectTotal",
  "computeSchedule",
  "getScheduledItemMap",
  "buildBolGroups",
  "BOL_SHIFT_GROUPS",
  "bolLineAmount",
  "withBolEdit",
];

/** @param {string} text @param {number} start */
function declarationEnd(text, start) {
  const isFunction = /^function\b/.test(text.slice(start, start + 20));
  let i = start;
  const stack = [{ brace: 0, bracket: 0, paren: 0, expr: false }];
  /** @type {string[]} */
  const modes = ["code"];
  let sawBody = false;
  const top = () => stack[stack.length - 1];
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    const mode = modes[modes.length - 1];
    if (mode === "line") {
      if (c === "\n") modes.pop();
      i += 1;
      continue;
    }
    if (mode === "block") {
      if (c === "*" && n === "/") {
        modes.pop();
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (mode === "sq" || mode === "dq") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if ((mode === "sq" && c === "'") || (mode === "dq" && c === '"')) modes.pop();
      i += 1;
      continue;
    }
    if (mode === "tpl") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        modes.pop();
        i += 1;
        continue;
      }
      if (c === "$" && n === "{") {
        modes.push("code");
        stack.push({ brace: 0, bracket: 0, paren: 0, expr: true });
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === "/" && n === "/") {
      modes.push("line");
      i += 2;
      continue;
    }
    if (c === "/" && n === "*") {
      modes.push("block");
      i += 2;
      continue;
    }
    if (c === "'") {
      modes.push("sq");
      i += 1;
      continue;
    }
    if (c === '"') {
      modes.push("dq");
      i += 1;
      continue;
    }
    if (c === "`") {
      modes.push("tpl");
      i += 1;
      continue;
    }
    if (c === "{") {
      top().brace += 1;
      if (isFunction) sawBody = true;
      i += 1;
      continue;
    }
    if (c === "}") {
      const frame = top();
      if (frame.brace > 0) {
        frame.brace -= 1;
        i += 1;
        if (
          isFunction &&
          sawBody &&
          stack.length === 1 &&
          frame.brace === 0 &&
          frame.bracket === 0 &&
          frame.paren === 0
        ) {
          return i;
        }
        continue;
      }
      if (frame.expr && frame.bracket === 0 && frame.paren === 0) {
        stack.pop();
        modes.pop();
        i += 1;
        continue;
      }
      throw new Error(`extra } at ${i}`);
    }
    if (c === "[") {
      top().bracket += 1;
      i += 1;
      continue;
    }
    if (c === "]") {
      top().bracket -= 1;
      i += 1;
      continue;
    }
    if (c === "(") {
      top().paren += 1;
      i += 1;
      continue;
    }
    if (c === ")") {
      top().paren -= 1;
      i += 1;
      continue;
    }
    if (
      !isFunction &&
      c === ";" &&
      stack.length === 1 &&
      top().brace === 0 &&
      top().bracket === 0 &&
      top().paren === 0
    ) {
      return i + 1;
    }
    i += 1;
  }
  throw new Error(`unterminated declaration at ${start}`);
}

/** @param {string} text @param {Set<string>} want */
function takeDeclarations(text, want) {
  const re =
    /^(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z0-9_]+)\s*\(|(?:var|let|const)\s+([A-Za-z0-9_]+)\s*=)/gm;
  /** @type {string[]} */
  const chunks = [];
  let found = re.exec(text);
  while (found) {
    const name = found[1] || found[2];
    if (want.has(name)) {
      const end = declarationEnd(text, found.index);
      chunks.push(text.slice(found.index, end));
      want.delete(name);
    }
    found = re.exec(text);
  }
  return chunks;
}

function loadEngine() {
  const sources = [readFileSync(appUrl, "utf8")];
  if (existsSync(fileURLToPath(movedUrl))) sources.push(readFileSync(movedUrl, "utf8"));
  const want = new Set(NAMES);
  const chunks = sources.flatMap((text) => takeDeclarations(text, want));
  if (want.size) throw new Error(`missing declarations: ${[...want].join(", ")}`);
  const appSource = sources[0];
  const mark = "const benefitsMap = {}";
  const markAt = appSource.indexOf(mark);
  if (markAt < 0 || appSource.indexOf(mark, markAt + 1) !== -1) throw new Error("benefitsMap anchor");
  const endAt = appSource.indexOf("const displayBenefitsData", markAt);
  if (endAt < 0) throw new Error("displayBenefitsData anchor");
  const benefitsSlice = appSource.slice(markAt, endAt);
  const script = `${chunks.join("\n")}
function summarySort(rows, _category, labelOf) {
  const label = (row) => String(labelOf(row) || "").trim();
  return (rows || []).slice().sort((a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: "base" }));
}
function benefitsRows(tasks) {
  const full = buildBolGroups(tasks);
  const allBOL = full.allBOL;
  const scheduleMap = getScheduledItemMap(tasks, "BOL");
  const benefitEdits = {};
  ${benefitsSlice}
  return benefitsData;
}
function bolSheet(tasks) {
  const bolEdits = {};
  let sum = 0;
  const rows = [];
  WORK_TYPES.forEach((w) => {
    const model = buildBolGroups(tasksOfType(tasks, w.id));
    BOL_SHIFT_GROUPS.forEach((g) => {
      Object.values(model.groups[g.dt]?.[g.shift] || {}).forEach((row) => {
        const edited = withBolEdit(row, bolEdits[w.id + "|" + g.dt + "|" + g.shift + "|" + row.role], g.dt, g.shift);
        sum += num2(edited.subtotal);
        rows.push({
          workType: w.id,
          dayType: g.dt,
          shift: g.shift,
          role: row.role,
          qty: edited.qty,
          days: edited.days,
          rate: edited.rate,
          otHrs: edited.otHrs,
          subtotal: edited.subtotal,
        });
      });
    });
  });
  return { grandTotal: roundMoney(sum), rows };
}
function shownAmount(ce, row) {
  const raw = ce.summaryOverrides?.[row.key];
  if (raw === undefined || raw === "") return num2(row.computed);
  return num2(raw);
}
function exportOfficial(ce) {
  const official = buildOfficialBaseRows(ce.tasks || []);
  const bodyParts = official.rows.filter((r) => ["A", "B", "C", "D"].includes(r.key)).reduce((s, r) => s + shownAmount(ce, r), 0);
  const miscParts = official.rows.filter((r) => r.sub && !r.breakdown).reduce((s, r) => s + shownAmount(ce, r), 0);
  const rows = {};
  official.rows.forEach((r) => {
    rows[r.key] = r.key === "E" ? miscParts : shownAmount(ce, r);
  });
  return { bodySum: bodyParts + miscParts, rows, computedC: official.rows.find((r) => r.key === "C").computed };
}
function screenOfficial(ce) {
  const official = buildOfficialBaseRows(ce.tasks || []);
  const miscShown = roundMoney(
    official.rows.filter((r) => r.sub && !r.breakdown).reduce((s, r) => s + roundMoney(shownAmount(ce, r)), 0),
  );
  return roundMoney(
    official.rows.filter((r) => ["A", "B", "C", "D"].includes(r.key)).reduce((s, r) => s + roundMoney(shownAmount(ce, r)), 0) +
      miscShown,
  );
}
function netOf(ce) {
  const grand = projectTotal(ce.tasks || []);
  const cont = num2(ce.commercial?.contingencyPct);
  const disc = num2(ce.commercial?.discountPct);
  return {
    grand,
    screen: checksumTotal(grand * (1 + cont / 100) * (1 - disc / 100)),
    cover: checksumTotal(commercialNet(grand, cont, disc)),
  };
}
globalThis.__ce = {
  calcBOL, calcMISC, projectTotal, formulaNow, buildOfficialBaseRows, benefitsRows, bolSheet, exportOfficial, screenOfficial, netOf,
};
`;
  /** @type {any} */
  const context = vm.createContext({
    roundMoney,
    qtyUnitAmount,
    miscAmount,
    checksumTotal,
    commercialNet,
    finiteNumber,
    overrideOr,
  });
  vm.runInContext(script, context, { filename: "ce-totals-golden.js" });
  return context.__ce;
}

const api = loadEngine();

/** @param {any[]} rows */
function benefitsOf(rows) {
  return rows.map((row) => ({
    role: row.role,
    maxDailyQty: row.maxDailyQty,
    activeDays: row.activeDays,
    rate: row.rate,
    monthlyRate: row.monthlyRate,
    thirteenth: row.thirteenth,
    sss: row.sss,
    hdmf: row.hdmf,
    phic: row.phic,
    perDiem: row.perDiem,
    allowance: row.allowance,
    totalBenefits: row.totalBenefits,
  }));
}

const welderBenefit = {
  role: "Welder",
  maxDailyQty: 2,
  activeDays: 8,
  rate: 800,
  monthlyRate: 20800,
  thirteenth: 1733.3333333333333,
  sss: 936,
  hdmf: 416,
  phic: 624,
  perDiem: 4000,
  allowance: 0,
  totalBenefits: 7709.333333333333,
};
const electricianBenefit = {
  role: "Electrician",
  maxDailyQty: 2,
  activeDays: 3,
  rate: 900,
  monthlyRate: 23400,
  thirteenth: 1950,
  sss: 1053,
  hdmf: 468,
  phic: 702,
  perDiem: 1050,
  allowance: 0,
  totalBenefits: 5223,
};
const riggerBenefit = {
  role: "Rigger",
  maxDailyQty: 4,
  activeDays: 8,
  rate: 700,
  monthlyRate: 18200,
  thirteenth: 1516.6666666666667,
  sss: 819,
  hdmf: 364,
  phic: 546,
  perDiem: 2800,
  allowance: 0,
  totalBenefits: 6045.666666666667,
};

const shopBol = [
  { workType: "shop", dayType: "Regular", shift: "Day", role: "Welder", qty: 2, days: 8, rate: 800, otHrs: 0, subtotal: 12800 },
];
const onsiteBol = [
  { workType: "onsite", dayType: "Regular", shift: "Day", role: "Rigger", qty: 4, days: 8, rate: 700, otHrs: 2, subtotal: 29400 },
  { workType: "onsite", dayType: "Regular", shift: "Night", role: "Electrician", qty: 2, days: 3, rate: 900, otHrs: 1, subtotal: 6868.13 },
  { workType: "onsite", dayType: "Sun/Special", shift: "Day", role: "Rigger", qty: 4, days: 1, rate: 700, otHrs: 2, subtotal: 4777.5 },
  { workType: "onsite", dayType: "Holiday", shift: "Day", role: "Rigger", qty: 4, days: 1, rate: 700, otHrs: 2, subtotal: 7350 },
];

/** @type {Record<string, any>} */
const LOCK = {
  shop: {
    grand: 24542,
    official: 23342,
    net: 24542,
    bol: 12800,
    rows: { A: 12800, B: 4900, C: 1800, D: 342, E: 3500, E1: 0, E2: 3500, E3: 0, E4: 0, E5: 0, E6: 0 },
    bolRows: shopBol,
    benefits: [welderBenefit],
  },
  onsite: {
    grand: 89445.63,
    official: 89445.63,
    net: 89445.63,
    bol: 48395.63,
    rows: { A: 57145.63, B: 12000, C: 0, D: 2700, E: 17600, E1: 12000, E2: 5600, E3: 0, E4: 0, E5: 0, E6: 0 },
    bolRows: onsiteBol,
    benefits: [electricianBenefit, riggerBenefit],
  },
  trading: {
    grand: 31692.31,
    official: 31692.31,
    net: 31692.31,
    bol: 0,
    rows: { A: 0, B: 2500, C: 24692.31, D: 0, E: 4500, E1: 0, E2: 4500, E3: 0, E4: 0, E5: 0, E6: 0 },
    bolRows: [],
    benefits: [],
  },
  hybrid: {
    grand: 145679.94,
    official: 137987.63,
    net: 152963.94,
    bol: 61195.63,
    rows: { A: 69945.63, B: 19400, C: 20000, D: 3042, E: 25600, E1: 12000, E2: 13600, E3: 0, E4: 0, E5: 0, E6: 0 },
    bolRows: [...onsiteBol, ...shopBol],
    benefits: [electricianBenefit, riggerBenefit, welderBenefit],
  },
  legacy: {
    grand: 5576.01,
    official: 24375,
    net: 5737.71,
    bol: 3675,
    rows: { A: 4375, B: 0, C: 20000, D: 0, E: 0, E1: 0, E2: 0, E3: 0, E4: 0, E5: 0, E6: 0 },
    bolRows: [
      { workType: "onsite", dayType: "Holiday", shift: "Day", role: "Rigger", qty: 2, days: 1, rate: 700, otHrs: 2, subtotal: 3675 },
    ],
    benefits: [
      {
        role: "Rigger",
        maxDailyQty: 2,
        activeDays: 1,
        rate: 700,
        monthlyRate: 18200,
        thirteenth: 1516.6666666666667,
        sss: 819,
        hdmf: 364,
        phic: 546,
        perDiem: 350,
        allowance: 0,
        totalBenefits: 3595.666666666667,
      },
    ],
  },
};

test("the golden loader evaluates the current total functions without moving them", () => {
  for (const name of ["calcBOL", "calcMISC", "projectTotal", "benefitsRows", "bolSheet", "exportOfficial"]) {
    assert.equal(typeof api[name], "function", name);
  }
});

for (const name of Object.keys(LOCK)) {
  test(`${name} locks today's grand, official, net, BOL sheet, and benefits`, () => {
    const ce = name === "legacy" ? legacy : examples[name];
    const expectRow = LOCK[name];
    const net = api.netOf(ce);
    const official = api.exportOfficial(ce);
    const sheet = api.bolSheet(ce.tasks);
    assert.equal(net.grand, expectRow.grand);
    assert.equal(official.bodySum, expectRow.official);
    assert.equal(api.screenOfficial(ce), expectRow.official);
    assert.equal(net.screen, expectRow.net);
    assert.equal(net.cover, expectRow.net);
    assert.equal(sheet.grandTotal, expectRow.bol);
    for (const key of Object.keys(expectRow.rows)) {
      assert.equal(official.rows[key], expectRow.rows[key], key);
    }
    assert.deepEqual(Object.keys(official.rows).sort(), Object.keys(expectRow.rows).sort());
    assertRows(sheet.rows, expectRow.bolRows);
    assertBenefits(benefitsOf(api.benefitsRows(ce.tasks)), expectRow.benefits);
  });
}

/** @param {any[]} actual @param {any[]} expected */
function assertRows(actual, expected) {
  assert.equal(actual.length, expected.length);
  expected.forEach((row, index) => {
    for (const key of Object.keys(row)) assert.equal(actual[index][key], row[key], key);
  });
}

/** @param {any[]} actual @param {any[]} expected */
function assertBenefits(actual, expected) {
  assert.equal(actual.length, expected.length);
  expected.forEach((row, index) => {
    for (const key of Object.keys(row)) assert.equal(actual[index][key], row[key], `${row.role}.${key}`);
  });
}

test("hybrid official uses the C override and the grand does not", () => {
  const official = api.exportOfficial(examples.hybrid);
  assert.equal(roundMoney(official.computedC), 26492.31);
  assert.equal(official.rows.C, 20000);
  assert.equal(api.netOf(examples.hybrid).grand, 145679.94);
});

test("the four examples and the legacy fixture are still legacy pricing", () => {
  for (const ce of [examples.shop, examples.onsite, examples.trading, examples.hybrid, legacy]) {
    assert.equal(ce.pricing, undefined);
  }
});

test("today's unit rates, not the direct-v1 rates", () => {
  const regular = api.calcBOL({ qty: 1, days: 1, rate: 700, otHrs: 1, dayType: "Regular", shift: "Day", perDiem: 0 });
  const rest = api.calcBOL({ qty: 1, days: 1, rate: 700, otHrs: 1, dayType: "Sun/Special", shift: "Day", perDiem: 0 });
  const holiday = api.calcBOL({ qty: 1, days: 1, rate: 700, otHrs: 1, dayType: "Holiday", shift: "Day", perDiem: 0 });
  const night = api.calcBOL({ qty: 1, days: 1, rate: 900, otHrs: 0, dayType: "Regular", shift: "Night", perDiem: 0 });
  assert.equal(regular.otRate, 109.375);
  assert.equal(rest.otRate, 142.1875);
  assert.equal(holiday.otRate, 218.75);
  assert.equal(roundMoney(night.base), 990);
  assert.equal(api.calcMISC({ qty: 2, days: 0, unitCost: 300 }), 600);
  assert.equal(api.calcMISC({ qty: 2, unitCost: 300 }), 600);
});
