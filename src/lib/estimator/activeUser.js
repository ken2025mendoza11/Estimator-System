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
