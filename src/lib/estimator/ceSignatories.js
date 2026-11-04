const SLOT_DEFS = [
	{ id: "prepared", label: "Prepared by", name: "preparedBy", title: "preparedTitle", stamp: "preparedStamp" },
	{ id: "checked", label: "Checked by", name: "checkedBy", title: "checkedTitle", stamp: "checkedStamp" },
	{ id: "noted", label: "Noted by", name: "notedBy", title: "notedTitle", stamp: "notedStamp" },
	{ id: "approved", label: "Approved by", name: "approvedBy", title: "approvedTitle", stamp: "approvedStamp" },
	{ id: "reviewed", label: "Reviewed by", name: "reviewedBy", title: "reviewedTitle", stamp: "reviewedStamp" },
	{ id: "checked2", label: "Checked by", name: "checkedBy2", title: "checkedTitle2", stamp: "checkedStamp2" },
	{ id: "concurred", label: "Concurred by", name: "concurredBy", title: "concurredTitle", stamp: "concurredStamp" },
];

const SLOTS = SLOT_DEFS.map((slot) => [slot.name, slot.title]);

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

/**
 * The seven CE slots, names and positions from the route. Pending until a stamp exists.
 * @param {Record<string, unknown>} [record]
 * @param {unknown[]} [steps]
 * @param {unknown[]} [users]
 */
export function signatorySlots(record, steps, users) {
	const filled = routeSignatories(steps, users);
	const form = record && typeof record === "object" ? record : {};
	return SLOT_DEFS.map((slot) => {
		const name = String(form[slot.name] || filled[slot.name] || "");
		const position = String(form[slot.title] || filled[slot.title] || "");
		const pending = signatoryPending(String(form[slot.stamp] || ""));
		return { id: slot.id, label: slot.label, name, position, pending, status: pending ? "Pending" : "Signed" };
	});
}
