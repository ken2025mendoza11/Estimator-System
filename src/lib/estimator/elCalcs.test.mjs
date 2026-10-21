// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  airResult,
  constantsDiffer,
  defaultCalcConstants,
  normalizeCalcConstants,
  ongoingTargets,
  paintResult,
  planCalcInsert,
  rawResult,
  roundUpHalfKg,
  weldMetalLabel,
  weldResult,
} from "./elCalcs.js";

const money2 = (n) => Number(n.toFixed(2));
const kg3 = (n) => Number(n.toFixed(3));

test("paint coverage is volume solids × 10 / DFT", () => {
  const result = paintResult({ area: 100, coats: 1, dft: 200, solids: 75, wastage: 0 });
  assert.equal(result.ok, true);
  assert.equal(money2(result.litres), 26.67);
  assert.equal(money2(result.coverage), 3.75);
});

test("a zero DFT is rejected instead of being treated as 1 µm", () => {
  const result = paintResult({ area: 100, coats: 1, dft: 0, solids: 75, wastage: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.litres, null);
  assert.ok(result.messages.some((line) => /DFT/.test(line)));
});

test("fillet 6 mm × 10 m SMAW 65% is 2.174 kg", () => {
  const result = weldResult({
    jointType: "fillet",
    lengthM: 10,
    sizeMm: 6,
    efficiency: 65,
    wastage: 0,
    density: 7.85,
  });
  assert.equal(kg3(result.kg), 2.174);
});

test("a zero deposition efficiency is rejected instead of becoming 1%", () => {
  const result = weldResult({
    jointType: "fillet",
    lengthM: 10,
    sizeMm: 6,
    efficiency: 0,
    wastage: 0,
    density: 7.85,
  });
  assert.equal(result.ok, false);
  assert.equal(result.kg, null);
});

test("groove weld metal is 0.61 kg/m before reinforcement and 0.671 kg/m after 10%", () => {
  const shared = {
    jointType: "groove",
    lengthM: 1,
    sizeMm: 10,
    efficiency: 100,
    wastage: 0,
    density: 7.85,
    angle: 60,
    gapMm: 2,
  };
  const bare = weldResult({ ...shared, reinforcement: 0 });
  assert.equal(money2(bare.kgPerM), 0.61);
  const reinforced = weldResult({ ...shared, reinforcement: 10 });
  assert.equal(kg3(reinforced.kgPerM), 0.671);
  assert.equal(weldMetalLabel(reinforced.kgPerM, 10), "0.671 kg/m (includes the 10% reinforcement)");
  assert.equal(weldMetalLabel(bare.kgPerM, 0).includes("reinforcement"), false);
});

test("plate 2.4 × 1.2 m × 6 mm is 135.65 kg and cutting waste defaults to 0", () => {
  const result = rawResult({ kind: "plate", length: 2.4, width: 1.2, thick: 6, density: 7.85, waste: 0 });
  assert.equal(money2(result.kg), 135.65);
  const cut = rawResult({ kind: "plate", length: 2.4, width: 1.2, thick: 6, density: 7.85, waste: 10 });
  assert.equal(money2(cut.kg), 149.21);
});

test("pipe 60.3 × 3.91 × 6 m is 32.62 kg", () => {
  const result = rawResult({ kind: "pipe", od: 60.3, wt: 3.91, length: 6, waste: 0 });
  assert.equal(money2(result.kg), 32.62);
});

test("air cargo 20 kg, 50×40×30, declared ₱10,000 is ₱1,724.80", () => {
  const result = airResult({
    grossKg: 20,
    lengthCm: 50,
    widthCm: 40,
    heightCm: 30,
    declaredValue: 10000,
  });
  assert.equal(result.chargeable, 20);
  assert.equal(money2(result.total), 1724.8);
});

test("air cargo valuation is 0 when no value is declared", () => {
  const result = airResult({
    grossKg: 20,
    lengthCm: 50,
    widthCm: 40,
    heightCm: 30,
    declaredValue: "",
  });
  assert.equal(result.ok, true);
  assert.equal(result.valuation, 0);
  assert.equal(money2(result.total), 1601.6);
});

test("chargeable weight rounds up to the next 0.5 kg", () => {
  assert.equal(roundUpHalfKg(20), 20);
  assert.equal(roundUpHalfKg(20.1), 20.5);
  assert.equal(roundUpHalfKg(20.5), 20.5);
  const result = airResult({ grossKg: 20.1, declaredValue: "" });
  assert.equal(result.chargeable, 20.5);
});

test("a zero volumetric divisor is rejected instead of becoming 1", () => {
  const result = airResult({
    grossKg: 20,
    lengthCm: 50,
    widthCm: 40,
    heightCm: 30,
    divisor: 0,
    declaredValue: 10000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.total, null);
});

test("missing calculator constants fall back to the built-in rates", () => {
  const constants = normalizeCalcConstants({ version: 4, steelDensity: 0, deposition: { SMAW: 500 } });
  assert.equal(constants.version, 4);
  assert.equal(constants.steelDensity, defaultCalcConstants().steelDensity);
  assert.equal(constants.deposition.SMAW, 65);
  assert.equal(constantsDiffer(4, constants), false);
  assert.equal(constantsDiffer(1, constants), true);
  assert.equal(constantsDiffer(null, constants), false);
});

test("only an ongoing-family estimate is offered, and an approved one is refused", () => {
  const list = [
    { id: "CE-A", status: "Ongoing", project: "Pump" },
    { id: "CE-B", status: "For approval", project: "Tank" },
    { id: "CE-C", status: "Done", project: "Old" },
    { id: "CE-D", status: "Draft", project: "New" },
  ];
  const targets = ongoingTargets(list, {});
  assert.deepEqual(targets.map((row) => row.id), ["CE-A", "CE-D"]);
  const refused = planCalcInsert({}, {
    ceId: "CE-B",
    status: "For approval",
    taskId: "t",
    subtaskId: "s",
    category: "BOCM",
  });
  assert.equal(refused.ok, false);
});

test("air cargo is inserted as MISC section B, one times the total", () => {
  const documents = {
    "CE-A": {
      tasks: [{
        id: "t1",
        subtasks: [{ id: "s1", items: { MISC: [] } }],
      }],
    },
  };
  const built = planCalcInsert(documents, {
    ceId: "CE-A",
    status: "Ongoing",
    taskId: "t1",
    subtaskId: "s1",
    category: "MISC",
    section: "B",
    description: "Cebu Air Cargo",
    qty: 1,
    days: 1,
    unit: "lot",
    unitCost: 1724.8,
    notes: "from EL: air",
    calc: { tool: "air", constantsVersion: 1 },
  }, () => "line-1");
  assert.equal(built.ok, true);
  const line = built.documents["CE-A"].tasks[0].subtasks[0].items.MISC[0];
  assert.equal(line.section, "B");
  assert.equal(line.qty, 1);
  assert.equal(line.days, 1);
  assert.equal(line.unitCost, 1724.8);
  assert.equal(line.calc.constantsVersion, 1);
  assert.equal(documents["CE-A"].tasks[0].subtasks[0].items.MISC.length, 0);
});

test("a matching line can merge, and the alert text is returned to the caller", () => {
  const documents = {
    "CE-A": {
      tasks: [{
        id: "t1",
        subtasks: [{
          id: "s1",
          items: { BOCM: [{ id: "old", description: "Welding consumable", qty: 2, unitCost: 50 }] },
        }],
      }],
    },
  };
  const built = planCalcInsert(documents, {
    ceId: "CE-A",
    status: "Draft",
    taskId: "t1",
    subtaskId: "s1",
    category: "BOCM",
    description: "Welding consumable",
    qty: 2.174,
    unit: "kg",
    unitCost: 0,
    merge: true,
    calc: { tool: "weld", constantsVersion: 1 },
  });
  assert.equal(built.ok, true);
  assert.match(built.message, /2 \+ 2\.174 = 4\.174/);
  const line = built.documents["CE-A"].tasks[0].subtasks[0].items.BOCM[0];
  assert.equal(line.qty, 4.174);
  assert.equal(line.unitCost, 50);
  assert.equal(built.documents["CE-A"].tasks[0].subtasks[0].items.BOCM.length, 1);
});
