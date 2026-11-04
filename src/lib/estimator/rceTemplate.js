/** RCE screen helpers. Answers, remarks, and row files stay on the RCE JSON. */

import { routeSignatories, signatoryPending } from "./ceSignatories.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function remarkPlain(value) {
	if (value && typeof value === "object") return String(/** @type {{ text?: unknown }} */ (value).text || "");
	return value == null ? "" : String(value);
}

/**
 * @param {unknown} value
 * @returns {{ bold: boolean, italic: boolean, color: string, font: string }}
 */
export function remarkFont(value) {
	const row = value && typeof value === "object" ? /** @type {{ bold?: unknown, italic?: unknown, color?: unknown }} */ (value) : {};
	const bold = row.bold === true;
	const italic = row.italic === true;
	const color = row.color === "red" ? "red" : "";
	const font = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
	return { bold, italic, color, font };
}

/**
 * @param {unknown} value
 * @param {{ text?: unknown, bold?: boolean, italic?: boolean, color?: string }} patch
 */
export function applyRemarkMark(value, patch) {
	const current = value && typeof value === "object" ? /** @type {{ text?: unknown, bold?: unknown, italic?: unknown, color?: unknown }} */ (value) : { text: value };
	const bold = patch.bold != null ? patch.bold === true : current.bold === true;
	const italic = patch.italic != null ? patch.italic === true : current.italic === true;
	const color = patch.color != null ? (patch.color === "red" ? "red" : "") : (current.color === "red" ? "red" : "");
	const text = patch.text != null ? String(patch.text) : remarkPlain(current);
	return { text, bold, italic, color };
}

/**
 * @param {any} checklist
 * @returns {any}
 */
export function copyAnswers(checklist) {
	return JSON.parse(JSON.stringify(checklist || {}));
}

/**
 * @param {any} checklist
 * @param {string[]} keys
 */
export function markAllYes(checklist, keys) {
	const next = { ...(checklist || {}) };
	(keys || []).forEach((key) => {
		next[key] = { ...(next[key] || {}), complete: "YES" };
	});
	return next;
}

/**
 * @param {any} checklist
 * @param {string[]} keys
 */
export function markRemainingNa(checklist, keys) {
	const next = { ...(checklist || {}) };
	(keys || []).forEach((key) => {
		if (next[key]?.complete) return;
		next[key] = { ...(next[key] || {}), complete: "N/A" };
	});
	return next;
}

/**
 * Clears answers only. Remarks and files stay.
 * @param {any} checklist
 * @param {string[]} keys
 */
export function clearAnswers(checklist, keys) {
	const next = { ...(checklist || {}) };
	(keys || []).forEach((key) => {
		next[key] = { ...(next[key] || {}), complete: "" };
	});
	return next;
}

/**
 * @param {any} form
 * @param {boolean} flagOn
 * @returns {boolean}
 */
export function estDaysRequired(form, flagOn) {
	if (flagOn === true) return false;
	return !!(form?.onsite && !(Number(form?.estDurationDays) > 0));
}

/**
 * @param {any} checklist
 * @param {string[]} keys
 * @returns {any[]}
 */
export function rowFilesInOrder(checklist, keys) {
	/** @type {any[]} */
	const files = [];
	(keys || []).forEach((key) => {
		const list = checklist?.[key]?.files;
		if (!Array.isArray(list)) return;
		list.forEach((file) => files.push({ ...(file || {}), rowKey: key }));
	});
	return files;
}

/**
 * @param {any[]} files
 * @param {number} index
 * @returns {number}
 */
export function fileStartPage(files, index) {
	let page = 1;
	for (let i = 0; i < index; i += 1) page += Math.max(1, Number(files[i]?.pages) || 1);
	return page;
}

/**
 * @param {any} form
 * @param {unknown[]} steps
 * @param {unknown[]} [users]
 */
export function prefillRceSigns(form, steps, users) {
	const filled = routeSignatories(steps, users);
	const next = { ...(form || {}) };
	["preparedBy", "preparedTitle", "reviewedBy", "reviewedTitle", "approvedBy", "approvedTitle"].forEach((key) => {
		if (filled[key] && !next[key]) next[key] = filled[key];
	});
	if (signatoryPending(next.preparedStamp)) next.preparedPending = true;
	return next;
}
