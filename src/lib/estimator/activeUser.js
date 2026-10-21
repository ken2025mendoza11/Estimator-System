// @ts-nocheck
/** Whether this signed-in id is an active account. Email never counts. */

export function ownAccountStatus(userKey, rows) {
	const key = String(userKey || "").trim();
	if (!key) return null;
	const own = (Array.isArray(rows) ? rows : []).filter((row) => {
		const id = String(row?.user_key || row?.userKey || "").trim();
		return id === key;
	});
	if (!own.length) return null;
	const values = own.map((row) => String(row?.status || "").toLowerCase());
	if (values.includes("active")) return "active";
	if (values.includes("pending")) return "pending";
	if (values.includes("disabled")) return "disabled";
	if (values.includes("declined")) return "declined";
	return "pending";
}

/** True only when this user id has its own active row. */
export function linkedAccountActive(userKey, rows) {
	return ownAccountStatus(userKey, rows) === "active";
}

const ROLE_RANK = { admin: 0, head: 1, lead: 2, staff: 3 };

function ownRows(userKey, rows) {
	const key = String(userKey || "").trim();
	if (!key) return [];
	return (Array.isArray(rows) ? rows : []).filter((row) => String(row?.user_key || row?.userKey || "").trim() === key);
}

/**
 * Role of this user id's own active row. Email never counts.
 * Pending, declined, and duplicate rows have no role.
 */
export function linkedAccountRole(userKey, rows) {
	if (ownAccountStatus(userKey, rows) !== "active") return null;
	let best = null;
	let rank = 99;
	for (const row of ownRows(userKey, rows)) {
		if (String(row?.status || "").toLowerCase() !== "active") continue;
		const role = String(row?.role || "").toLowerCase();
		const next = ROLE_RANK[role];
		if (next == null || next >= rank) continue;
		rank = next;
		best = role;
	}
	return best;
}

/** True only when this user id's own active row is admin. */
export function linkedAccountAdmin(userKey, rows) {
	return linkedAccountRole(userKey, rows) === "admin";
}

