// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planCalcInsert } from "./elCalcs.js";
import {
	calculatorPrintRows,
	fuelCost,
	normalizeVehicles,
	readCache,
	routeFuelResponse,
	routeSnapshot,
	truckBanWarning,
	writeCache
} from "./routeFuel.js";

test("fuel is kilometres divided by km per litre, times the price, plus 10 percent", () => {
	assert.equal(fuelCost({ km: 100, kmPerL: 10, pricePerL: 60 }), 660);
	assert.equal(fuelCost({ km: 50, kmPerL: 8, pricePerL: 55.5 }), 381.56);
	assert.equal(fuelCost({ km: 0, kmPerL: 10, pricePerL: 60 }), null);
	assert.equal(fuelCost({ km: 100, kmPerL: 0, pricePerL: 60 }), null);
	assert.equal(fuelCost({ km: 100, kmPerL: 10 }), null);
});

test("a truck is warned only inside the weekday Metro Manila windows", () => {
	const text = "Truck ban: a truck on this departure is inside the Metro Manila window (06:00–10:00 or 17:00–22:00).";
	assert.equal(truckBanWarning({ truck: true, when: "2026-10-20T07:00" }), text);
	assert.equal(truckBanWarning({ truck: true, when: "2026-10-20T17:00" }), text);
	assert.equal(truckBanWarning({ truck: true, when: "2026-10-20T11:00" }), "");
	assert.equal(truckBanWarning({ truck: true, when: "2026-10-20T22:00" }), "");
	assert.equal(truckBanWarning({ truck: true, when: "2026-10-24T07:00" }), "");
	assert.equal(truckBanWarning({ truck: false, when: "2026-10-20T07:00" }), "");
});

test("the snapshot keeps fuel, tolls, and the ferry apart", () => {
	const snap = routeSnapshot({
		km: 100,
		kmPerL: 10,
		pricePerL: 60,
		tolls: [{ id: "slex", name: "SLEX", amount: 200 }],
		tollIds: ["slex"],
		ferry: true,
		ferryCost: 150,
		truck: true,
		when: "2026-10-20T07:00",
		manual: true
	});
	assert.equal(snap.ok, true);
	assert.equal(snap.fuel, 660);
	assert.equal(snap.tolls, 200);
	assert.equal(snap.ferry, 150);
	assert.equal(snap.total, 1010);
	assert.equal(snap.buffer, 0.1);
	assert.equal(snap.manual, true);
	assert.match(snap.warning, /Truck ban/);
	assert.equal(routeSnapshot({ km: 10, kmPerL: 10 }).ok, false);
});

test("the road service is cached and a failure asks for a typed distance", async () => {
	const routes = new Map();
	let calls = 0;
	const fetchImpl = async () => {
		calls += 1;
		return {
			ok: true,
			json: async () => ({
				routes: [{ distance: 12500, geometry: { type: "LineString", coordinates: [[120.9, 14.6], [123.9, 10.3]] }, legs: [{ steps: [{ mode: "ferry" }] }] }]
			})
		};
	};
	const url = "http://local/api/route-fuel?kind=route&from=14.6,120.98&to=10.3,123.9";
	const first = await routeFuelResponse(new Request(url), fetchImpl, { routes, tiles: new Map() }, 1_000);
	const second = await routeFuelResponse(new Request(url), fetchImpl, { routes, tiles: new Map() }, 1_000);
	assert.equal(calls, 1);
	assert.deepEqual(await first.json(), { ok: true, km: 12.5, ferry: true, geometry: { type: "LineString", coordinates: [[120.9, 14.6], [123.9, 10.3]] }, manual: false, cached: false });
	assert.equal((await second.json()).cached, true);
	const failed = await routeFuelResponse(new Request(url), async () => { throw new Error("down"); }, { routes: new Map(), tiles: new Map() }, 1_000);
	assert.equal((await failed.json()).manual, true);
	const tiles = new Map();
	let tileCalls = 0;
	const bad = await routeFuelResponse(new Request("http://local/api/route-fuel?kind=tile&z=99&x=1&y=1"), async () => { tileCalls += 1; }, { routes: new Map(), tiles }, 1_000);
	assert.equal(bad.status, 400);
	assert.equal(tileCalls, 0);
	const map = new Map();
	writeCache(map, "a", { ok: true }, 10, 2);
	assert.deepEqual(readCache(map, "a", 11, 5), { ok: true });
	assert.equal(readCache(map, "a", 20, 5), null);
});

test("add to a cost estimate lands in MISC B with the snapshot", () => {
	const docs = {
		"CE-1": { tasks: [{ id: "t", subtasks: [{ id: "s", items: { MISC: [] } }] }] }
	};
	const snap = routeSnapshot({ km: 100, kmPerL: 10, pricePerL: 60 });
	const built = planCalcInsert(docs, {
		ceId: "CE-1",
		status: "Ongoing",
		taskId: "t",
		subtaskId: "s",
		category: "MISC",
		section: "B",
		description: "Route fuel",
		qty: 1,
		unit: "lot",
		unitCost: snap.total,
		calc: { tool: "route", snapshot: snap }
	}, () => "line-1");
	const line = built.documents["CE-1"].tasks[0].subtasks[0].items.MISC[0];
	assert.equal(built.ok, true);
	assert.equal(line.section, "B");
	assert.equal(line.unitCost, 660);
	assert.equal(line.calc.snapshot.fuel, 660);
	assert.equal(line.calc.tool, "route");
});

test("vehicles are not seeded and every calculator can print when the flag is on", () => {
	assert.deepEqual(normalizeVehicles(undefined), []);
	assert.deepEqual(calculatorPrintRows("weld", { weld: { kg: 2.174 } }), [{ label: "Weld metal", value: "2.174 kg" }]);
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const calc = readFileSync(new URL("../../components/staffModules.jsx", import.meta.url), "utf8");
	const sql = readFileSync(new URL("../../../supabase/p9-route-fuel-2026-10-20.sql", import.meta.url), "utf8");
	assert.match(app, /routeFuel: false/);
	assert.match(app, /routeFuel: src\.features\?\.routeFuel === true/);
	assert.match(calc, /routeFuel \? \[\["route", "Route and fuel"\]\]/);
	assert.match(calc, /routeFuel && tool !== "route"/);
	assert.equal(/alter table public\.clients/i.test(sql), false);
	assert.equal(/alter table public\.masterlist_items/i.test(sql), false);
});
