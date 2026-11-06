/** Personal NEW tag. Seen state is per user. A viewer does not clear anyone else. */

import { addWorkingDays as addCalendarDays, isWorkingDay as calendarWorkingDay } from "./phCalendar.js";

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
 * Saturday is a working day unless the company config turns it off.
 * An explicit weekendDays list is still honored (tests and older callers).
 * @param {{ weekendDays?: number[], holidays?: string[], saturdayWorking?: boolean }} [config]
 */
export function dayConfig(config) {
	const holidays = Array.isArray(config?.holidays) ? config.holidays.map((day) => String(day)) : [];
	if (config && typeof config.saturdayWorking === "boolean") {
		const saturdayWorking = config.saturdayWorking !== false;
		return { saturdayWorking, weekendDays: saturdayWorking ? [0] : [0, 6], holidays };
	}
	if (config && Array.isArray(config.weekendDays)) {
		const weekendDays = config.weekendDays.map((day) => Number(day));
		return { weekendDays, holidays, saturdayWorking: !weekendDays.includes(6) };
	}
	return { saturdayWorking: true, weekendDays: [0], holidays };
}

/**
 * @param {string} dateStr
 * @param {{ weekendDays?: number[], holidays?: string[], saturdayWorking?: boolean }} [config]
 */
export function isWorkingDay(dateStr, config) {
	return calendarWorkingDay(dateStr, dayConfig(config));
}

/**
 * @param {string} dateStr
 * @param {number} count
 * @param {{ weekendDays?: number[], holidays?: string[], saturdayWorking?: boolean }} [config]
 */
export function addWorkingDays(dateStr, count, config) {
	const left = Math.max(0, Number(count) || 0);
	if (!dateStr || !left) return dateStr || "";
	return addCalendarDays(dateStr, left, dayConfig(config));
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
