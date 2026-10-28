/** Server-only mail. No key, no send. The key is never written to the log. */

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
