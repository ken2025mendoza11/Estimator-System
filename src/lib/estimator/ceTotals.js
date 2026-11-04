// @ts-nocheck
/** Cost-estimate line totals. Legacy bodies match the editor. Direct-v1 is opt-in. */

import { miscAmount, qtyUnitAmount, roundMoney } from "./money.js";

/** @type {() => { hoursPerDay?: number, otMultiplier?: number, nightDiffPct?: number, sundayMultiplier?: number, holidayMultiplier?: number, daysPerMonth?: number, thirteenthDivisor?: number, sssPct?: number, hdmfPct?: number, phicPct?: number }} */
let readFormula = () => ({
  hoursPerDay: 8,
  otMultiplier: 1.25,
  nightDiffPct: 10,
  sundayMultiplier: 1.3,
  holidayMultiplier: 2,
  daysPerMonth: 26,
  thirteenthDivisor: 12,
  sssPct: 4.5,
  hdmfPct: 2,
  phicPct: 3,
});

/** The editor injects its live formula. Missing model stays on today's maths. */
export function setFormulaFns(fns) {
  if (fns && typeof fns.formulaNow === "function") readFormula = fns.formulaNow;
}

function formulaNow() {
  return readFormula();
}

function num2(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

const CATS = ["BOL", "BOTE", "PPE", "BOCM", "MISC"];

function normalizeWorkType(value) {
  const w = String(value || "").toLowerCase();
  if (w === "shop" || w === "shopwork" || w === "shop work") return "shop";
  if (w === "trading") return "trading";
  return "onsite";
}

function taskWorkType(task2) {
  return normalizeWorkType(task2?.workType);
}

function chargesPower(workTypeOrTask) {
  const w = normalizeWorkType(workTypeOrTask && typeof workTypeOrTask === "object" ? workTypeOrTask.workType : workTypeOrTask);
  return w === "shop" || w === "trading";
}

/** 2025 employer defaults. A direct-v1 estimate snapshots these onto pricing.formula. */
const DIRECT_RATES = {
  hoursPerDay: 8,
  nightDiffPct: 10,
  regularOtFactor: 1.25,
  premiumDayOtFactor: 1.3,
  sundayMultiplier: 1.3,
  holidayMultiplier: 2,
  daysPerMonth: 26,
  thirteenthDivisor: 12,
  sssErPct: 10,
  sssMscStep: 500,
  sssMscMin: 5000,
  sssMscMax: 35000,
  eccLow: 10,
  eccHigh: 30,
  eccThreshold: 15000,
  philHealthErPct: 2.5,
  philHealthFloor: 10000,
  philHealthCeiling: 100000,
  hdmfErPct: 2,
  hdmfCap: 200,
};

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function bounded(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

/** @param {unknown} src */
function directFormula(src) {
  const raw = src && typeof src === "object" ? /** @type {Record<string, unknown>} */ (src) : {};
  const hours = bounded(raw.hoursPerDay, DIRECT_RATES.hoursPerDay, 0.000001, 24);
  return {
    hoursPerDay: hours,
    nightDiffPct: bounded(raw.nightDiffPct, DIRECT_RATES.nightDiffPct, 0, 100),
    regularOtFactor: bounded(raw.regularOtFactor, DIRECT_RATES.regularOtFactor, 1, 3),
    premiumDayOtFactor: bounded(raw.premiumDayOtFactor, DIRECT_RATES.premiumDayOtFactor, 1, 3),
    sundayMultiplier: bounded(raw.sundayMultiplier, DIRECT_RATES.sundayMultiplier, 1, 3),
    holidayMultiplier: bounded(raw.holidayMultiplier, DIRECT_RATES.holidayMultiplier, 1, 3),
    daysPerMonth: bounded(raw.daysPerMonth, DIRECT_RATES.daysPerMonth, 1, 31),
    thirteenthDivisor: bounded(raw.thirteenthDivisor, DIRECT_RATES.thirteenthDivisor, 1, 12),
    sssErPct: bounded(raw.sssErPct, DIRECT_RATES.sssErPct, 0, 100),
    sssMscStep: bounded(raw.sssMscStep, DIRECT_RATES.sssMscStep, 1, 5000),
    sssMscMin: bounded(raw.sssMscMin, DIRECT_RATES.sssMscMin, 0, 1000000),
    sssMscMax: bounded(raw.sssMscMax, DIRECT_RATES.sssMscMax, 0, 1000000),
    eccLow: bounded(raw.eccLow, DIRECT_RATES.eccLow, 0, 1000000),
    eccHigh: bounded(raw.eccHigh, DIRECT_RATES.eccHigh, 0, 1000000),
    eccThreshold: bounded(raw.eccThreshold, DIRECT_RATES.eccThreshold, 0, 1000000),
    philHealthErPct: bounded(raw.philHealthErPct, DIRECT_RATES.philHealthErPct, 0, 100),
    philHealthFloor: bounded(raw.philHealthFloor, DIRECT_RATES.philHealthFloor, 0, 10000000),
    philHealthCeiling: bounded(raw.philHealthCeiling, DIRECT_RATES.philHealthCeiling, 0, 10000000),
    hdmfErPct: bounded(raw.hdmfErPct, DIRECT_RATES.hdmfErPct, 0, 100),
    hdmfCap: bounded(raw.hdmfCap, DIRECT_RATES.hdmfCap, 0, 1000000),
  };
}

/** @param {unknown} pricing */
export function isDirectPricing(pricing) {
  return Boolean(pricing && typeof pricing === "object" && /** @type {{ model?: string }} */ (pricing).model === "direct-v1");
}

/** Draft and Ongoing can switch. For approval, Done, and closed stay legacy. */
export function canSwitchPricing(status) {
  const key = String(status || "").trim().toLowerCase();
  return key === "draft" || key === "ongoing";
}

/** The flag gates the offer. An approved estimate never sees the banner. */
export function offerDirectSwitch(opts) {
  const src = opts && typeof opts === "object" ? opts : {};
  if (src.flag !== true) return false;
  if (src.readOnly) return false;
  if (isDirectPricing(src.pricing)) return false;
  return canSwitchPricing(src.status);
}

/**
 * Map a stored day type onto the DOLE rows. Existing values stay: Regular,
 * Sun/Special (rest day / Sunday / special day), Holiday (regular holiday).
 * Compound types are recognized when already stored. No new field is added.
 * @param {unknown} dayType
 */
function resolveDoleDay(dayType) {
  const t = String(dayType || "Regular").trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
  if (!t || t === "regular" || t === "ordinary" || t === "regular day" || t === "ordinary day") return "regular";
  if (/holiday/.test(t) && /rest|sunday/.test(t)) return "holiday-rest";
  if (/special/.test(t) && /rest/.test(t) && !/sun/.test(t)) return "special-rest";
  if (t === "special rest" || t === "special on rest" || t === "special day on rest day" || t === "specialrest") return "special-rest";
  if (t === "holiday" || t === "regular holiday" || t === "legal holiday") return "holiday";
  if (t.includes("sun") || t.includes("special") || t.includes("rest")) return "rest";
  return "regular";
}

/**
 * One DOLE pay helper. Regular OT is 1.25. Rest day, special day, and holiday OT are 1.30 of that day's rate.
 * Night differential is +10% on the day rate and on OT. Compound rest-day rows use the handbook premiums.
 * @param {number} rate
 * @param {string} dayType
 * @param {string} shift
 * @param {Record<string, number>=} formula
 */
function dolePay(rate, dayType, shift, formula) {
  const f = directFormula(formula);
  const kind = resolveDoleDay(dayType);
  let premium = 1;
  if (kind === "rest") premium = f.sundayMultiplier;
  else if (kind === "holiday") premium = f.holidayMultiplier;
  else if (kind === "special-rest") premium = 1.5;
  else if (kind === "holiday-rest") premium = 2.6;
  const night = /^night/i.test(String(shift || "")) ? f.nightDiffPct / 100 : 0;
  const hourly = rate / f.hoursPerDay;
  const otFactor = kind === "regular" ? f.regularOtFactor : f.premiumDayOtFactor;
  const scale = premium * (1 + night);
  return {
    kind,
    premium,
    otFactor,
    night,
    dayRate: rate * scale,
    otRate: hourly * scale * otFactor,
  };
}

/**
 * @param {Record<string, unknown>} item
 * @param {Record<string, number>} formula
 */
function bolDirectParts(item, formula) {
  const pay = dolePay(num2(item.rate), String(item.dayType || "Regular"), String(item.shift || "Day"), formula);
  const qty = num2(item.qty);
  const days = num2(item.days);
  const per = qty * days * (num2(item.perDiem) + num2(item.allowance));
  const labor = qty * days * pay.dayRate + qty * days * num2(item.otHrs) * pay.otRate;
  return {
    subtotal: roundMoney(labor + per),
    perDiem: per,
    benefit: roundMoney(benefitPerPersonDay(num2(item.rate), formula) * qty * days),
  };
}

/**
 * @param {number} rate
 * @param {Record<string, number>} formula
 */
function benefitPerPersonDay(rate, formula) {
  const f = directFormula(formula);
  const monthly = rate * f.daysPerMonth;
  const step = f.sssMscStep || 500;
  const nearest = Math.round(monthly / step) * step;
  const msc = Math.min(f.sssMscMax, Math.max(f.sssMscMin, nearest));
  const sss = msc * f.sssErPct / 100;
  const ecc = msc < f.eccThreshold ? f.eccLow : f.eccHigh;
  const phBase = Math.min(f.philHealthCeiling, Math.max(f.philHealthFloor, monthly));
  const ph = phBase * f.philHealthErPct / 100;
  const hdmf = Math.min(f.hdmfCap, monthly * f.hdmfErPct / 100);
  return rate / f.thirteenthDivisor + (sss + ecc + ph + hdmf) / f.daysPerMonth;
}

/**
 * @param {unknown[]} tasks
 * @param {{ formula?: Record<string, number> }} pricing
 */
function directStatement(tasks, pricing, sheets) {
  const formula = directFormula(pricing.formula);
  let manpower = 0;
  let perDiem = 0;
  let benefits = 0;
  let tools = 0;
  let materials = 0;
  let ppe = 0;
  /** @type {Record<string, number>} */
  const misc = { A: 0, B: 0, C: 0, D: 0, E: 0, I: 0, other: 0 };
  (tasks || []).forEach((task) => {
    const wt = taskWorkType(task);
    costNodes(task).forEach((sub) => {
      const items = sub.items || {};
      (items.BOL || []).forEach((item) => {
        const line = bolDirectParts(item, formula);
        manpower = roundMoney(manpower + line.subtotal);
        perDiem += line.perDiem;
        benefits = roundMoney(benefits + line.benefit);
      });
      (items.BOTE || []).forEach((item) => {
        const use = roundMoney(num2(item.qty) * num2(item.days) * num2(item.rate));
        const power = chargesPower(wt) ? roundMoney(boteElectricityCost(item)) : 0;
        tools = roundMoney(tools + use + power);
      });
      (items.BOCM || []).forEach((item) => {
        materials = roundMoney(materials + qtyUnitAmount(item.qty, item.unitCost));
      });
      (items.PPE || []).forEach((item) => {
        ppe = roundMoney(ppe + qtyUnitAmount(item.qty, item.unitCost));
      });
      (items.MISC || []).forEach((item) => {
        const days = item.days == null || item.days === "" ? 1 : num2(item.days);
        const amount = roundMoney(num2(item.qty) * days * num2(item.unitCost));
        const section = String(item.section || "");
        const key = Object.prototype.hasOwnProperty.call(misc, section) ? section : "other";
        misc[key] = roundMoney(misc[key] + amount);
      });
    });
  });
  const pair = mobDemobPair(tasks, sheets);
  const miscTotal = roundMoney(misc.A + misc.B + misc.C + misc.D + misc.E + misc.I + misc.other);
  const total = roundMoney(manpower + benefits + tools + materials + ppe + miscTotal + pair.total);
  return { manpower, benefits, tools, materials, ppe, misc, miscTotal, perDiem, total, mobilization: pair.mobilization, demobilization: pair.demobilization };
}

function calcBOL(item, pricing) {
  if (pricing && pricing.model === "direct-v1") {
    const line = bolDirectParts(item, directFormula(pricing.formula));
    return {
      base: 0,
      ot: 0,
      otRate: dolePay(num2(item.rate), String(item.dayType || "Regular"), String(item.shift || "Day"), pricing.formula).otRate,
      perDiemAllow: line.perDiem,
      labor: line.subtotal - line.perDiem,
      benefits: line.benefit,
      subtotal: line.subtotal,
    };
  }
  const pay = dolePay(num2(item.rate), String(item.dayType || "Regular"), String(item.shift || "Day"), formulaNow());
  const base = num2(item.qty) * num2(item.days) * pay.dayRate;
  const ot = num2(item.qty) * num2(item.days) * num2(item.otHrs) * pay.otRate;
  const perDiemAllow = num2(item.qty) * num2(item.days) * (num2(item.perDiem) + num2(item.allowance));
  return {
    base,
    ot,
    otRate: pay.otRate,
    perDiemAllow,
    labor: base + ot,
    benefits: perDiemAllow,
    subtotal: roundMoney(base + ot + perDiemAllow),
  };
}

var calcBOTE = (i, workType) => {
  const use = num2(i.qty) * num2(i.days) * num2(i.rate);
  if (!chargesPower(workType)) return roundMoney(use);
  return roundMoney(use + boteElectricityCost(i));
};

var calcBOCM = (i) => qtyUnitAmount(i.qty, i.unitCost);
var calcPPE = (i) => qtyUnitAmount(i.qty, i.unitCost);
var calcMISC = (i, pricing) => {
  if (pricing && pricing.model === "direct-v1") {
    const days = i.days == null || i.days === "" ? 1 : num2(i.days);
    return roundMoney(num2(i.qty) * days * num2(i.unitCost));
  }
  return miscAmount(i.qty, i.days, i.unitCost);
};

function miscBucket(tasks, section) {
  let total = 0;
  const lines = [];
  (tasks || []).forEach((t) => costNodes(t).forEach((sub) => (sub.items?.MISC || []).forEach((it) => {
    if (String(it.section || "") !== section) return;
    const amount = calcMISC(it);
    total += amount;
    const description = String(it.description || "").trim();
    if (!description) return;
    const hit = lines.find((l) => l.description === description);
    if (hit) hit.amount += amount;
    else lines.push({ description, amount });
  })));
  return {
    total: roundMoney(total),
    lines: lines.map((l) => ({ ...l, amount: roundMoney(l.amount) })),
  };
}

function buildOfficialBaseRows(tasks, pricing, sheets) {
  if (pricing && pricing.model === "direct-v1") {
    const statement = directStatement(tasks, pricing, sheets);
    const rows = [
      { key: "A", item: "A.", label: "MANPOWER COST", computed: statement.manpower, main: true },
      { key: "A1", item: "", label: "A.1 Benefits", computed: statement.benefits, sub: true },
      { key: "B", item: "B.", label: "TOOLS AND EQUIPMENTS", computed: statement.tools, main: true },
      { key: "C", item: "C.", label: "MATERIALS AND CONSUMABLES", computed: statement.materials, main: true },
      { key: "D", item: "D.", label: "PERSONAL PROTECTIVE EQUIPMENT", computed: statement.ppe, main: true },
      { key: "MOB", item: "", label: "MOBILIZATION", computed: statement.mobilization, main: true },
      { key: "DEMOB", item: "", label: "DEMOBILIZATION", computed: statement.demobilization, main: true },
      { key: "E", item: "E.", label: "MISCELLANEOUS:", computed: statement.miscTotal, group: true, main: true },
      { key: "E1", item: "", label: "E.1 ACCOMMODATION", computed: statement.misc.A, sub: true },
      { key: "E2", item: "", label: "E.2 TRANSPORTATION", computed: statement.misc.B, sub: true },
      { key: "E3", item: "", label: "E.3 REQUIREMENTS", computed: statement.misc.C, sub: true },
      { key: "E4", item: "", label: "E.4 ADMIN COST", computed: statement.misc.D, sub: true },
      { key: "E5", item: "", label: "E.5 INSURANCES", computed: statement.misc.I, sub: true },
      { key: "E6", item: "", label: "E.6 THIRD PARTY SERVICES:", computed: statement.misc.E, sub: true, third: true },
      { key: "Other", item: "", label: "Other", computed: statement.misc.other, sub: true },
    ];
    return { rows, thirdLines: [], elec: 0, taskLines: [], total: statement.total, perDiem: statement.perDiem };
  }
  const sumCat = (cat) => (tasks || []).reduce((sum, t) => sum + categoryOnTask(t, cat), 0);
  const acc = miscBucket(tasks, "A");
  const trans = miscBucket(tasks, "B");
  const req = miscBucket(tasks, "C");
  const admin = miscBucket(tasks, "D");
  const third = miscBucket(tasks, "E");
  const ins = miscBucket(tasks, "I");
  const miscSum = acc.total + trans.total + req.total + admin.total + ins.total + third.total;
  const pair = mobDemobPair(tasks, sheets);
  const rows = [
    { key: "A", item: "A.", label: "MANPOWER COST", computed: sumCat("BOL"), main: true },
    { key: "B", item: "B.", label: "TOOLS AND EQUIPMENTS", computed: sumCat("BOTE"), main: true },
    { key: "C", item: "C.", label: "MATERIALS AND CONSUMABLES", computed: sumCat("BOCM"), main: true },
    { key: "D", item: "D.", label: "PERSONAL PROTECTIVE EQUIPMENT", computed: sumCat("PPE"), main: true },
    { key: "MOB", item: "", label: "MOBILIZATION", computed: pair.mobilization, main: true },
    { key: "DEMOB", item: "", label: "DEMOBILIZATION", computed: pair.demobilization, main: true },
    { key: "E", item: "E.", label: "MISCELLANEOUS:", computed: miscSum, group: true, main: true },
    { key: "E1", item: "", label: "E.1 ACCOMMODATION", computed: acc.total, sub: true },
    { key: "E2", item: "", label: "E.2 TRANSPORTATION", computed: trans.total, sub: true },
    { key: "E3", item: "", label: "E.3 REQUIREMENTS", computed: req.total, sub: true },
    { key: "E4", item: "", label: "E.4 ADMIN COST", computed: admin.total, sub: true },
    { key: "E5", item: "", label: "E.5 INSURANCES", computed: ins.total, sub: true },
    { key: "E6", item: "", label: "E.6 THIRD PARTY SERVICES:", computed: third.total, sub: true, third: true },
  ];
  return {
    rows,
    thirdLines: third.lines.map((l) => ({ key: `tp:${l.description}`, description: l.description, computed: l.amount })),
    elec: (tasks || []).reduce((sum, t) => sum + botePowerOnTask(t), 0),
    taskLines: (tasks || []).map((t) => ({ key: `task-${t.id}`, label: t.title || "Task", amount: taskTotal(t) })),
  };
}

function boteElectricityCost(item) {
  return num2(item.qty) * num2(item.days) * num2(item.hoursPerDay) * num2(item.powerKw) * num2(item.kwhRate);
}

function itemSubtotal(cat, item, workType, pricing) {
  if (cat === "BOL") return calcBOL(item, pricing).subtotal;
  if (cat === "BOTE") return calcBOTE(item, workType);
  if (cat === "BOCM") return calcBOCM(item);
  if (cat === "PPE") return calcPPE(item);
  return calcMISC(item, pricing);
}

function categoryTotal(items, cat, workType, pricing) {
  return roundMoney((items || []).reduce((s, it) => s + itemSubtotal(cat, it, workType, pricing), 0));
}

function subtaskTotal(subtask2, workType, pricing) {
  return roundMoney(CATS.reduce((s, c) => s + categoryTotal(subtask2.items?.[c] || [], c, workType, pricing), 0) + (subtask2.children || []).reduce((s, ch) => s + subtaskTotal(ch, workType, pricing), 0));
}

function taskCostHost(task2) {
  const items = task2 && task2.items;
  if (!items || typeof items !== "object" || Array.isArray(items)) return null;
  const cats = ["BOL", "BOTE", "BOCM", "PPE", "MISC"];
  const has = cats.some((cat) => Array.isArray(items[cat]) && items[cat].length);
  if (!has) return null;
  return { id: `${task2.id || "task"}::lines`, title: task2.title || "", items, children: [] };
}

function costNodes(task2) {
  const host = taskCostHost(task2);
  const subs = flattenSubs(task2);
  return host ? [host, ...subs] : subs;
}

function flattenSubs(task2) {
  const out = [];
  const walk = (list) => {
    (list || []).forEach((s) => {
      out.push(s);
      walk(s.children);
    });
  };
  walk(task2?.subtasks);
  return out;
}

function categoryOnTask(task2, cat, pricing) {
  const wt = taskWorkType(task2);
  return costNodes(task2).reduce((s, st) => s + categoryTotal(st.items?.[cat] || [], cat, wt, pricing), 0);
}

function botePowerOnTask(task2) {
  return costNodes(task2).reduce((s, st) => s + (st.items?.BOTE || []).reduce((s3, it) => s3 + boteElectricityCost(it), 0), 0);
}

function taskTotal(task2, pricing) {
  const wt = taskWorkType(task2);
  const host = taskCostHost(task2);
  const own = host ? subtaskTotal(host, wt, pricing) : 0;
  return roundMoney(own + (task2.subtasks || []).reduce((s, st) => s + subtaskTotal(st, wt, pricing), 0));
}

const MOB_ALLOWANCE_RATES = { "Project Manager": 0, Skilled: 0, Admin: 0 };

function classifyMobRole(role) {
  const r = String(role || "").toLowerCase();
  if (/(project\s*manager|\bproj(?:ect)?\s*mgr\b|\bpm\b)/.test(r)) return "Project Manager";
  if (/(admin|secretary|clerk|accountant|document\s*control|\bhr\b|office)/.test(r)) return "Admin";
  return "Skilled";
}

/** A typed mob/demob line. A blank qty, days, or rate is 0. Nothing is invented. */
function mobLineAmount(row) {
  if (!row || typeof row !== "object") return 0;
  if (row.amount != null && row.amount !== "") return num2(row.amount);
  if (row.total != null && row.total !== "") return num2(row.total);
  const qty = row.qty == null || row.qty === "" ? 0 : num2(row.qty);
  const hasDays = Object.prototype.hasOwnProperty.call(row, "days");
  const days = !hasDays || row.days == null || row.days === "" ? 0 : num2(row.days);
  const rateRaw = row.rate != null ? row.rate : row.unitCost != null ? row.unitCost : row.price;
  const rate = rateRaw == null || rateRaw === "" ? 0 : num2(rateRaw);
  if (!hasDays) return qty * rate;
  return qty * days * rate;
}

/** One sheet total. A missing sheet is 0. User lines are summed. Allowance rates are not filled in. */
function mobSheetAmount(tasks, sheet) {
  if (sheet == null || sheet === "") return 0;
  if (typeof sheet === "number" || typeof sheet === "string") return roundMoney(num2(sheet));
  if (typeof sheet !== "object") return 0;
  if (!Array.isArray(sheet) && sheet.total != null && sheet.total !== "" && !sheet.manpower && !sheet.lines && !sheet.items && !sheet.allowance) {
    return roundMoney(num2(sheet.total));
  }
  const lines = []
    .concat(sheet.manpower || [])
    .concat(sheet.allowance || [])
    .concat(sheet.lines || [])
    .concat(sheet.items || []);
  if (!lines.length && sheet.amount != null) return roundMoney(num2(sheet.amount));
  return roundMoney(lines.reduce((sum, row) => sum + mobLineAmount(row), 0));
}

/** Mobilization and demobilization stay separate. No copy from one sheet to the other. Shop and trading stay 0. */
function mobDemobPair(tasks, sheets) {
  const onsite = (tasks || []).filter((t) => normalizeWorkType(t?.workType) === "onsite");
  if (!onsite.length) return { mobilization: 0, demobilization: 0, total: 0 };
  const src = sheets && typeof sheets === "object" ? sheets : {};
  const mobilization = mobSheetAmount(onsite, src.mobilization != null ? src.mobilization : src.mob);
  const demobilization = mobSheetAmount(onsite, src.demobilization != null ? src.demobilization : src.demob);
  return { mobilization, demobilization, total: roundMoney(mobilization + demobilization) };
}

/** Kept for the golden loader. The sheet no longer invents a manpower list or an allowance. */
function mobManpowerRows() {
  return [];
}

function projectTotal(tasks, pricing, sheets) {
  if (pricing && pricing.model === "direct-v1") return directStatement(tasks, pricing, sheets).total;
  return roundMoney(tasks.reduce((s, t) => s + taskTotal(t), 0) + mobDemobPair(tasks, sheets).total);
}

/** BOL sheet for direct-v1 is the line labour, which is row A minus per diem. */
export function directBolSheet(tasks, pricing) {
  const statement = directStatement(tasks, pricing && pricing.model === "direct-v1" ? pricing : { model: "direct-v1", formula: pricing && pricing.formula });
  return roundMoney(statement.manpower - statement.perDiem);
}

export function directColumnTotals(tasks, pricing) {
  const statement = directStatement(tasks, pricing);
  return {
    A: statement.manpower,
    A1: statement.benefits,
    B: statement.tools,
    C: statement.materials,
    D: statement.ppe,
    E: statement.miscTotal,
    total: statement.total,
    bolSheet: roundMoney(statement.manpower - statement.perDiem),
  };
}

var DIRECT_DAY_TYPES = ["Regular", "Sun/Special", "Holiday"];

/** BOL sheet groups for direct-v1. The grand is row A minus per diem. */
export function directBolGroups(tasks, pricing) {
  const model = pricing && pricing.model === "direct-v1" ? pricing : { model: "direct-v1", formula: pricing && pricing.formula };
  const allBOL = [];
  (tasks || []).forEach((task) => costNodes(task).forEach((sub) => (sub.items?.BOL || []).forEach((item) => allBOL.push(item))));
  /** @type {Record<string, { Day: Record<string, unknown>, Night: Record<string, unknown> }>} */
  const groups = {};
  DIRECT_DAY_TYPES.forEach((dt) => {
    groups[dt] = { Day: {}, Night: {} };
  });
  allBOL.forEach((item) => {
    const dt = String(item.dayType || "Regular");
    const shift = String(item.shift || "Day");
    const role = String(item.role || "Unnamed");
    if (!groups[dt]) groups[dt] = { Day: {}, Night: {} };
    if (!groups[dt][shift]) groups[dt][shift] = {};
    if (!groups[dt][shift][role]) {
      groups[dt][shift][role] = {
        role,
        qty: 0,
        days: 0,
        rate: num2(item.rate),
        otHrs: num2(item.otHrs),
        subtotal: 0,
        labor: 0,
        count: 0,
      };
    }
    const entry = groups[dt][shift][role];
    const line = bolDirectParts(item, directFormula(model.formula));
    entry.qty = Math.max(entry.qty, num2(item.qty));
    entry.days += num2(item.days);
    entry.labor += line.subtotal - line.perDiem;
    entry.subtotal = roundMoney(entry.labor);
    entry.count += 1;
  });
  /** @type {Record<string, number>} */
  const dayTypeTotals = {};
  DIRECT_DAY_TYPES.forEach((dt) => {
    let total = 0;
    Object.values(groups[dt] || {}).forEach((shiftGroup) => Object.values(shiftGroup).forEach((row) => {
      total += num2(row.subtotal);
    }));
    dayTypeTotals[dt] = roundMoney(total);
  });
  return {
    groups,
    dayTypeTotals,
    grandTotal: directBolSheet(tasks, model),
    allBOL,
  };
}

/** Direct-v1 ignores stored overrides. Legacy still reads them. */
export function shownOfficialAmount(row, overrides, pricing) {
  if (isDirectPricing(pricing)) return num2(row && row.computed);
  const raw = overrides ? overrides[row && row.key] : undefined;
  if (raw === undefined || raw === "") return num2(row && row.computed);
  return num2(raw);
}

/** Same number the screen official total and the export total use. */
export function screenOfficialTotal(tasks, pricing, overrides, sheets) {
  const official = buildOfficialBaseRows(tasks, pricing, sheets);
  const shown = (row) => shownOfficialAmount(row, overrides, pricing);
  const miscShown = roundMoney(official.rows.filter((row) => row.sub && !row.breakdown && row.key !== "A1").reduce((sum, row) => sum + roundMoney(shown(row)), 0));
  const benefitRow = official.rows.find((row) => row.key === "A1");
  const benefitShown = benefitRow ? roundMoney(shown(benefitRow)) : 0;
  const mobShown = roundMoney(official.rows.filter((row) => row.key === "MOB" || row.key === "DEMOB").reduce((sum, row) => sum + roundMoney(shown(row)), 0));
  const mains = official.rows.filter((row) => ["A", "B", "C", "D"].includes(row.key)).reduce((sum, row) => sum + roundMoney(shown(row)), 0);
  return roundMoney(mains + benefitShown + miscShown + mobShown);
}

/** Same priced lines as the official total, including task-level rows. Mob and demob stay out. */
function excelSheetTotal(tasks, pricing) {
  const cats = ["BOL", "BOTE", "BOCM", "PPE", "MISC"];
  return roundMoney((tasks || []).reduce((sum, task) => sum + cats.reduce((inner, cat) => inner + categoryOnTask(task, cat, pricing), 0), 0));
}
export function directInputWarnings(tasks) {
  /** @type {{ code: string, taskId: string, itemId?: string, field?: string }[]} */
  const out = [];
  (tasks || []).forEach((task) => {
    const taskId = String(task?.id || "");
    if (!String(task?.workType || "").trim()) out.push({ code: "blank-work-type", taskId });
    const onsite = normalizeWorkType(task?.workType) === "onsite";
    costNodes(task).forEach((sub) => {
      (sub.items?.BOTE || []).forEach((item) => {
        if (onsite && num2(item.powerKw) > 0) out.push({ code: "onsite-power", taskId, itemId: String(item.id || "") });
      });
      (sub.items?.BOL || []).forEach((item) => {
        if (item.perDiem == null || item.perDiem === "") out.push({ code: "missing-per-diem", taskId, itemId: String(item.id || "") });
      });
      (sub.items?.MISC || []).forEach((item) => {
        if (item.days == null || item.days === "") out.push({ code: "misc-blank-days", taskId, itemId: String(item.id || "") });
        ["qty", "days", "unitCost"].forEach((field) => {
          const value = item[field];
          if (value != null && value !== "" && !Number.isFinite(Number(value))) out.push({ code: "non-numeric", taskId, itemId: String(item.id || ""), field });
        });
      });
    });
  });
  return out;
}

export {
  boteElectricityCost,
  botePowerOnTask,
  buildOfficialBaseRows,
  calcBOCM,
  calcBOL,
  calcBOTE,
  calcMISC,
  calcPPE,
  categoryOnTask,
  categoryTotal,
  DIRECT_RATES,
  directFormula,
  dolePay,
  flattenSubs,
  costNodes,
  taskCostHost,
  itemSubtotal,
  miscBucket,
  mobDemobPair,
  MOB_ALLOWANCE_RATES,
  classifyMobRole,
  mobManpowerRows,
  projectTotal,
  excelSheetTotal,
  resolveDoleDay,
  subtaskTotal,
  taskTotal,
};
