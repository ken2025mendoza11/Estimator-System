// @ts-nocheck
/**
 * Route and fuel. Flag routeFuel stays off unless it is exactly true.
 * Fuel is km ÷ km/L × the regional price, then 10%. Tolls and a ferry are extra.
 * The road service is cached. A typed distance is the fallback.
 */

import { roundMoney } from "./money.js";

export const FUEL_BUFFER = 0.1;
export const ROUTE_CACHE_MS = 6 * 60 * 60 * 1000;
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const OSM_TILE = "https://tile.openstreetmap.org";

function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function slug(value) {
	return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

export function normalizeVehicles(list) {
	const out = [];
	const seen = new Set();
	(list || []).forEach((raw) => {
		const name = String(raw?.name || "").trim();
		const kmPerL = num(raw?.kmPerL);
		if (!name || !(kmPerL > 0)) return;
		let id = String(raw?.id || slug(name));
		if (seen.has(id)) id = `${id}-${out.length + 1}`;
		seen.add(id);
		out.push({ id, name, kmPerL, truck: raw?.truck === true });
	});
	return out;
}

export function normalizeFuelPrices(list) {
	const out = [];
	const seen = new Set();
	(list || []).forEach((raw) => {
		const region = String(raw?.region || "").trim();
		const pricePerL = num(raw?.pricePerL);
		if (!region || !(pricePerL > 0)) return;
		let id = String(raw?.id || slug(region));
		if (seen.has(id)) id = `${id}-${out.length + 1}`;
		seen.add(id);
		out.push({ id, region, pricePerL });
	});
	return out;
}

export function normalizeTolls(list) {
	const out = [];
	const seen = new Set();
	(list || []).forEach((raw) => {
		const name = String(raw?.name || "").trim();
		const amount = num(raw?.amount);
		if (!name || amount == null || amount < 0) return;
		let id = String(raw?.id || slug(name));
		if (seen.has(id)) id = `${id}-${out.length + 1}`;
		seen.add(id);
		out.push({ id, name, amount: roundMoney(amount) });
	});
	return out;
}

export function fuelLiters(km, kmPerL) {
	const distance = num(km);
	const economy = num(kmPerL);
	if (!(distance > 0) || !(economy > 0)) return null;
	return distance / economy;
}

/** km ÷ km/L × price, then the 10% buffer. Missing inputs do not invent a cost. */
export function fuelCost({ km, kmPerL, pricePerL, buffer = FUEL_BUFFER } = {}) {
	const liters = fuelLiters(km, kmPerL);
	const price = num(pricePerL);
	const extra = num(buffer);
	if (liters == null || price == null || price < 0 || extra == null || extra < 0) return null;
	return roundMoney(liters * price * (1 + extra));
}

export function tollTotal(tolls, selectedIds) {
	const ids = new Set(selectedIds || []);
	return roundMoney((tolls || []).reduce((sum, toll) => (ids.has(toll.id) ? sum + Number(toll.amount || 0) : sum), 0));
}

/**
 * Weekday Metro Manila cargo window, read from the typed Manila wall time.
 * 06:00–10:00 and 17:00–22:00. Saturday and Sunday are not warned.
 */
export function truckBanWarning({ truck, when } = {}) {
	if (truck !== true) return "";
	const match = String(when || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
	if (!match) return "";
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
	if (weekday === 0 || weekday === 6) return "";
	const minutes = hour * 60 + minute;
	const morning = minutes >= 6 * 60 && minutes < 10 * 60;
	const evening = minutes >= 17 * 60 && minutes < 22 * 60;
	if (!morning && !evening) return "";
	return "Truck ban: a truck on this departure is inside the Metro Manila window (06:00–10:00 or 17:00–22:00).";
}

export function routeSnapshot(input) {
	const src = input || {};
	const fuel = fuelCost(src);
	if (fuel == null) return { ok: false, message: "Enter kilometres, km per litre, and a fuel price." };
	const tolls = tollTotal(src.tolls, src.tollIds);
	const ferry = src.ferry === true ? roundMoney(num(src.ferryCost) || 0) : 0;
	return {
		ok: true,
		km: Number(src.km),
		kmPerL: Number(src.kmPerL),
		pricePerL: Number(src.pricePerL),
		buffer: FUEL_BUFFER,
		liters: fuelLiters(src.km, src.kmPerL),
		fuel,
		tolls,
		ferry,
		total: roundMoney(fuel + tolls + ferry),
		manual: src.manual === true,
		warning: truckBanWarning(src)
	};
}

export function routeCacheKey(from, to) {
	const r = (n) => Number(n).toFixed(4);
	return `${r(from.lat)},${r(from.lng)};${r(to.lat)},${r(to.lng)}`;
}

export function readCache(map, key, now, ttlMs) {
	const hit = map && map.get(key);
	if (!hit) return null;
	if (now - hit.at > ttlMs) {
		map.delete(key);
		return null;
	}
	return hit.value;
}

export function writeCache(map, key, value, now, max) {
	if (!map) return;
	if (map.has(key)) map.delete(key);
	map.set(key, { at: now, value });
	while (map.size > max) map.delete(map.keys().next().value);
}

function pair(text) {
	const [lat, lng] = String(text || "").split(",").map((part) => Number(part.trim()));
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
	return { lat, lng };
}

export function kmFromOsrm(body) {
	const meters = num(body?.routes?.[0]?.distance);
	if (meters == null || meters < 0) return null;
	return Math.round(meters / 10) / 100;
}

export function ferryFromOsrm(body) {
	const legs = body?.routes?.[0]?.legs || [];
	return legs.some((leg) => (leg?.steps || []).some((step) => /ferry/i.test(String(step?.mode || step?.maneuver?.type || ""))));
}

function tileParts(url) {
	const z = Number(url.searchParams.get("z"));
	const x = Number(url.searchParams.get("x"));
	const y = Number(url.searchParams.get("y"));
	if (!Number.isInteger(z) || z < 0 || z > 19) return null;
	if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return null;
	const limit = 2 ** z;
	if (x >= limit || y >= limit) return null;
	return { z, x, y };
}

async function tileResponse(url, fetchImpl, tiles, now) {
	const tile = tileParts(url);
	if (!tile) return Response.json({ ok: false }, { status: 400 });
	const key = `${tile.z}/${tile.x}/${tile.y}`;
	const hit = readCache(tiles, key, now, ROUTE_CACHE_MS);
	if (hit) return new Response(hit, { headers: { "content-type": "image/png" } });
	const remote = await fetchImpl(`${OSM_TILE}/${key}.png`, { headers: { "user-agent": "EstimatorSystem/route-fuel" } });
	if (!remote || !remote.ok) return Response.json({ ok: false, manual: true }, { status: 502 });
	const bytes = await remote.arrayBuffer();
	writeCache(tiles, key, bytes, now, 100);
	return new Response(bytes, { headers: { "content-type": "image/png" } });
}

/** Cached OSRM route, or a manual-distance flag when the service does not answer. OSM tiles use the same route. */
export async function routeFuelResponse(request, fetchImpl, caches, now = Date.now()) {
	const url = new URL(request.url);
	const kind = url.searchParams.get("kind") || "route";
	const routes = caches?.routes || new Map();
	const tiles = caches?.tiles || new Map();
	if (kind === "tile") return tileResponse(url, fetchImpl, tiles, now);
	const from = pair(url.searchParams.get("from"));
	const to = pair(url.searchParams.get("to"));
	if (!from || !to) return Response.json({ ok: false, manual: true, message: "Type the kilometres." }, { status: 400 });
	const key = routeCacheKey(from, to);
	const hit = readCache(routes, key, now, ROUTE_CACHE_MS);
	if (hit) return Response.json({ ...hit, cached: true });
	const path = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson`;
	let body = null;
	try {
		const remote = await fetchImpl(path, { headers: { "user-agent": "EstimatorSystem/route-fuel" } });
		if (remote && remote.ok) body = await remote.json();
	} catch {
		body = null;
	}
	const km = kmFromOsrm(body);
	if (km == null) return Response.json({ ok: false, manual: true, message: "Type the kilometres." });
	const value = {
		ok: true,
		km,
		ferry: ferryFromOsrm(body),
		geometry: body?.routes?.[0]?.geometry || null,
		manual: false
	};
	writeCache(routes, key, value, now, 100);
	return Response.json({ ...value, cached: false });
}

export function calculatorPrintRows(tool, results) {
	const src = results || {};
	if (tool === "weld") return [{ label: "Weld metal", value: src.weld?.kg == null ? "—" : `${src.weld.kg} kg` }];
	if (tool === "paint") return [{ label: "Paint", value: src.paint?.litres == null ? "—" : `${src.paint.litres} L` }];
	if (tool === "raw") return [{ label: "Weight", value: src.raw?.kg == null ? "—" : `${src.raw.kg} kg` }];
	if (tool === "air") return [{ label: "Air cargo", value: src.air?.total == null ? "—" : String(src.air.total) }];
	if (tool === "std") return [{ label: "Standards", value: String(src.standards || 0) }];
	return [];
}
