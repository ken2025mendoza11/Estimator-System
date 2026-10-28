/** Required remark text. Screens use this. They do not use window.prompt. */

/**
 * @param {unknown} value
 * @param {boolean} [required]
 * @returns {{ ok: true, text: string } | { ok: false, message: string, text?: undefined }}
 */
export function requireReason(value, required = true) {
	const text = String(value ?? "").trim();
	if (required && !text) return { ok: false, message: "A remark is required." };
	return { ok: true, text };
}

/**
 * @typedef {(input: { title: string, required: boolean, label: string }) => Promise<{ ok: true, text: string } | { ok: false, message: string }>} ReasonOpener
 */

/** @type {ReasonOpener | null} */
let opener = null;

/** @param {ReasonOpener | null} next */
export function setReasonOpener(next) {
	opener = next;
}

/**
 * @param {{ title?: string, required?: boolean, label?: string }} [input]
 * @returns {Promise<{ ok: true, text: string } | { ok: false, message: string }>}
 */
export function askReason(input) {
	if (!opener) return Promise.resolve({ ok: false, message: "The remark box is not available." });
	return opener({
		title: String(input?.title || "Remark"),
		required: input?.required !== false,
		label: String(input?.label || "Remark"),
	});
}