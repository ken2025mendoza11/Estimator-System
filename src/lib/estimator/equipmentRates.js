// @ts-nocheck
/**
 * Equipment rates. Four figures, each a formula or a manual override.
 * A BOTE line with no rateType stays per day: today's qty × days × rate.
 * A new line stores the chosen figure as that same per-day rate, plus a snapshot.
 */

import { evaluateFormula, roundRate } from "./rateFormula.js";

export const RATE_KINDS = ["hour", "day", "rental", "project"];

export function defaultEquipmentFormula() {
	return {
		version: 1,
		hour: "(cost - salvage) / life / hours * (1 + maintenance / 100)",
		day: "(cost - salvage) / life * (1 + maintenance / 100)",
		rental: "(cost - salvage) / life * (1 + maintenance / 100) * (1 + rental / 100)",
		project: "(cost - salvage) / life * (1 + maintenance / 100) * days"
	};
}

function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function normalizeEquipmentFormula(raw) {
	const base = defaultEquipmentFormula();
	const src = raw && typeof raw === "object" ? raw : {};
	const version = Math.max(1, Math.trunc(Number(src.version) || 1));
	const next = { version };
	RATE_KINDS.forEach((kind) => {
		const text = String(src[kind] || "").trim();
		next[kind] = text || base[kind];
	});
	return next;
}

export function formulaVersionAfterEdit(previous, next) {
	const before = normalizeEquipmentFormula(previous);
	const after = normalizeEquipmentFormula(next);
	const changed = RATE_KINDS.some((kind) => before[kind] !== after[kind]);
	return changed ? before.version + 1 : before.version;
}

function normalizeSlot(raw) {
	if (raw && raw.mode === "manual" && Number.isFinite(Number(raw.override))) {
		return { mode: "manual", override: Number(raw.override) };
	}
	return { mode: "formula" };
}

export function normalizeEquipmentItem(raw) {
	const src = raw && typeof raw === "object" ? raw : {};
	const rates = src.rates && typeof src.rates === "object" ? src.rates : {};
	const slots = {};
	RATE_KINDS.forEach((kind) => {
		slots[kind] = normalizeSlot(rates[kind]);
	});
	return {
		id: String(src.id || ""),
		description: String(src.description || "").trim(),
		cost: num(src.cost),
		life: num(src.life),
		salvage: num(src.salvage),
		hours: num(src.hours),
		days: num(src.days),
		maintenance: num(src.maintenance),
		rental: num(src.rental),
		rates: slots
	};
}

function inputsOf(item) {
	return {
		cost: num(item.cost),
		life: num(item.life),
		salvage: num(item.salvage),
		hours: num(item.hours),
		days: num(item.days),
		maintenance: num(item.maintenance),
		rental: num(item.rental)
	};
}

export function equipmentRateCard(item, formula) {
	const spec = normalizeEquipmentFormula(formula);
	const row = normalizeEquipmentItem(item);
	const inputs = inputsOf(row);
	const card = {};
	RATE_KINDS.forEach((kind) => {
		const slot = row.rates[kind];
		if (slot.mode === "manual") {
			card[kind] = { amount: roundRate(slot.override), source: "manual", version: spec.version, error: "" };
			return;
		}
		const result = evaluateFormula(spec[kind], inputs);
		card[kind] = {
			amount: result.ok ? roundRate(result.value) : null,
			source: "formula",
			version: spec.version,
			error: result.ok ? "" : result.error
		};
	});
	return card;
}

/** The number today's BOTE line multiplies as a daily rate. Null means do not change the line. */
export function perDayRate(item, formula, kind) {
	const rateType = RATE_KINDS.includes(kind) ? kind : "day";
	const card = equipmentRateCard(item, formula)[rateType];
	if (card.amount == null) return null;
	const hours = num(item.hours);
	const days = num(item.days);
	if (rateType === "hour") return hours > 0 ? roundRate(card.amount * hours) : null;
	if (rateType === "project") return days > 0 ? roundRate(card.amount / days) : null;
	return card.amount;
}

export function matchEquipmentItem(items, description) {
	const needle = String(description || "").trim().toLowerCase();
	if (!needle) return null;
	return (items || []).map(normalizeEquipmentItem).find((item) => item.description.toLowerCase() === needle) || null;
}

/**
 * Snapshot for a new BOTE line. The stored `rate` is the per-day figure calcBOTE already uses.
 * Old lines never call this, so they stay per day.
 */
export function boteLineSnapshot(item, formula, kind) {
	const rateType = RATE_KINDS.includes(kind) ? kind : "day";
	const spec = normalizeEquipmentFormula(formula);
	const card = equipmentRateCard(item, spec)[rateType];
	const daily = perDayRate(item, spec, rateType);
	if (daily == null) return { ok: false, error: card.error || "That rate could not be calculated." };
	const row = normalizeEquipmentItem(item);
	return {
		ok: true,
		rateType,
		rate: daily,
		rateVersion: spec.version,
		rateSnapshot: {
			kind: rateType,
			selected: card.amount,
			source: card.source,
			version: spec.version,
			cost: row.cost,
			life: row.life,
			salvage: row.salvage,
			hours: row.hours,
			days: row.days,
			maintenance: row.maintenance,
			rental: row.rental
		}
	};
}

/** Today's BOTE amount. Missing rateType is per day. This does not replace calcBOTE. */
export function legacyBoteAmount(line) {
	const qty = num(line?.qty);
	const days = num(line?.days);
	const rate = num(line?.rate);
	return Math.round(qty * days * rate * 100) / 100;
}
