// @ts-nocheck
/** Signature path, DRAFT mark, and the inspection noting rules. Flag off never calls these. */

export const SIGNATURE_BUCKET = "estimator-files";
export const SIGNATURE_FONT_FILE = "GreatVibes-Regular.ttf";

/** Same namespace as issue-access.server.ts stableUserUuid. auth.uid() is this value. */
const USER_NAMESPACE = "c1e0a7e0-7b1a-4e3a-9c2d-5f6a7b8c9d0e";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cache = new Map();
/** Paths that came back missing this session. A PDF draws the typed name instead. */
const missingSignatures = new Set();

function sha1(bytes) {
	const words = [];
	const bitLen = bytes.length * 8;
	for (let i = 0; i < bytes.length; i += 1) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << (24 - (i % 4) * 8));
	words[bitLen >> 5] = (words[bitLen >> 5] || 0) | (0x80 << (24 - (bitLen % 32)));
	words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;
	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;
	const w = new Array(80);
	for (let i = 0; i < words.length; i += 16) {
		for (let t = 0; t < 16; t += 1) w[t] = words[i + t] | 0;
		for (let t = 16; t < 80; t += 1) {
			const n = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
			w[t] = (n << 1) | (n >>> 31);
		}
		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;
		for (let t = 0; t < 80; t += 1) {
			let f;
			let k;
			if (t < 20) {
				f = (b & c) | (~b & d);
				k = 0x5a827999;
			} else if (t < 40) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			} else if (t < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8f1bbcdc;
			} else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}
			const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) | 0;
			e = d;
			d = c;
			c = (b << 30) | (b >>> 2);
			b = a;
			a = temp;
		}
		h0 = (h0 + a) | 0;
		h1 = (h1 + b) | 0;
		h2 = (h2 + c) | 0;
		h3 = (h3 + d) | 0;
		h4 = (h4 + e) | 0;
	}
	const out = new Uint8Array(20);
	[h0, h1, h2, h3, h4].forEach((h, i) => {
		out[i * 4] = (h >>> 24) & 255;
		out[i * 4 + 1] = (h >>> 16) & 255;
		out[i * 4 + 2] = (h >>> 8) & 255;
		out[i * 4 + 3] = h & 255;
	});
	return out;
}

function hexToBytes(hex) {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

/** auth.uid() for this account. A UUID is kept. Any other id is the same UUID v5 the JWT uses. */
export function stableUserUuid(userId) {
	const trimmed = String(userId || "").trim();
	if (!trimmed) return "";
	if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
	const namespace = hexToBytes(USER_NAMESPACE.replace(/-/g, ""));
	const name = new TextEncoder().encode(trimmed);
	const input = new Uint8Array(namespace.length + name.length);
	input.set(namespace, 0);
	input.set(name, namespace.length);
	const bytes = sha1(input).slice(0, 16);
	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function authUserId(person) {
	if (person && typeof person === "object") return String(person.userId || person.userKey || "").trim();
	return String(person || "").trim();
}

/** Storage key. The admin roster id is not an auth id and is ignored. */
export function signatureUserKey(person) {
	return stableUserUuid(authUserId(person));
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

function plainName(value) {
	return String(value || "").replace(/^(mr|mrs|ms|miss)\.?\s+/i, "").trim();
}

function nameAlias(name) {
	const label = plainName(name).toLowerCase();
	return label ? `name:${label}` : "";
}

export function rememberSignature(userKey, dataUrl, name) {
	const body = String(dataUrl || "");
	if (!body.startsWith("data:image/")) return;
	const key = signatureUserKey(userKey);
	if (key) cache.set(key, body);
	const alias = nameAlias(name || (userKey && userKey.name) || "");
	if (alias) cache.set(alias, body);
}

export function cachedSignature(userKey) {
	if (userKey && typeof userKey === "object") {
		const key = signatureUserKey(userKey);
		if (key && cache.get(key)) return cache.get(key);
		return cache.get(nameAlias(userKey.name)) || "";
	}
	const key = signatureUserKey(userKey);
	return (key && cache.get(key)) || "";
}

/** A storage read must not hold a PDF preview open. */
export const SIGNATURE_LOAD_MS = 4000;

export function withDeadline(start, ms, fallback = "") {
	return new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			resolve(fallback);
		}, ms);
		Promise.resolve()
			.then(start)
			.then(
				(value) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					resolve(value);
				},
				() => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					resolve(fallback);
				},
			);
	});
}

/** Session cache, then the private bucket. A missing bucket, a refused read, or a hung read returns "". */
export async function loadSignatureImage(userKey, download = null) {
	const hit = cachedSignature(userKey);
	if (hit) return hit;
	const path = signatureObjectPath(userKey);
	if (!path) return "";
	if (missingSignatures.has(path)) return "";
	try {
		const fetcher = download || (await import("./file-storage.ts")).downloadDataUrl;
		const dataUrl = await withDeadline(() => fetcher(path), SIGNATURE_LOAD_MS, "");
		const body = String(dataUrl || "");
		if (body.startsWith("data:image/")) {
			rememberSignature(userKey, body);
			return body;
		}
		// Missing file (storage 400/404) or not an image: ask once per session, then draw the name.
		missingSignatures.add(path);
		return "";
	} catch {
		missingSignatures.add(path);
		return "";
	}
}

/** Test hook and sign-out reset for the "file is missing" memory. */
export function forgetMissingSignatures() {
	missingSignatures.clear();
}

/** Writes signatures/<auth.uid>.png. Keeps the image for this session even if storage is missing. */
export async function storeSignatureImage(userKey, dataUrl, name) {
	const path = signatureObjectPath(userKey);
	const body = String(dataUrl || "");
	if (!body.startsWith("data:image/png")) return { ok: false, stored: false, path, message: "A PNG signature is required." };
	rememberSignature(userKey, body, name);
	if (!path) return { ok: false, stored: false, message: "A person is required." };
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

/**
 * Names to load. userId comes from an approval step or from userId/userKey.
 * adminConfig.users id is never the key.
 */
export function signaturePeople({ names = [], users = [], approval = null, approvals = [] } = {}) {
	const byName = new Map();
	const add = (name, userId) => {
		const label = String(name || "").trim();
		const key = plainName(label).toLowerCase();
		if (!key) return;
		const id = String(userId || "").trim();
		const prev = byName.get(key);
		if (!prev) byName.set(key, { name: label, userId: id });
		else if (!prev.userId && id) byName.set(key, { ...prev, userId: id });
	};
	const take = (item) => {
		if (!item) return;
		(item.steps || []).forEach((step) => add(step?.by, step?.byUserId));
		add(item.startedBy, item.startedByUserId);
	};
	take(approval);
	(approvals || []).forEach(take);
	(users || []).forEach((user) => add(user?.name, authUserId(user)));
	(names || []).forEach((entry) => {
		if (entry && typeof entry === "object") add(entry.name, authUserId(entry));
		else add(entry, "");
	});
	return [...byName.values()];
}

/** Flag on loads images for a draft and for a final PDF. Flag off loads none. */
export function shouldLoadExportSignatures(flagOn) {
	return flagOn === true;
}

const INSPECTION_ISSUED = new Set(["filed", "noted"]);
const FINAL_STATUSES = new Set(["done", "accepted", "approved", "noted", "cancelled", "canceled", "no quote", "close bid"]);

/** Flag off is never a draft mark. A final approval, including a decided closing, is not a draft. */
export function needsDraftWatermark({ flagOn, status, approvalStatus, docType = "" } = {}) {
	if (flagOn !== true) return false;
	// Step 25: an inspection report is issued once it is Filed. Filed and Noted carry no DRAFT mark.
	if (String(docType).toLowerCase() === "oif" && INSPECTION_ISSUED.has(String(status || "").trim().toLowerCase())) return false;
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
