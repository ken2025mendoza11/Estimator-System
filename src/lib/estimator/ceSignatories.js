const SLOTS = [
	["preparedBy", "preparedTitle"],
	["checkedBy", "checkedTitle"],
	["notedBy", "notedTitle"],
	["approvedBy", "approvedTitle"],
	["reviewedBy", "reviewedTitle"],
	["checkedBy2", "checkedTitle2"],
	["concurredBy", "concurredTitle"],
];

/**
 * Names and positions for the 7 CE signatory slots, from the approval route.
 * Does not copy a signature or a stamp.
 * @param {unknown[]} steps
 * @param {unknown[]} [users]
 */
export function routeSignatories(steps, users = []) {
	const list = Array.isArray(users) ? users : [];
	/** @type {Record<string, string>} */
	const out = {};
	SLOTS.forEach(([nameKey, titleKey], index) => {
		const step = /** @type {{ assigneeName?: string, userName?: string, assignee?: string, userId?: string, position?: string, title?: string } | undefined} */ ((Array.isArray(steps) ? steps : [])[index]);
		const named = step?.assigneeName || step?.userName || step?.assignee || "";
		const user = list.find((row) => {
			const person = /** @type {{ userId?: string, id?: string, name?: string, position?: string, title?: string }} */ (row);
			return person.userId === step?.userId || person.id === step?.userId || (named && person.name === named);
		});
		const person = /** @type {{ name?: string, position?: string, title?: string }} */ (user || {});
		out[nameKey] = String(named || person.name || "");
		out[titleKey] = String(step?.position || person.position || person.title || step?.title || "");
	});
	return out;
}

/** @param {Record<string, string>} projectInfo @param {unknown[]} steps @param {unknown[]} [users] */
export function applyRouteSignatories(projectInfo, steps, users) {
	const filled = routeSignatories(steps, users);
	const next = { ...(projectInfo || {}) };
	Object.entries(filled).forEach(([key, value]) => {
		if (value && !next[key]) next[key] = value;
	});
	return next;
}

/** @param {string} [stamp] */
export function signatoryPending(stamp) {
	return !String(stamp || "").trim();
}
