// @ts-nocheck
/**
 * Branding colors become CSS variables on .ce-app only when features.branding === true.
 * The stylesheet defaults stay as they are.
 */

const KEYS = {
	bg: "--bg",
	card: "--card",
	ink: "--ink",
	ledger: "--ledger",
	brass: "--brass"
};

function hex(value) {
	const text = String(value || "").trim();
	return /^#[0-9a-fA-F]{6}$/.test(text) ? text : "";
}

export function cleanBranding(raw) {
	const src = raw && typeof raw === "object" ? raw : {};
	const out = {};
	Object.keys(KEYS).forEach((key) => {
		const value = String(src[key] || "").trim().slice(0, 7);
		if (value) out[key] = value;
	});
	return out;
}

export function brandingVars(raw) {
	const src = raw && typeof raw === "object" ? raw : {};
	const out = {};
	Object.keys(KEYS).forEach((key) => {
		const value = hex(src[key]);
		if (value) out[KEYS[key]] = value;
	});
	return out;
}
