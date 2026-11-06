/** MISC part collapse. Remembered per user in a plain object, not SQL. */

/**
 * @param {unknown} items
 * @returns {{ part: string, total: number, count: number }[]}
 */
export function miscPartSubtotals(items) {
	/** @type {Record<string, { part: string, total: number, count: number }>} */
	const groups = {};
	(Array.isArray(items) ? items : []).forEach((item) => {
		const row = item && typeof item === "object" ? /** @type {Record<string, unknown>} */ (item) : {};
		const part = String(row.section || "other");
		const days = row.days == null || row.days === "" ? 1 : Number(row.days) || 0;
		const amount = (Number(row.qty) || 0) * days * (Number(row.unitCost) || 0);
		if (!groups[part]) groups[part] = { part, total: 0, count: 0 };
		groups[part].total += amount;
		groups[part].count += 1;
	});
	return Object.values(groups);
}

/**
 * @param {unknown} store
 * @param {unknown} userId
 * @param {unknown} [part]
 * @param {unknown} [showAll]
 * @returns {Record<string, Record<string, boolean>>}
 */
export function miscShowAllPref(store, userId, part, showAll) {
	const prev = store && typeof store === "object" ? /** @type {Record<string, Record<string, boolean>>} */ (store) : {};
	const key = String(userId || "anon");
	const user = prev[key] && typeof prev[key] === "object" ? prev[key] : {};
	if (showAll == null) return { [key]: { ...user } };
	return { ...prev, [key]: { ...user, [String(part || "*")]: showAll === true } };
}
