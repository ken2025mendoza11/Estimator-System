// @ts-nocheck
/** Signature path, DRAFT mark, and the inspection noting rules. Flag off never calls these. */

export const SIGNATURE_BUCKET = "estimator-files";
export const SIGNATURE_FONT_FILE = "GreatVibes-Regular.ttf";

const cache = new Map();

function cleanKey(value) {
	return String(value || "").trim().replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 80);
}

/** Storage object name. Empty when there is no user key. */
export function signatureUserKey(person) {
	if (person && typeof person === "object") return cleanKey(person.id || person.userId || person.name || person.email || "");
	return cleanKey(person);
}

export function signatureObjectPath(userKey) {
	const key = signatureUserKey(userKey);
	if (!key) return "";
	return `signatures/${key}.png`;
}

/** True only for this user's own PNG. A different user, or any other folder, is false. */
export function isOwnSignaturePath(userKey, path) {
	const expected = signatureObjectPath(userKey);
	return !!expected && String(path || "") === expected;
}

export function rememberSignature(userKey, dataUrl, name) {
	const body = String(dataUrl || "");
	if (!body.startsWith("data:image/")) return;
	const keys = [signatureUserKey(userKey), signatureUserKey(name)].filter(Boolean);
	keys.forEach((key) => cache.set(key, body));
}

export function cachedSignature(userKey) {
	return cache.get(signatureUserKey(userKey)) || "";
}

/** Session cache, then the private bucket. A missing bucket or a refused read returns "". */
export async function loadSignatureImage(userKey) {
	const hit = cachedSignature(userKey);
	if (hit) return hit;
	const path = signatureObjectPath(userKey);
	if (!path) return "";
	try {
		const { downloadDataUrl } = await import("./file-storage.ts");
		const dataUrl = await downloadDataUrl(path);
		if (dataUrl) rememberSignature(userKey, dataUrl);
		return dataUrl || "";
	} catch {
		return "";
	}
}

/** Writes signatures/<user_key>.png. Keeps the image for this session even if storage is missing. */
export async function storeSignatureImage(userKey, dataUrl, name) {
	const path = signatureObjectPath(userKey);
	const body = String(dataUrl || "");
	if (!path) return { ok: false, stored: false, message: "A person is required." };
	if (!body.startsWith("data:image/png")) return { ok: false, stored: false, path, message: "A PNG signature is required." };
	rememberSignature(userKey, body, name);
	try {
		const { supabase } = await import("../supabase/client.ts");
		const { ensureSupabaseAccess } = await import("../supabase/session.ts");
		await ensureSupabaseAccess();
		const comma = body.indexOf(",");
		const binary = atob(comma >= 0 ? body.slice(comma + 1) : "");
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		const { error } = await supabase.storage.from(SIGNATURE_BUCKET).upload(path, new Blob([bytes], { type: "image/png" }), {
			contentType: "image/png",
			upsert: true
		});
		if (error) return { ok: false, stored: false, path, message: error.message || "Signature storage is not available." };
		return { ok: true, stored: true, path };
	} catch (err) {
		return { ok: false, stored: false, path, message: err?.message || "Signature storage is not available." };
	}
}

const FINAL_STATUSES = new Set(["done", "accepted", "approved", "noted", "cancelled", "canceled", "no quote", "close bid"]);

/** Flag off is never a draft mark. A final approval, including a decided closing, is not a draft. */
export function needsDraftWatermark({ flagOn, status, approvalStatus } = {}) {
	if (flagOn !== true) return false;
	const approval = String(approvalStatus || "").trim().toLowerCase();
	if (approval === "accepted" || approval === "approved") return false;
	const key = String(status || "").trim().toLowerCase();
	if (!key) return true;
	return !FINAL_STATUSES.has(key);
}

/** Prepared by the inspector, then noted by the lead. */
export function inspectionNotingSteps() {
	return [
		{ id: "oif-prepared", title: "Prepared by", role: "staff" },
		{ id: "oif-noted", title: "Noted by", role: "lead", isFinal: true }
	];
}

/** A sealed or closed estimate must not take inspection lines. */
export function ceBlocksInspectionLines(ce) {
	if (!ce) return false;
	const key = String(ce.status || ce.ceStatus || "").trim().toLowerCase();
	if (!key) return false;
	if (key === "for approval" || key === "done" || key === "accepted" || key === "approved") return true;
	if (key.startsWith("pending ") && key.endsWith(" approval")) return true;
	if (key === "cancelled" || key === "canceled" || key === "no quote" || key === "close bid") return true;
	return false;
}
