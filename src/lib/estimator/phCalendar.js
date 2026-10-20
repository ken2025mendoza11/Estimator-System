// @ts-nocheck
/**
 * Philippine working days. Dates are YYYY-MM-DD Manila calendar dates.
 * Sunday is not a working day. Saturday is, unless that date is on the holiday list.
 * This does not change computeSchedule.
 */

function parts(iso) {
	const match = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return null;
	const y = Number(match[1]);
	const m = Number(match[2]);
	const d = Number(match[3]);
	if (m < 1 || m > 12 || d < 1 || d > 31) return null;
	return { y, m, d, iso: `${match[1]}-${match[2]}-${match[3]}` };
}

function utcDate(row) {
	return new Date(Date.UTC(row.y, row.m - 1, row.d));
}

function isoOf(date) {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function cleanHolidayDate(raw) {
	const row = parts(raw);
	return row ? row.iso : "";
}

function holidaySet(holidays) {
	const set = new Set();
	(holidays || []).forEach((item) => {
		const iso = cleanHolidayDate(item);
		if (iso) set.add(iso);
	});
	return set;
}

export function isSunday(iso) {
	const row = parts(iso);
	if (!row) return false;
	return utcDate(row).getUTCDay() === 0;
}

export function isWorkingDay(iso, holidays) {
	const row = parts(iso);
	if (!row) return false;
	if (utcDate(row).getUTCDay() === 0) return false;
	return !holidaySet(holidays).has(row.iso);
}

/** Move across working days. addWorkingDays(Monday, 1) is Tuesday when Tuesday is a working day. */
export function addWorkingDays(iso, count, holidays) {
	const row = parts(iso);
	if (!row) return "";
	let left = Math.trunc(Number(count) || 0);
	const cursor = utcDate(row);
	const step = left >= 0 ? 1 : -1;
	left = Math.abs(left);
	while (left > 0) {
		cursor.setUTCDate(cursor.getUTCDate() + step);
		if (isWorkingDay(isoOf(cursor), holidays)) left -= 1;
	}
	return isoOf(cursor);
}

/**
 * Working days in [start, end). Monday to the next Monday is 6 when Sunday is the only day off.
 * @returns {number}
 */
export function workingDaysBetween(start, end, holidays) {
	const from = parts(start);
	const to = parts(end);
	if (!from || !to) return 0;
	const cursor = utcDate(from);
	const stop = isoOf(utcDate(to));
	if (isoOf(cursor) === stop) return 0;
	const sign = utcDate(to) > cursor ? 1 : -1;
	let count = 0;
	while (isoOf(cursor) !== stop) {
		if (sign > 0) {
			if (isWorkingDay(isoOf(cursor), holidays)) count += 1;
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		} else {
			cursor.setUTCDate(cursor.getUTCDate() - 1);
			if (isWorkingDay(isoOf(cursor), holidays)) count -= 1;
		}
	}
	return count;
}
