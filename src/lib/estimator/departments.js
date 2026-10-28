/** Fixed account departments and approver backups. Flag off keeps the old text match. */

export const RELEASE1_DEPARTMENTS_FLAG = "release1Departments";

export const DEPARTMENTS = ["Sales", "Cost Estimating", "Management", "Admin"];

export const APPROVER_KINDS = ["markup", "proposal", "jobOrder"];

/**
 * Account id only. A display name is never an id.
 * @param {unknown} user
 * @returns {string}
 */
export function accountId(user) {
	if (!user || typeof user !== "object") return "";
	const row = /** @type {Record<string, unknown>} */ (user);
	return String(row.userId || row.user_key || row.userKey || row.id || "").trim();
}

/**
 * The admin-set department, or "" when it is not one of the four.
 * The old free-text `department` field is not this value.
 * @param {unknown} user
 * @returns {string}
 */
export function fixedDepartment(user) {
	if (!user || typeof user !== "object") return "";
	const row = /** @type {Record<string, unknown>} */ (user);
	const raw = String(row.accountDepartment ?? row.account_department ?? "").trim();
	return DEPARTMENTS.includes(raw) ? raw : "";
}

/**
 * @param {unknown} user
 * @returns {string}
 */
function legacyBlob(user) {
	if (!user || typeof user !== "object") return "";
	const row = /** @type {Record<string, unknown>} */ (user);
	return `${row.department || ""} ${row.designation || ""}`;
}

/**
 * @param {unknown} user
 * @param {boolean} [flagOn]
 * @returns {boolean}
 */
export function isSales(user, flagOn) {
	if (!user || typeof user !== "object") return false;
	if (flagOn === true) {
		const fixed = fixedDepartment(user);
		if (fixed) return fixed === "Sales";
	}
	return /sales/i.test(legacyBlob(user));
}

/**
 * Cost Estimating. Same rule as the old costing list when the department is not set.
 * @param {unknown} user
 * @param {boolean} [flagOn]
 * @returns {boolean}
 */
export function isCostEstimating(user, flagOn) {
	if (!user || typeof user !== "object") return false;
	if (flagOn === true) {
		const fixed = fixedDepartment(user);
		if (fixed) return fixed === "Cost Estimating";
	}
	const blob = legacyBlob(user);
	if (/sales/i.test(blob)) return false;
	return /cost/i.test(blob) || /estimat/i.test(blob);
}

/** @param {unknown} user @param {boolean} [flagOn] */
export function isCostApprover(user, flagOn) {
	return isCostEstimating(user, flagOn);
}

/** @param {unknown} user @param {boolean} [flagOn] */
export function isManagement(user, flagOn) {
	return flagOn === true && fixedDepartment(user) === "Management";
}

/** Department Admin, not the admin role. @param {unknown} user @param {boolean} [flagOn] */
export function isAdminDepartment(user, flagOn) {
	return flagOn === true && fixedDepartment(user) === "Admin";
}

/**
 * Find a person by account id. A name is used only while the flag is off.
 * @param {Array<Record<string, unknown>> | null | undefined} users
 * @param {{ userId?: unknown, name?: unknown, flagOn?: boolean }} [query]
 * @returns {Record<string, unknown> | null}
 */
export function findAccount(users, query) {
	const list = Array.isArray(users) ? users : [];
	const wanted = String(query?.userId || "").trim();
	if (wanted) return list.find((user) => accountId(user) === wanted) || null;
	if (query?.flagOn === true) return null;
	const key = String(query?.name || "").trim().toLowerCase();
	if (!key) return null;
	return list.find((user) => {
		if (!user || typeof user !== "object") return false;
		return String(/** @type {Record<string, unknown>} */ (user).name || "").trim().toLowerCase() === key;
	}) || null;
}

/**
 * A backup signs as "for <name>". The name is display only.
 * @param {unknown} name
 * @returns {string}
 */
export function backupSignatureLabel(name) {
	const display = String(name || "").trim();
	return display ? `for ${display}` : "";
}

/**
 * Approvers are account ids. Names are dropped. A backup cannot be the same id.
 * @param {unknown} raw
 */
export function normalizeApproverLists(raw) {
	const src = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
	/** @type {{ markup: { userId: string, backupUserId: string }[], proposal: { userId: string, backupUserId: string }[], jobOrder: { userId: string, backupUserId: string }[] }} */
	const out = { markup: [], proposal: [], jobOrder: [] };
	for (const kind of APPROVER_KINDS) {
		const rows = Array.isArray(src[kind]) ? src[kind] : [];
		const seen = new Set();
		for (const row of rows) {
			if (!row || typeof row !== "object") continue;
			const item = /** @type {Record<string, unknown>} */ (row);
			const userId = String(item.userId || item.accountId || "").trim();
			let backupUserId = String(item.backupUserId || "").trim();
			if (!userId || seen.has(userId)) continue;
			if (backupUserId === userId) backupUserId = "";
			seen.add(userId);
			out[/** @type {"markup" | "proposal" | "jobOrder"} */ (kind)].push({ userId, backupUserId });
		}
	}
	return out;
}

/**
 * @param {unknown} lists
 * @param {string} kind
 * @param {unknown} userId
 * @returns {string}
 */
export function approverBackupId(lists, kind, userId) {
	const clean = normalizeApproverLists(lists);
	const key = APPROVER_KINDS.includes(kind) ? kind : "";
	if (!key) return "";
	const hit = clean[/** @type {"markup" | "proposal" | "jobOrder"} */ (key)].find((row) => row.userId === String(userId || "").trim());
	return hit ? hit.backupUserId : "";
}
