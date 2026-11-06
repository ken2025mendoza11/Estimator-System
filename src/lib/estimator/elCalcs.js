// @ts-nocheck
/** EL calculator formulas. Legacy CE totals do not call this file. */

export const ONGOING_FAMILY = [
  "Draft",
  "Ongoing",
  "On Park",
  "Waiting for information",
  "Sourcing",
  "For revision",
];

const MISC_SECTION_TITLES = {
  A: "ACCOMMODATION",
  B: "TRANSPORTATION (DAILY)",
  C: "REQUIREMENTS",
  D: "ADMIN COST",
  I: "INSURANCES",
  E: "THIRD PARTY SERVICES",
};

export function defaultCalcConstants() {
  return {
    version: 1,
    steelDensity: 7.85,
    deposition: { SMAW: 65, GMAW: 90, FCAW: 85, SAW: 98, GTAW: 100 },
    grooveAngleDeg: 60,
    grooveGapMm: 2,
    grooveReinforcementPct: 10,
    pipeFactor: 0.02466,
    airRatePerKg: 65,
    airValuationPct: 1,
    airOtherPct: 10,
    airVatPct: 12,
    airBufferPct: 25,
    airDivisor: 6000,
  };
}

function finite(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bounded(value, min, max, fallback) {
  const n = finite(value);
  if (n == null || n < min || n > max) return fallback;
  return n;
}

export function normalizeCalcConstants(raw) {
  const base = defaultCalcConstants();
  const src = raw && typeof raw === "object" ? raw : {};
  const dep = src.deposition && typeof src.deposition === "object" ? src.deposition : {};
  const deposition = {};
  Object.keys(base.deposition).forEach((key) => {
    deposition[key] = bounded(dep[key], 0.01, 100, base.deposition[key]);
  });
  const version = finite(src.version);
  return {
    version: version != null && version >= 1 ? Math.round(version) : base.version,
    steelDensity: bounded(src.steelDensity, 0.01, 30, base.steelDensity),
    deposition,
    grooveAngleDeg: bounded(src.grooveAngleDeg, 1, 179, base.grooveAngleDeg),
    grooveGapMm: bounded(src.grooveGapMm, 0, 50, base.grooveGapMm),
    grooveReinforcementPct: bounded(src.grooveReinforcementPct, 0, 100, base.grooveReinforcementPct),
    pipeFactor: bounded(src.pipeFactor, 0.000001, 1, base.pipeFactor),
    airRatePerKg: bounded(src.airRatePerKg, 0, 1e9, base.airRatePerKg),
    airValuationPct: bounded(src.airValuationPct, 0, 100, base.airValuationPct),
    airOtherPct: bounded(src.airOtherPct, 0, 100, base.airOtherPct),
    airVatPct: bounded(src.airVatPct, 0, 100, base.airVatPct),
    airBufferPct: bounded(src.airBufferPct, 0, 100, base.airBufferPct),
    airDivisor: bounded(src.airDivisor, 1, 1e9, base.airDivisor),
  };
}

export function constantsDiffer(lineVersion, constants) {
  const current = normalizeCalcConstants(constants).version;
  const line = finite(lineVersion);
  if (line == null) return false;
  return line !== current;
}

function blank(value) {
  return value == null || value === "";
}

function requiredPositive(value, label, messages) {
  if (blank(value)) return null;
  const n = finite(value);
  if (n == null) {
    messages.push(`${label} must be a number.`);
    return null;
  }
  if (n <= 0) {
    messages.push(`${label} must be greater than 0.`);
    return null;
  }
  return n;
}

function optionalPercent(value, label, messages) {
  if (blank(value)) return 0;
  const n = finite(value);
  if (n == null) {
    messages.push(`${label} must be a number.`);
    return null;
  }
  if (n < 0 || n > 100) {
    messages.push(`${label} must be from 0 to 100.`);
    return null;
  }
  return n;
}

function notReady(extra) {
  return { ready: false, ok: true, messages: [], ...extra };
}

function failed(messages, extra) {
  return { ready: true, ok: false, messages, ...extra };
}

/** Chargeable kilograms, rounded up to the next 0.5 kg. Exact halves stay put. */
export function roundUpHalfKg(kg) {
  const n = finite(kg);
  if (n == null || n <= 0) return 0;
  return Math.ceil(n * 2 - 1e-9) / 2;
}

export function weldResult(input, constants) {
  const src = input || {};
  const c = normalizeCalcConstants(constants);
  if (blank(src.lengthM) || blank(src.sizeMm)) {
    return notReady({ kg: null, kgPerM: null, weldMetalKg: null });
  }
  const messages = [];
  const lengthM = requiredPositive(src.lengthM, "Weld length", messages);
  const sizeMm = requiredPositive(src.sizeMm, "Size", messages);
  const density = requiredPositive(src.density, "Density", messages);
  let efficiency = null;
  if (blank(src.efficiency)) messages.push("Enter a deposition efficiency.");
  else {
    efficiency = finite(src.efficiency);
    if (efficiency == null) messages.push("Deposition efficiency must be a number.");
    else if (efficiency <= 0 || efficiency > 100) messages.push("Deposition efficiency must be greater than 0 and at most 100.");
  }
  const wastage = optionalPercent(src.wastage, "Wastage", messages);
  const fillet = src.jointType !== "groove";
  let angle = c.grooveAngleDeg;
  let gap = c.grooveGapMm;
  let reinforcement = c.grooveReinforcementPct;
  if (!fillet) {
    if (!blank(src.angle)) {
      const n = finite(src.angle);
      if (n == null || n <= 0 || n >= 180) messages.push("Groove angle must be between 0 and 180.");
      else angle = n;
    }
    if (!blank(src.gapMm)) {
      const n = finite(src.gapMm);
      if (n == null || n < 0) messages.push("Groove gap must be 0 or more.");
      else gap = n;
    }
    if (!blank(src.reinforcement)) {
      const n = optionalPercent(src.reinforcement, "Reinforcement", messages);
      if (n != null) reinforcement = n;
    }
  }
  if (messages.length || lengthM == null || sizeMm == null || density == null || efficiency == null || wastage == null) {
    return failed(messages, { kg: null, kgPerM: null, weldMetalKg: null });
  }
  let areaMm2;
  let kgPerM = null;
  if (fillet) {
    areaMm2 = (sizeMm * sizeMm) / 2;
  } else {
    const bevel = sizeMm * sizeMm * Math.tan((angle * Math.PI) / 180 / 2);
    areaMm2 = (bevel + gap * sizeMm) * (1 + reinforcement / 100);
    kgPerM = (areaMm2 * density) / 1000;
  }
  const lengthMm = lengthM * 1000;
  const volumeCm3 = (areaMm2 * lengthMm) / 1000;
  const theoreticalKg = (volumeCm3 * density) / 1000;
  const kg = (theoreticalKg / (efficiency / 100)) * (1 + wastage / 100);
  return {
    ready: true,
    ok: true,
    messages: [],
    kg,
    kgPerM,
    weldMetalKg: theoreticalKg,
  };
}

/** Groove label. The kilograms already include reinforcement when it is above 0. */
export function weldMetalLabel(kgPerM, reinforcement) {
  const weight = finite(kgPerM);
  if (weight == null) return "—";
  const text = `${weight.toFixed(3)} kg/m`;
  const pct = finite(reinforcement);
  if (pct == null || pct <= 0) return text;
  return `${text} (includes the ${pct}% reinforcement)`;
}

/** Coverage in m²/L is volume-solids percent × 10 / DFT (µm). */
export function paintResult(input) {
  const src = input || {};
  if (blank(src.area) || blank(src.coats) || blank(src.dft) || blank(src.solids)) {
    return notReady({ litres: null, coverage: null });
  }
  const messages = [];
  const area = requiredPositive(src.area, "Area", messages);
  const coats = requiredPositive(src.coats, "Coats", messages);
  const dft = requiredPositive(src.dft, "DFT", messages);
  let solids = null;
  if (blank(src.solids)) messages.push("Enter volume solids.");
  else {
    solids = finite(src.solids);
    if (solids == null) messages.push("Volume solids must be a number.");
    else if (solids <= 0 || solids > 100) messages.push("Volume solids must be greater than 0 and at most 100.");
  }
  const wastage = optionalPercent(src.wastage, "Wastage", messages);
  if (messages.length || area == null || coats == null || dft == null || solids == null || wastage == null) {
    return failed(messages, { litres: null, coverage: null });
  }
  const coverage = (solids * 10) / dft;
  const litres = ((area * coats) / coverage) * (1 + wastage / 100);
  return { ready: true, ok: true, messages: [], litres, coverage };
}

export function rawResult(input, constants) {
  const src = input || {};
  const c = normalizeCalcConstants(constants);
  const pipe = src.kind === "pipe";
  if (pipe) {
    if (blank(src.od) || blank(src.wt) || blank(src.length)) return notReady({ kg: null });
  } else if (blank(src.length) || blank(src.width) || blank(src.thick)) {
    return notReady({ kg: null });
  }
  const messages = [];
  const waste = optionalPercent(src.waste, "Cutting waste", messages);
  let kg = null;
  if (pipe) {
    const od = requiredPositive(src.od, "Outside diameter", messages);
    const wt = requiredPositive(src.wt, "Wall thickness", messages);
    const length = requiredPositive(src.length, "Length", messages);
    const factor = requiredPositive(src.factor == null || src.factor === "" ? c.pipeFactor : src.factor, "Pipe factor", messages);
    if (od != null && wt != null && od <= wt) messages.push("Outside diameter must be greater than the wall thickness.");
    if (!messages.length && od != null && wt != null && length != null && factor != null && waste != null) {
      kg = (od - wt) * wt * factor * length * (1 + waste / 100);
    }
  } else {
    const length = requiredPositive(src.length, "Length", messages);
    const width = requiredPositive(src.width, "Width", messages);
    const thick = requiredPositive(src.thick, "Thickness", messages);
    const density = requiredPositive(src.density, "Density", messages);
    if (!messages.length && length != null && width != null && thick != null && density != null && waste != null) {
      kg = length * width * thick * density * (1 + waste / 100);
    }
  }
  if (messages.length) return failed(messages, { kg: null });
  return { ready: true, ok: true, messages: [], kg };
}

export function airResult(input, constants) {
  const src = input || {};
  const c = normalizeCalcConstants(constants);
  const hasDims = !blank(src.lengthCm) || !blank(src.widthCm) || !blank(src.heightCm);
  const hasGross = !blank(src.grossKg);
  if (!hasDims && !hasGross) {
    return notReady({
      volumetric: null,
      chargeable: null,
      weightCharge: null,
      valuation: null,
      other: null,
      vat: null,
      total: null,
      request: null,
    });
  }
  const messages = [];
  let volumetric = null;
  if (hasDims) {
    const length = requiredPositive(src.lengthCm, "Length", messages);
    const width = requiredPositive(src.widthCm, "Width", messages);
    const height = requiredPositive(src.heightCm, "Height", messages);
    let divisor = null;
    const divisorSource = blank(src.divisor) ? c.airDivisor : src.divisor;
    divisor = finite(divisorSource);
    if (divisor == null || divisor <= 0) messages.push("Volumetric divisor must be greater than 0.");
    if (length != null && width != null && height != null && divisor != null && divisor > 0) {
      volumetric = (length * width * height) / divisor;
    }
  }
  let gross = null;
  if (hasGross) {
    gross = requiredPositive(src.grossKg, "Gross weight", messages);
  }
  const rateSource = blank(src.ratePerKg) ? c.airRatePerKg : src.ratePerKg;
  const rate = finite(rateSource);
  if (rate == null || rate < 0) messages.push("Rate must be 0 or more.");
  const valuationPct = optionalPercent(blank(src.valuationPct) ? c.airValuationPct : src.valuationPct, "Valuation", messages);
  const otherPct = optionalPercent(blank(src.otherPct) ? c.airOtherPct : src.otherPct, "Other charges", messages);
  const vatPct = optionalPercent(blank(src.vatPct) ? c.airVatPct : src.vatPct, "VAT", messages);
  const bufferPct = optionalPercent(blank(src.bufferPct) ? c.airBufferPct : src.bufferPct, "Payment buffer", messages);
  let declared = 0;
  if (!blank(src.declaredValue)) {
    declared = finite(src.declaredValue);
    if (declared == null || declared < 0) {
      messages.push("Declared value must be 0 or more.");
      declared = null;
    }
  }
  if (messages.length || rate == null || valuationPct == null || otherPct == null || vatPct == null || bufferPct == null || declared == null) {
    return failed(messages, {
      volumetric,
      chargeable: null,
      weightCharge: null,
      valuation: null,
      other: null,
      vat: null,
      total: null,
      request: null,
    });
  }
  const base = Math.max(gross || 0, volumetric || 0);
  const chargeable = roundUpHalfKg(base);
  const weightCharge = chargeable * rate;
  const valuation = declared * (valuationPct / 100);
  const other = (weightCharge + valuation) * (otherPct / 100);
  const vat = (weightCharge + valuation + other) * (vatPct / 100);
  const total = weightCharge + valuation + other + vat;
  const request = total * (1 + bufferPct / 100);
  return {
    ready: true,
    ok: true,
    messages: [],
    volumetric,
    chargeable,
    weightCharge,
    valuation,
    other,
    vat,
    total,
    request,
  };
}

export function isOngoingFamily(status) {
  return ONGOING_FAMILY.includes(String(status || ""));
}

function walkSubtasks(list, prefix, out) {
  (list || []).forEach((sub) => {
    if (!sub || !sub.id) return;
    const title = String(sub.title || "Subtask");
    out.push({
      id: sub.id,
      title: prefix ? `${prefix} / ${title}` : title,
      items: sub.items || {},
    });
    walkSubtasks(sub.children, prefix ? `${prefix} / ${title}` : title, out);
  });
}

export function ongoingTargets(ceList, documents) {
  return (ceList || []).filter((ce) => ce && isOngoingFamily(ce.status)).map((ce) => {
    const tasks = [];
    ((documents && documents[ce.id] && documents[ce.id].tasks) || []).forEach((task) => {
      if (!task || !task.id) return;
      const subs = [];
      walkSubtasks(task.subtasks, "", subs);
      tasks.push({ id: task.id, title: String(task.title || "Task"), subtasks: subs });
    });
    return {
      id: ce.id,
      status: ce.status,
      label: [ce.id, ce.project || ce.client || ""].filter(Boolean).join(" · "),
      tasks,
    };
  });
}

export function lookupDbPrice(list, description) {
  const needle = String(description || "").trim().toLowerCase();
  if (!needle) return null;
  const hit = (list || []).find((row) => {
    if (!row || row.active === "No" || row.active === false) return false;
    const label = String(row.description || row.name || row.item || row.role || "").trim().toLowerCase();
    return label === needle;
  });
  if (!hit) return null;
  const unitCost = finite(hit.unitCost || hit.unitPrice || hit.rate || hit.dailyRate);
  if (unitCost == null || unitCost <= 0) return null;
  return { id: hit.id || "", unitCost, unit: String(hit.unit || "") };
}

function findSubtask(list, subtaskId) {
  for (const sub of list || []) {
    if (!sub) continue;
    if (sub.id === subtaskId) return sub;
    const nested = findSubtask(sub.children, subtaskId);
    if (nested) return nested;
  }
  return null;
}

function mapTasks(tasks, taskId, subtaskId, mapper) {
  let found = false;
  const next = (tasks || []).map((task) => {
    if (!task || task.id !== taskId) return task;
    const replace = (list) => (list || []).map((sub) => {
      if (!sub) return sub;
      if (sub.id === subtaskId) {
        found = true;
        return mapper(sub);
      }
      if (sub.children && sub.children.length) {
        const children = replace(sub.children);
        if (children !== sub.children) return { ...sub, children };
      }
      return sub;
    });
    return { ...task, subtasks: replace(task.subtasks) };
  });
  return { found, tasks: next };
}

function addQty(a, b) {
  return Math.round(((finite(a) || 0) + (finite(b) || 0)) * 1000) / 1000;
}

function sameText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

export function previewMerge(lines, choice) {
  const description = String(choice?.description || "").trim();
  const match = (lines || []).find((line) => {
    if (!line || !sameText(line.description, description)) return false;
    if (choice?.category === "MISC" && choice.section && line.section && line.section !== choice.section) return false;
    return true;
  });
  if (!match) return { kind: "new", match: null, nextQty: null };
  const fromQty = finite(match.qty) || 0;
  const add = finite(choice.qty) || 0;
  return { kind: "merge", match, nextQty: addQty(fromQty, add), fromQty, add };
}

/**
 * Build the next documents object. Does not alert. The caller alerts after setState.
 * @param {Record<string, any>} documents
 * @param {Record<string, any>} choice
 * @param {() => string} [newId]
 */
export function planCalcInsert(documents, choice, newId) {
  const srcDocs = documents && typeof documents === "object" ? documents : {};
  const pick = choice || {};
  if (pick.status && !isOngoingFamily(pick.status)) {
    return { ok: false, reason: "Only a Draft or Ongoing estimate can take a calculator line.", documents: srcDocs, message: "" };
  }
  const doc = srcDocs[pick.ceId];
  if (!doc) return { ok: false, reason: "That cost estimate is not on this computer.", documents: srcDocs, message: "" };
  const task = (doc.tasks || []).find((row) => row && row.id === pick.taskId);
  if (!task) return { ok: false, reason: "Pick a task.", documents: srcDocs, message: "" };
  const sub = findSubtask(task.subtasks, pick.subtaskId);
  if (!sub) return { ok: false, reason: "Pick a subtask.", documents: srcDocs, message: "" };
  const category = String(pick.category || "");
  if (!["BOL", "BOTE", "BOCM", "PPE", "MISC"].includes(category)) {
    return { ok: false, reason: "Pick a category.", documents: srcDocs, message: "" };
  }
  const idFactory = typeof newId === "function" ? newId : () => crypto.randomUUID();
  const items = { ...(sub.items || {}) };
  const lines = Array.isArray(items[category]) ? items[category].slice() : [];
  const preview = previewMerge(lines, { ...pick, category });
  let message;
  if (pick.merge && preview.match) {
    const merged = lines.map((line) => {
      if (line !== preview.match && line.id !== preview.match.id) return line;
      return {
        ...line,
        qty: preview.nextQty,
        notes: pick.notes || line.notes,
        calc: pick.calc || line.calc,
        unitCost: finite(line.unitCost) > 0 ? line.unitCost : pick.unitCost,
      };
    });
    items[category] = merged;
    message = `Merged into ${preview.match.description}. Qty ${preview.fromQty} + ${preview.add} = ${preview.nextQty}.`;
  } else {
    const line = {
      id: idFactory(),
      description: String(pick.description || "").trim() || "Calculator line",
      qty: pick.qty,
      unit: pick.unit || "",
      unitCost: pick.unitCost || 0,
      notes: pick.notes || "",
      calc: pick.calc || null,
    };
    if (pick.masterlistId) line.masterlistId = pick.masterlistId;
    if (category === "BOL") {
      line.role = line.description;
      line.rate = pick.unitCost || 0;
    }
    if (category === "BOTE") line.rate = pick.unitCost || 0;
    if (category === "PPE") line.item = line.description;
    if (category !== "BOL" && category !== "BOTE") line.needsQuote = !(finite(pick.unitCost) > 0);
    if (category === "MISC") {
      const section = pick.section || "B";
      line.section = section;
      line.sectionTitle = MISC_SECTION_TITLES[section] || section;
      line.days = blank(pick.days) ? 1 : pick.days;
    }
    items[category] = [...lines, line];
    message = `Added a new ${category} line on ${pick.ceId}.`;
  }
  const mapped = mapTasks(doc.tasks, pick.taskId, pick.subtaskId, (row) => ({ ...row, items }));
  if (!mapped.found) return { ok: false, reason: "Pick a subtask.", documents: srcDocs, message: "" };
  return {
    ok: true,
    reason: "",
    message,
    documents: { ...srcDocs, [pick.ceId]: { ...doc, tasks: mapped.tasks } },
  };
}
