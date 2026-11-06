/** Per-line database check. Pending additions live in admin JSON, not SQL. */

import { findSimilarItems, normalizeForMatch } from "./masterlistRules.js";

const SIZE_GLUED = /^([a-zA-Z]+)(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i;
const SIZE_UNIT = /^([a-zA-Z]+)(\d+(?:\.\d+)?)$/i;
const SIZE_NUM = /^(\d+(?:\.\d+)?)([a-zA-Z]*)$/;

/**
 * @param {string} prefix
 * @param {string} left
 * @param {string} right
 * @returns {string}
 */
function formatSize(prefix, left, right) {
	const p = String(prefix || "").toUpperCase();
	const a = String(left || "");
	const b = String(right || "").replace(/[^0-9.]/g, "");
	if (!b) return `${p}${a}`.trim();
	return `${p}${a} x ${b}`;
}

/**
 * @param {string[]} parts
 * @returns {{ kind: "size" | "word", text: string }[]}
 */
function classifyTokens(parts) {
	/** @type {{ kind: "size" | "word", text: string }[]} */
	const out = [];
	for (let i = 0; i < parts.length; i += 1) {
		const token = parts[i] || "";
		const glued = token.match(SIZE_GLUED);
		if (glued) {
			out.push({ kind: "size", text: formatSize(glued[1] || "", glued[2] || "", glued[3] || "") });
			continue;
		}
		const unit = token.match(SIZE_UNIT);
		const joiner = parts[i + 1] || "";
		const after = parts[i + 2] || "";
		if (unit && /^x$/i.test(joiner) && SIZE_NUM.test(after)) {
			const num = after.match(SIZE_NUM);
			out.push({ kind: "size", text: formatSize(unit[1] || "", unit[2] || "", num ? num[1] || "" : after) });
			i += 2;
			continue;
		}
		out.push({ kind: "word", text: token });
	}
	return out;
}

/**
 * @param {unknown} raw
 * @returns {{ noun: string, modifier: string, size: string, material: string, words: string[] }}
 */
function nounParts(raw) {
	const parts = String(raw || "").replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
	const tokens = classifyTokens(parts);
	const words = tokens.filter((row) => row.kind === "word").map((row) => row.text);
	const sizes = tokens.filter((row) => row.kind === "size").map((row) => row.text);
	const noun = words[0] ? words[0].toUpperCase() : "";
	const material = words.length > 1 ? words[words.length - 1].toUpperCase() : "";
	const modifier = words.length > 2 ? words.slice(1, -1).join(" ").toUpperCase() : "";
	return { noun, modifier, size: sizes.join(" "), material, words };
}

/**
 * NOUN, MODIFIER, SIZE, MATERIAL. "bolt hex m12x50 ss304" → "BOLT, HEX, M12 x 50, SS304".
 * @param {unknown} raw
 * @returns {string}
 */
export function buildNounName(raw) {
	const parts = nounParts(raw);
	return [parts.noun, parts.modifier, parts.size, parts.material].filter(Boolean).join(", ");
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function nounSpecRemark(raw) {
	const parts = nounParts(raw);
	if (!parts.size || !parts.material) return "Specs incomplete — confirm size and material.";
	return "";
}

/**
 * @param {unknown} raw
 * @param {unknown} category
 * @returns {{ name: string, uom: string, category: string, remark: string }}
 */
export function masterAddDraft(raw, category) {
	return {
		name: buildNounName(raw),
		uom: "",
		category: String(category || ""),
		remark: nounSpecRemark(raw),
	};
}

/**
 * @param {{ name?: unknown, items?: unknown, pending?: unknown, nameField?: unknown }} input
 * @returns {{ state: "exact" | "similar" | "new" | "pending", noun: string, similar: { item: any, label: string, score: number }[] }}
 */
export function lineDbState(input) {
	const name = String(input?.name || "").trim();
	const noun = buildNounName(name) || name.toUpperCase();
	const pending = Array.isArray(input?.pending) ? input.pending : [];
	const key = normalizeForMatch(noun);
	const rawKey = normalizeForMatch(name);
	const waiting = pending.find((row) => {
		if (!row || row.status !== "pending") return false;
		const rec = /** @type {{ name?: unknown, raw?: unknown }} */ (row);
		return normalizeForMatch(rec.name) === key || normalizeForMatch(rec.raw) === rawKey;
	});
	if (waiting) return { state: "pending", noun, similar: [] };
	const items = Array.isArray(input?.items) ? input.items : [];
	/** @type {{ item: any, label: string, score: number }[]} */
	const hits = findSimilarItems(noun || name, items, String(input?.nameField || "description"), 0.78).slice(0, 3);
	const exact = hits.find((hit) => Number(hit.score) >= 0.98);
	if (exact) return { state: "exact", noun, similar: hits };
	if (hits.length) return { state: "similar", noun, similar: hits };
	return { state: "new", noun, similar: [] };
}

/**
 * @param {unknown} list
 * @returns {any[]}
 */
export function persistPending(list) {
	return JSON.parse(JSON.stringify(Array.isArray(list) ? list : []));
}

/**
 * Any role may request. The item is not added to the masterlist here.
 * @param {{ raw?: unknown, name?: unknown, uom?: unknown, category?: unknown, remark?: unknown, similar?: unknown, requestedBy?: unknown, role?: unknown, pending?: unknown, id?: unknown, now?: unknown }} input
 */
export function requestMasterItem(input) {
	const raw = String(input?.raw || "").trim();
	const name = String(input?.name || buildNounName(raw)).trim();
	const pending = persistPending(input?.pending);
	const request = {
		id: String(input?.id || `pml-${pending.length + 1}`),
		raw,
		name,
		uom: String(input?.uom || "").trim(),
		category: String(input?.category || "").trim(),
		remark: String(input?.remark != null ? input.remark : nounSpecRemark(raw || name)),
		similar: Array.isArray(input?.similar) ? input.similar.map((row) => String(row || "")) : [],
		requestedBy: String(input?.requestedBy || ""),
		role: String(input?.role || ""),
		status: "pending",
		at: String(input?.now || ""),
	};
	pending.push(request);
	return { pending: persistPending(pending), request };
}

/**
 * Only Admin moves a pending row into the item list.
 * @param {{ pendingId?: unknown, pending?: unknown, items?: unknown, approverRole?: unknown, approverId?: unknown }} input
 * @returns {{ ok: boolean, message?: string, pending: any[], items: any[], item?: any }}
 */
export function approveMasterItem(input) {
	const pending = persistPending(input?.pending);
	const items = Array.isArray(input?.items) ? input.items.map((row) => ({ .../** @type {object} */ (row) })) : [];
	const role = String(input?.approverRole || "").toLowerCase();
	if (role !== "admin") return { ok: false, message: "Only Admin can approve a database item.", pending, items };
	const id = String(input?.pendingId || "");
	const hit = pending.find((row) => row && row.id === id && row.status === "pending");
	if (!hit) return { ok: false, message: "That request is not pending.", pending, items };
	hit.status = "approved";
	hit.approvedBy = String(input?.approverId || "");
	const item = {
		id: `ml-${hit.id}`,
		description: hit.name,
		name: hit.name,
		unit: hit.uom,
		category: hit.category,
		remark: hit.remark,
		active: "Yes",
	};
	items.push(item);
	return { ok: true, pending: persistPending(pending), items, item };
}
