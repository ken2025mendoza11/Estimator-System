/** In-app notification bell. Email stays off. */

/**
 * @param {any[]} events
 * @param {unknown} userId
 */
export function bellForUser(events, userId) {
	const id = String(userId || "");
	return (events || []).filter((row) => !row || row.toUserId === id || (Array.isArray(row.toUserIds) && row.toUserIds.includes(id)));
}

/**
 * @param {any[]} events
 */
export function unreadBell(events) {
	return (events || []).filter((row) => row && row.read !== true).length;
}

/**
 * @param {any[]} events
 * @param {unknown} now
 */
export function markAllRead(events, now) {
	return (events || []).map((row) => ({ ...row, read: true, readAt: String(now || "") }));
}

/**
 * @param {number} count
 */
export function documentTitle(count) {
	const n = Number(count) || 0;
	return n > 0 ? `(${n}) Estimator System` : "Estimator System";
}
