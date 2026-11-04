/** Personal NEW tag. Seen state is per user. A viewer does not clear anyone else. */

/**
 * @param {unknown} iso
 * @returns {string}
 */
export function manilaDate(iso) {
	const date = new Date(String(iso || ""));
	if (!Number.isFinite(date.getTime())) return "";
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * @param {{ weekendDays?: number[], holidays?: string[] }} [config]
 */
export function dayConfig(config) {
	const weekend = Array.isArray(config?.weekendDays) ? config.weekendDays.map((day) => Number(day)) : [0, 6];
	const holidays = Array.isArray(config?.holidays) ? config.holidays.map((day) => String(day)) : [];
	return { weekendDays: weekend, holidays };
}

/**
 * @param {string} dateStr
 * @param {{ weekendDays?: number[], holidays?: string[] }} [config]
 */
export function isWorkingDay(dateStr, config) {
	const cfg = dayConfig(config);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
	if (cfg.holidays.includes(dateStr)) return false;
	const [year, month, day] = dateStr.split("-").map((part) => Number(part));
	const weekDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
	return !cfg.weekendDays.includes(weekDay);
}

/**
 * @param {string} dateStr
 * @param {number} count
 * @param {{ weekendDays?: number[], holidays?: string[] }} [config]
 */
export function addWorkingDays(dateStr, count, config) {
	let left = Math.max(0, Number(count) || 0);
	let cursor = dateStr;
	let guard = 0;
	while (left > 0 && guard < 370) {
		guard += 1;
		const [year, month, day] = cursor.split("-").map((part) => Number(part));
		const next = new Date(Date.UTC(year, month - 1, day + 1));
		cursor = next.toISOString().slice(0, 10);
		if (isWorkingDay(cursor, config)) left -= 1;
	}
	return cursor;
}

/**
 * @param {{ userId?: unknown, targetedIds?: unknown[], seenBy?: Record<string, string>, createdAt?: unknown, now?: unknown, config?: { weekendDays?: number[], holidays?: string[] } }} input
 */
export function showNewForUser(input) {
	const userId = String(input?.userId || "");
	const targeted = (input?.targetedIds || []).map((id) => String(id));
	if (!userId || !targeted.includes(userId)) return false;
	if (input?.seenBy && input.seenBy[userId]) return false;
	const created = manilaDate(input?.createdAt);
	if (!created) return false;
	const until = addWorkingDays(created, 1, input?.config);
	const today = manilaDate(input?.now);
	return !!today && today <= until;
}

/**
 * @param {Record<string, string>} seenBy
 * @param {unknown} userId
 * @param {unknown} now
 */
export function markSeen(seenBy, userId, now) {
	const id = String(userId || "");
	if (!id) return { ...(seenBy || {}) };
	return { ...(seenBy || {}), [id]: String(now || "") };
}

/**
 * @param {{ hasCe?: boolean, openedByAssigneeOrLead?: boolean }} input
 */
export function openStage(input) {
	if (input?.hasCe) return "CE in progress";
	if (input?.openedByAssigneeOrLead) return "Pending";
	return "Unopened";
}
