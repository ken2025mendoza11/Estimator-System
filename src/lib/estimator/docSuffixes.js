// @ts-nocheck
/**
 * CE family suffixes. The base format stays CE-{code}-{year}-{nnn} / CE-{year}-{nnn}.
 * Alternates are -A..-D. Addendums are -AD1 or -B-AD1. Update copies are -U1 on that stem.
 * An urgent CE keeps the next normal number and the tag "RCE to follow". There is no CE-M series.
 * Lead, head, and admin may mint an alternate (admin is included so the test admin can). Staff cannot.
 */

export const URGENT_TAG = "RCE to follow";
const LETTERS = ["A", "B", "C", "D"];
const CE_RE = /^(CE(?:-[A-Za-z][A-Za-z0-9]{0,7})?-\d{4}-\d+)(?:-([A-D]))?(?:-AD(\d+))?(?:-U(\d+))?(?:-R(\d+)(?:-\d+)?)?$/i;

/**
 * @param {unknown} raw
 */
export function parseCeNumber(raw) {
	const id = String(raw || "").trim();
	const match = id.match(CE_RE);
	if (!match) return { raw: id, base: id, letter: "", addendum: 0, update: 0, revision: 0, ok: false };
	return {
		raw: id,
		base: match[1],
		letter: (match[2] || "").toUpperCase(),
		addendum: match[3] ? parseInt(match[3], 10) : 0,
		update: match[4] ? parseInt(match[4], 10) : 0,
		revision: match[5] ? parseInt(match[5], 10) : 0,
		ok: true
	};
}

/** Family id: the base number, without letter, addendum, update, or revision. */
export function familyKey(raw) {
	const parsed = parseCeNumber(raw);
	return (parsed.ok ? parsed.base : String(raw || "").trim()).toUpperCase();
}

/** Stem used for an addendum or update: base, optional letter, optional addendum. No -U and no -R. */
export function stemOf(raw) {
	const parsed = parseCeNumber(raw);
	if (!parsed.ok) return String(raw || "").trim();
	let stem = parsed.base;
	if (parsed.letter) stem += `-${parsed.letter}`;
	if (parsed.addendum) stem += `-AD${parsed.addendum}`;
	return stem;
}

export function suffixTags(raw) {
	const parsed = parseCeNumber(raw);
	const tags = [];
	if (parsed.letter) tags.push(parsed.letter);
	if (parsed.addendum) tags.push(`AD${parsed.addendum}`);
	if (parsed.update) tags.push(`U${parsed.update}`);
	return tags;
}

export function canMintAlternate(level) {
	const key = String(level || "").toLowerCase();
	return key === "lead" || key === "head" || key === "admin";
}

/**
 * Blank reason is refused. A non-empty admin list must contain the reason.
 * An empty list allows any non-blank reason.
 * @param {unknown} reason
 * @param {unknown[]} [list]
 */
export function reasonAllowed(reason, list) {
	const why = String(reason || "").trim();
	if (!why) return false;
	const items = (Array.isArray(list) ? list : []).map((item) => String(item || "").trim()).filter(Boolean);
	if (!items.length) return true;
	return items.some((item) => item.toLowerCase() === why.toLowerCase());
}

function usedLetters(ids, base) {
	const key = familyKey(base);
	const used = new Set();
	(ids || []).forEach((id) => {
		const parsed = parseCeNumber(id);
		if (parsed.ok && familyKey(parsed.base) === key && parsed.letter) used.add(parsed.letter);
	});
	return used;
}

export function nextAlternate({ ids, base, level, reason, reasons }) {
	if (!canMintAlternate(level)) return { ok: false, error: "Only a lead or head can add an alternate." };
	if (!reasonAllowed(reason, reasons)) {
		return { ok: false, error: Array.isArray(reasons) && reasons.length ? "Pick a reason from the admin list." : "A reason is required." };
	}
	const parsed = parseCeNumber(base);
	const root = parsed.ok ? parsed.base : String(base || "").trim();
	if (!root) return { ok: false, error: "Missing the original number." };
	const letter = LETTERS.find((item) => !usedLetters(ids, root).has(item));
	if (!letter) return { ok: false, error: "Alternates A to D are already used." };
	return { ok: true, id: `${root}-${letter}`, letter, reason: String(reason).trim(), base: root };
}

export function isAwarded(status, awardStatus) {
	const award = String(awardStatus || "").trim().toLowerCase();
	if (award === "awarded") return true;
	return String(status || "").trim().toLowerCase() === "awarded";
}

export function nextAddendum({ ids, stem, awarded }) {
	if (!awarded) return { ok: false, error: "An addendum is only allowed when the estimate is Awarded." };
	const parsed = parseCeNumber(stem);
	if (!parsed.ok) return { ok: false, error: "That number is not a cost estimate." };
	let max = 0;
	(ids || []).forEach((id) => {
		const row = parseCeNumber(id);
		if (!row.ok || familyKey(row.base) !== familyKey(parsed.base)) return;
		if ((row.letter || "") !== parsed.letter) return;
		if (row.addendum) max = Math.max(max, row.addendum);
	});
	const n = max + 1;
	const id = parsed.letter ? `${parsed.base}-${parsed.letter}-AD${n}` : `${parsed.base}-AD${n}`;
	return { ok: true, id, n, base: parsed.base, letter: parsed.letter };
}

export function nextUpdateCopy({ ids, stem }) {
	const parsed = parseCeNumber(stem);
	if (!parsed.ok) return { ok: false, error: "That number is not a cost estimate." };
	const core = stemOf(stem);
	let max = 0;
	(ids || []).forEach((id) => {
		const row = parseCeNumber(id);
		if (!row.ok || stemOf(id).toUpperCase() !== core.toUpperCase()) return;
		if (row.update) max = Math.max(max, row.update);
	});
	const n = max + 1;
	return { ok: true, id: `${core}-U${n}`, n };
}

/** Urgent keeps the next normal number. It never mints a CE-M series. */
export function urgentPlan(nextNormalNumber) {
	const id = String(nextNormalNumber || "").trim();
	if (!id) return { ok: false, error: "Urgent uses the next normal number." };
	if (/^CE-M(?:-|$)/i.test(id)) return { ok: false, error: "There is no CE-M series." };
	return { ok: true, id, tag: URGENT_TAG };
}

export function planSuffix(kind, args) {
	if (kind === "alt") return nextAlternate(args || {});
	if (kind === "ad") return nextAddendum(args || {});
	if (kind === "upd") return nextUpdateCopy(args || {});
	return { ok: false, error: "Unknown suffix." };
}

function money(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	const text = String(value ?? "").replace(/[^0-9.-]/g, "");
	const n = Number(text);
	return Number.isFinite(n) ? n : 0;
}

function approvedRow(row) {
	const blob = `${row?.status || ""} ${row?.awardStatus || ""} ${row?.ceStatus || ""}`.toLowerCase();
	return blob.includes("done") || blob.includes("accepted") || blob.includes("approved") || blob.includes("awarded");
}

/**
 * Display sum of amounts the caller already computed. Does not call projectTotal.
 * Original (no letter, no addendum, no update) plus approved addendums. Alternates and update copies are not added.
 * @param {unknown[]} rows
 */
export function combinedTotal(rows) {
	let original = null;
	const addenda = new Map();
	(Array.isArray(rows) ? rows : []).forEach((row) => {
		const id = row?.id || row?.ceId || row?.ceNo || "";
		const parsed = parseCeNumber(id);
		if (!parsed.ok) return;
		if (!parsed.letter && !parsed.addendum && !parsed.update) {
			if (!original || parsed.revision >= original.revision) original = { revision: parsed.revision, amount: money(row.amount) };
			return;
		}
		if (parsed.addendum && approvedRow(row)) {
			const key = stemOf(id).toUpperCase();
			const prev = addenda.get(key);
			if (!prev || parsed.revision >= prev.revision) addenda.set(key, { revision: parsed.revision, amount: money(row.amount) });
		}
	});
	let sum = original ? original.amount : 0;
	addenda.forEach((item) => {
		sum += item.amount;
	});
	return Math.round(sum * 100) / 100;
}

/** True when PostgREST says next_ce_suffix is not deployed yet. */
export function missingSuffixRpc(error) {
	const record = error && typeof error === "object" ? error : {};
	const message = String(record.message || error || "");
	const code = String(record.code || "");
	if (code === "PGRST202" || code === "42883") return true;
	return /next_ce_suffix/i.test(message) && /does not exist|could not find|schema cache/i.test(message);
}
