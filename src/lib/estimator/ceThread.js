/** In-app CE thread. Stored on the workspace until the SQL migration is applied. */

/**
 * @param {string[]} ids
 * @param {unknown} value
 */
function addId(ids, value) {
	const id = String(value || "").trim();
	if (id && !ids.includes(id)) ids.push(id);
}

/**
 * Assignee, the Estimating Lead or Head, the Sales owner, approvers, and admins.
 * A Lead or Head in another department is not added.
 * @param {any} input
 * @param {unknown[]} [users]
 */
export function threadParticipants(input, users) {
	/** @type {string[]} */
	const ids = [];
	const ce = input || {};
	addId(ids, ce.assigneeId);
	addId(ids, ce.assignedToId);
	addId(ids, ce.leadId);
	addId(ids, ce.estimatingLeadId);
	(ce.leadIds || []).forEach((/** @type {any} */ id) => addId(ids, id));
	addId(ids, ce.salesOwnerId);
	(ce.approverIds || []).forEach((/** @type {any} */ id) => addId(ids, id));
	(ce.approvers || []).forEach((/** @type {any} */ step) => addId(ids, typeof step === "string" ? step : step?.userId || step?.id));
	(ce.approval?.steps || []).forEach((/** @type {any} */ step) => addId(ids, step?.userId || step?.id));
	(ce.adminIds || []).forEach((/** @type {any} */ id) => addId(ids, id));
	(Array.isArray(users) ? users : []).forEach((/** @type {any} */ user) => {
		const role = String(user?.level || user?.role || user?.position || "").toLowerCase();
		const dept = String(user?.accountDepartment || user?.account_department || user?.department || "").trim().toLowerCase();
		const id = user?.userId || user?.id || "";
		const estimating = dept === "estimating" || dept === "cost estimating";
		const leadOrHead = role === "lead" || role === "head" || role.includes("estimating lead");
		if (leadOrHead && estimating) addId(ids, id);
		if (role === "admin") addId(ids, id);
	});
	return ids;
}

/**
 * @param {unknown} userId
 * @param {unknown[]} participants
 */
export function threadVisible(userId, participants) {
	const id = String(userId || "");
	return (participants || []).map((/** @type {any} */ row) => String(row || "")).includes(id);
}

/**
 * @param {any} thread
 * @param {{ from?: unknown, text?: unknown, now?: unknown, ce?: any, users?: unknown[] }} input
 */
export function postMessage(thread, input) {
	const from = String(input?.from || "");
	const text = String(input?.text || "").trim();
	if (!from || !text) return { ok: false, message: "A message needs an author and text." };
	const participants = input?.ce ? threadParticipants(input.ce, input.users) : (thread?.participants || []).map((/** @type {any} */ row) => String(row || "")).filter(Boolean);
	if (!threadVisible(from, participants)) return { ok: false, message: "Only participants can post." };
	const message = { id: `${from}-${thread?.messages?.length || 0}`, from, text, at: String(input?.now || "") };
	const next = { ...(thread || {}), participants, messages: [...(thread?.messages || []), message] };
	return { ok: true, thread: next, notices: replyNotices(next, from, input?.now) };
}

/**
 * One notice per other participant. Never broadcast to everyone.
 * @param {any} thread
 * @param {unknown} from
 * @param {unknown} now
 */
export function replyNotices(thread, from, now) {
	const author = String(from || "");
	return (thread?.participants || []).map((/** @type {any} */ row) => String(row || "")).filter((/** @type {any} */ id) => id && id !== "*" && id !== author).map((/** @type {any} */ toUserId) => ({
		toUserId,
		read: false,
		kind: "reply",
		title: "Reply",
		at: String(now || ""),
	}));
}

/**
 * @param {any} thread
 * @param {unknown} userId
 */
export function unreadCount(thread, userId) {
	const id = String(userId || "");
	const seen = String(thread?.seen?.[id] || "");
	return (thread?.messages || []).filter((/** @type {any} */ row) => row.from !== id && String(row.at || "") > seen).length;
}

/**
 * @param {any} thread
 * @param {unknown} userId
 * @param {unknown} now
 */
export function markThreadRead(thread, userId, now) {
	const id = String(userId || "");
	return { ...(thread || {}), seen: { ...(thread?.seen || {}), [id]: String(now || "") } };
}
