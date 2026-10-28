/** Server-only mail. No key, no send. The key is never written to the log. */

import { timingSafeEqual } from "node:crypto";
import { accountId } from "./departments.js";

/**
 * @param {{ to?: unknown, subject?: unknown, text?: unknown, env?: Record<string, string | undefined>, log?: (message: string) => void, fetchImpl?: (url: string, init: { method?: string, headers?: Record<string, string>, body?: string }) => Promise<{ ok: boolean }> }} input
 */
export async function sendRelease1Mail(input) {
	const env = input?.env || process.env;
	const log = input?.log || console.info;
	const key = String(env.RELEASE1_MAIL_KEY || "");
	if (!key) {
		log("release1 email skipped: RELEASE1_MAIL_KEY is not set");
		return { ok: true, skipped: true };
	}
	const url = String(env.RELEASE1_MAIL_URL || "");
	if (!url) {
		log("release1 email skipped: RELEASE1_MAIL_URL is not set");
		return { ok: true, skipped: true };
	}
	const to = String(input?.to || "").trim();
	if (!to) return { ok: false, skipped: false, message: "No address." };
	const fetchImpl = input?.fetchImpl || fetch;
	const response = await fetchImpl(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: String(env.RELEASE1_MAIL_FROM || ""),
			to,
			subject: String(input?.subject || ""),
			text: String(input?.text || ""),
		}),
	});
	if (!response.ok) return { ok: false, skipped: false, message: "Email was not accepted." };
	return { ok: true, skipped: false };
}

/** Fixed subjects. The client does not choose the wording. */
export const RELEASE1_TEMPLATES = {
	"needs-approval": { subject: "Needs your approval", text: (/** @type {string} */ label) => `${label} is waiting for approval.` },
	approved: { subject: "Document approved", text: (/** @type {string} */ label) => `${label} was approved.` },
	returned: { subject: "Returned", text: (/** @type {string} */ label) => `${label} was returned.` },
	escalated: { subject: "Escalated", text: (/** @type {string} */ label) => `${label} moved after 12 hours.` },
	expiring: { subject: "Proposal expiring", text: (/** @type {string} */ label) => `${label} is near its validity date.` },
	"ce-approved": { subject: "CE approved", text: (/** @type {string} */ label) => `${label} was approved.` },
};

/**
 * @param {unknown} header
 * @param {unknown} secret
 * @returns {boolean}
 */
export function schedulerAuthorized(header, secret) {
	const got = String(header || "");
	const want = String(secret || "");
	if (!got || !want || got.length !== want.length) return false;
	return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * Sign-in, or the scheduler secret. An empty secret never authorises the header.
 * @param {{ schedulerHeader?: unknown, secret?: unknown, userId?: unknown }} input
 */
export function release1RequestAllowed(input) {
	if (schedulerAuthorized(input?.schedulerHeader, input?.secret)) return { ok: true, via: "scheduler" };
	if (String(input?.userId || "").trim()) return { ok: true, via: "session" };
	return { ok: false, message: "Sign in is required." };
}

/**
 * Mail goes only to a roster account, and only with a fixed template.
 * @param {{ toUserId?: unknown, template?: unknown, label?: unknown, roster?: unknown[] }} input
 */
export function mailForRoster(input) {
	const template = String(input?.template || "");
	const built = RELEASE1_TEMPLATES[/** @type {keyof typeof RELEASE1_TEMPLATES} */ (template)];
	if (!built) return { ok: false, message: "Unknown template." };
	const id = String(input?.toUserId || "").trim();
	const roster = Array.isArray(input?.roster) ? input.roster : [];
	const hit = roster.find((user) => user && typeof user === "object" && (accountId(user) === id || String(/** @type {{ email?: unknown }} */ (user).email || "") === id));
	const email = String(hit && typeof hit === "object" ? /** @type {{ email?: unknown }} */ (hit).email || "" : "");
	if (!email.includes("@")) return { ok: false, message: "Mail only goes to a roster account." };
	return { ok: true, to: email, subject: built.subject, text: built.text(String(input?.label || "")) };
}
