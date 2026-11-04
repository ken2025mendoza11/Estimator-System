/** In-app CE thread. Stored on the workspace until the SQL migration is applied. */

/**
 * @param {unknown} userId
 * @param {unknown[]} participants
 */
export function threadVisible(userId, participants) {
	const id = String(userId || "");
	return (participants || []).map((row) => String(row || "")).includes(id);
}

/**
 * @param {any} thread
 * @param {{ from?: unknown, text?: unknown, now?: unknown }} input
 */
export function postMessage(thread, input) {
	const from = String(input?.from || "");
	const text = String(input?.text || "").trim();
	if (!from || !text) return { ok: false, message: "A message needs an author and text." };
	if (!threadVisible(from, thread?.participants || [])) return { ok: false, message: "Only participants can post." };
	const message = { id: `${from}-${thread?.messages?.length || 0}`, from, text, at: String(input?.now || "") };
	return { ok: true, thread: { ...(thread || {}), messages: [...(thread?.messages || []), message] } };
}

/**
 * @param {any} thread
 * @param {unknown} userId
 */
export function unreadCount(thread, userId) {
	const id = String(userId || "");
	const seen = String(thread?.seen?.[id] || "");
	return (thread?.messages || []).filter((/** @type {any} */ row) => row.from !== id && String(row.at || "") > seen).length;
}

/**
 * @param {any} thread
 * @param {unknown} userId
 * @param {unknown} now
 */
export function markThreadRead(thread, userId, now) {
	const id = String(userId || "");
	return { ...(thread || {}), seen: { ...(thread?.seen || {}), [id]: String(now || "") } };
}
