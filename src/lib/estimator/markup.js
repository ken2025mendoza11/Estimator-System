/** Markup on an approved cost estimate. Direct cost is a stored total. This file does not recompute CE lines. */

import { backupSignatureLabel, normalizeApproverLists } from "./departments.js";
import { roundMoney, sumRounded } from "./money.js";

export const RELEASE1_MARKUP_FLAG = "release1Markup";

const CATEGORY_KEYS = ["MOB", "DEMOB", "BOL", "BOTE", "BOCM", "PPE", "MISC"];

/** @type {Record<string, { profit: number, contingency: number, markup: number }>} */
export const MARKUP_PRESETS = {
	"100": { profit: 35, contingency: 15, markup: 50 },
	"75": { profit: 35, contingency: 10, markup: 30 },
	"65": { profit: 35, contingency: 10, markup: 20 },
};

const APPROVED_CE = new Set(["done", "accepted", "awarded"]);

/**
 * @param {unknown} features
 * @returns {boolean}
 */
export function markupFlagOn(features) {
	if (!features || typeof features !== "object") return false;
	return /** @type {{ release1Markup?: unknown }} */ (features).release1Markup === true;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function percent(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return roundMoney(n);
}

/**
 * @param {unknown} parts
 * @returns {{ profit: number, contingency: number, markup: number } | null}
 */
export function normalizeParts(parts) {
	if (!parts || typeof parts !== "object") return null;
	const row = /** @type {Record<string, unknown>} */ (parts);
	const profit = percent(row.profit);
	const contingency = percent(row.contingency);
	const markup = percent(row.markup);
	if (profit == null || contingency == null || markup == null) return null;
	return { profit, contingency, markup };
}

/**
 * @param {{ profit: number, contingency: number, markup: number }} parts
 * @returns {string}
 */
export function matchingPreset(parts) {
	const hit = Object.entries(MARKUP_PRESETS).find(([, preset]) => preset.profit === parts.profit && preset.contingency === parts.contingency && preset.markup === parts.markup);
	return hit ? hit[0] : "";
}

/**
 * @param {unknown} key
 * @returns {{ profit: number, contingency: number, markup: number } | null}
 */
export function presetParts(key) {
	const preset = MARKUP_PRESETS[String(key || "")];
	return preset ? { ...preset } : null;
}

/**
 * Already-computed CE total, or a sum of already-computed category totals.
 * Does not price a line.
 * @param {unknown} totals
 * @returns {number}
 */
export function readDirectCost(totals) {
	if (typeof totals === "number" || typeof totals === "string") {
		const n = Number(totals);
		return Number.isFinite(n) ? roundMoney(n) : 0;
	}
	if (!totals || typeof totals !== "object") return 0;
	const row = /** @type {Record<string, unknown>} */ (totals);
	const present = CATEGORY_KEYS.filter((key) => row[key] != null && row[key] !== "");
	if (present.length) return sumRounded(present.map((key) => row[key]));
	for (const key of ["directCost", "direct", "official", "total"]) {
		if (row[key] == null || row[key] === "") continue;
		const n = Number(row[key]);
		return Number.isFinite(n) ? roundMoney(n) : 0;
	}
	return 0;
}

/**
 * @param {{ profit: number, contingency: number, markup: number }} parts
 * @returns {number}
 */
export function totalPercent(parts) {
	return roundMoney(parts.profit + parts.contingency + parts.markup);
}

/**
 * Selling = direct cost x (1 + total %). Direct cost only.
 * @param {unknown} directCost
 * @param {{ profit: number, contingency: number, markup: number }} parts
 * @returns {number}
 */
export function sellingFromDirect(directCost, parts) {
	const direct = roundMoney(Number(directCost));
	return roundMoney(direct * (1 + totalPercent(parts) / 100));
}

/**
 * @param {unknown} status
 * @returns {boolean}
 */
export function ceApprovedForMarkup(status) {
	return APPROVED_CE.has(String(status || "").trim().toLowerCase());
}

/**
 * @param {{ flagOn?: boolean, sales?: boolean, status?: unknown, existing?: unknown }} input
 * @returns {boolean}
 */
export function canGenerateMarkup(input) {
	if (input?.flagOn !== true || input?.sales !== true) return false;
	if (!ceApprovedForMarkup(input.status)) return false;
	return !input.existing;
}

/**
 * @param {unknown} markup
 * @returns {boolean}
 */
export function markupPercentsOpen(markup) {
	const status = markup && typeof markup === "object" ? String(/** @type {{ status?: unknown }} */ (markup).status || "") : "";
	return status === "Draft" || status === "Returned";
}

/**
 * @param {string} who
 * @param {string} action
 * @param {string} remarks
 * @param {unknown} now
 */
function entry(who, action, remarks, now) {
	return {
		id: crypto.randomUUID(),
		at: now ? String(now) : new Date().toISOString(),
		who,
		action,
		remarks: remarks || "",
	};
}

/**
 * @param {unknown} markup
 * @param {{ profit: number, contingency: number, markup: number }} parts
 */
function withParts(markup, parts) {
	const row = /** @type {Record<string, unknown>} */ (markup);
	return {
		...row,
		parts,
		preset: matchingPreset(parts),
		selling: sellingFromDirect(row.directCost, parts),
		directCost: row.directCost,
	};
}

/**
 * @param {{ ceId?: unknown, byUserId?: unknown, directCost?: unknown, totals?: unknown, preset?: unknown, parts?: unknown, now?: unknown }} input
 * @returns {{ ok: true, markup: any } | { ok: false, message: string, markup?: undefined }}
 */
export function createMarkup(input) {
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	const directCost = readDirectCost(input?.directCost != null ? input.directCost : input?.totals);
	if (!(directCost > 0)) return { ok: false, message: "Direct cost is missing." };
	const fromPreset = presetParts(input?.preset || "100");
	const parts = input?.parts != null ? normalizeParts(input.parts) : fromPreset;
	if (!parts) return { ok: false, message: "Each percent must be a number." };
	const markup = {
		ceId: String(input?.ceId || ""),
		directCost,
		parts,
		preset: matchingPreset(parts),
		selling: sellingFromDirect(directCost, parts),
		status: "Draft",
		ownerId: byUserId,
		steps: [],
		currentIndex: -1,
		timeline: [entry(byUserId, "Markup created", "", input?.now)],
	};
	return { ok: true, markup };
}

/**
 * @param {any} markup
 * @param {unknown} parts
 * @returns {{ ok: true, markup: any } | { ok: false, message: string, markup?: undefined }}
 */
export function setMarkupParts(markup, parts) {
	if (!markupPercentsOpen(markup)) return { ok: false, message: "Percents are locked after submit." };
	const next = normalizeParts(parts);
	if (!next) return { ok: false, message: "Each percent must be a number." };
	return { ok: true, markup: withParts(markup, next) };
}

/**
 * @param {any} markup
 * @param {unknown} preset
 * @returns {{ ok: true, markup: any } | { ok: false, message: string, markup?: undefined }}
 */
export function applyMarkupPreset(markup, preset) {
	const parts = presetParts(preset);
	if (!parts) return { ok: false, message: "Unknown preset." };
	return setMarkupParts(markup, parts);
}

/**
 * @param {any} markup
 * @param {{ byUserId?: unknown, approverLists?: unknown, parts?: unknown, now?: unknown }} input
 * @returns {{ ok: true, markup: any, toUserId: string } | { ok: false, message: string, markup?: undefined, toUserId?: undefined }}
 */
export function submitMarkup(markup, input) {
	let current = markup;
	if (input?.parts != null) {
		const priced = setMarkupParts(markup, input.parts);
		if (!priced.ok || !priced.markup) return { ok: false, message: /** @type {{ message?: string }} */ (priced).message || "Each percent must be a number." };
		current = priced.markup;
	}
	if (!markupPercentsOpen(current)) return { ok: false, message: "This markup is not open for submit." };
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	if (byUserId !== current.ownerId) return { ok: false, message: "Only the Sales owner can submit this markup." };
	const rows = normalizeApproverLists(input?.approverLists).markup;
	if (!rows.length) return { ok: false, message: "Add a Markup approver in Admin." };
	const steps = rows.map((row, index) => ({
		userId: row.userId,
		backupUserId: row.backupUserId,
		isFinal: index === rows.length - 1,
		decision: "",
		byUserId: "",
		at: "",
		remarks: "",
		forUserId: "",
	}));
	const at = input?.now;
	return {
		ok: true,
		markup: {
			...current,
			status: "For approval",
			steps,
			currentIndex: 0,
			timeline: [...(current.timeline || []), entry(byUserId, "Markup submitted", "", at)],
		},
		toUserId: steps[0].userId,
	};
}

/**
 * @param {any} markup
 * @param {unknown} actorId
 * @returns {boolean}
 */
export function actorMayDecideMarkup(markup, actorId) {
	if (!markup || markup.status !== "For approval") return false;
	const step = (markup.steps || [])[markup.currentIndex];
	if (!step) return false;
	const actor = String(actorId || "").trim();
	if (!actor) return false;
	return actor === step.userId || (!!step.backupUserId && actor === step.backupUserId);
}

/**
 * @param {any} markup
 * @param {{ actorId?: unknown, decision?: unknown, remarks?: unknown, now?: unknown }} input
 * @returns {{ ok: true, markup: any, final: boolean, toUserId?: string } | { ok: false, message: string, markup?: undefined, final?: undefined, toUserId?: undefined }}
 */
export function decideMarkup(markup, input) {
	if (!markup || markup.status !== "For approval") return { ok: false, message: "This markup is not waiting for approval." };
	const actorId = String(input?.actorId || "").trim();
	const steps = Array.isArray(markup.steps) ? markup.steps.map((/** @type {any} */ step) => ({ ...step })) : [];
	const index = Number(markup.currentIndex);
	const step = steps[index];
	if (!step) return { ok: false, message: "No approver is assigned." };
	const asPrimary = actorId === step.userId;
	const asBackup = !!step.backupUserId && actorId === step.backupUserId && !asPrimary;
	if (!asPrimary && !asBackup) return { ok: false, message: "This step is for another approver." };
	const decision = input?.decision === "return" ? "return" : input?.decision === "approve" ? "approve" : "";
	if (!decision) return { ok: false, message: "Choose approve or return." };
	const remarks = String(input?.remarks || "").trim();
	if (decision === "return" && !remarks) return { ok: false, message: "A remark is required." };
	const at = input?.now ? String(input.now) : new Date().toISOString();
	const forUserId = asBackup ? step.userId : "";
	const note = forUserId ? [backupSignatureLabel(forUserId), remarks].filter(Boolean).join(" ") : remarks;
	steps[index] = { ...step, decision, byUserId: actorId, at, remarks: note, forUserId };
	const timeline = [...(markup.timeline || []), entry(actorId, decision === "return" ? "Markup returned" : "Markup approved", note, at)];
	if (decision === "return") {
		return { ok: true, markup: { ...markup, status: "Returned", steps, timeline }, final: false };
	}
	if (index >= steps.length - 1) {
		return { ok: true, markup: { ...markup, status: "Approved", steps, timeline }, final: true };
	}
	const nextIndex = index + 1;
	return {
		ok: true,
		markup: { ...markup, status: "For approval", steps, currentIndex: nextIndex, timeline },
		toUserId: steps[nextIndex].userId,
		final: false,
	};
}
