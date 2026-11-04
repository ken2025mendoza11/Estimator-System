import { finalApproverApproved } from "./ceRequest.js";

const STAMPS = ["preparedStamp", "checkedStamp", "notedStamp", "approvedStamp", "reviewedStamp", "checkedStamp2", "concurredStamp"];

/**
 * Withdraw stays open after submit until the final approver signs.
 * Flag off keeps today's screen (no new withdraw).
 * @param {any} ce
 * @param {boolean} [flagOn]
 */
export function ceWithdrawAllowed(ce, flagOn) {
	if (flagOn !== true || !ce) return false;
	if (finalApproverApproved(ce)) return false;
	const status = String(ce.status || ce.ceStatus || "");
	if (status === "Cancelled" || status === "Withdrawn" || status === "Done") return false;
	if (status === "For approval" || String(status).startsWith("Pending ")) return true;
	return ce.approval?.status === "in-progress";
}

/** Revise only after the final signature.
 * @param {any} ce
 */
export function ceReviseOnly(ce) {
	return finalApproverApproved(ce);
}

/**
 * @param {any} ce
 * @param {{ who?: string, remarks?: string, at?: string }} input
 */
export function planCeWithdraw(ce, input) {
	if (!ceWithdrawAllowed(ce, true)) return { ok: false, message: "Withdraw is closed." };
	const remarks = String(input?.remarks || "").trim();
	if (!remarks) return { ok: false, message: "A remark is required." };
	const who = String(input?.who || "").trim();
	if (!who) return { ok: false, message: "An account id is required." };
	const steps = (ce.approval?.steps || []).map((/** @type {any} */ step) => ({
		...step,
		decision: "",
		by: "",
		at: "",
		byUserId: "",
	}));
	const projectInfo = { ...(ce.projectInfo || {}) };
	STAMPS.forEach((key) => {
		projectInfo[key] = "";
	});
	return {
		ok: true,
		status: "Draft",
		approval: ce.approval ? { ...ce.approval, status: "draft", currentIndex: 0, steps } : null,
		projectInfo,
		entry: { who, action: "Withdrawn", remarks, at: input?.at || "" },
		notify: true,
	};
}

/** @param {any} user */
function accountOf(user) {
	if (!user || typeof user !== "object") return "";
	const row = /** @type {Record<string, unknown>} */ (user);
	return String(row.userId || row.user_key || row.userKey || row.id || "").trim();
}

/**
 * Route approvers only. Never the broadcast "*".
 * @param {any} ce
 * @param {any[]} [users]
 */
export function withdrawRecipients(ce, users = []) {
	const steps = [
		...(ce?.approval?.steps || []),
		...(ce?.approval?.flowSnapshot?.steps || []),
	];
	const list = Array.isArray(users) ? users : [];
	/** @type {string[]} */
	const ids = [];
	/** @param {any} value */
	const add = (value) => {
		const id = String(value || "").trim();
		if (!id || id === "*" || ids.includes(id)) return;
		ids.push(id);
	};
	steps.forEach((/** @type {any} */ step) => {
		add(step?.userId);
		add(step?.assigneeUserId);
		add(step?.byUserId);
		const name = String(step?.assigneeName || step?.assignee || step?.by || "").trim().toLowerCase();
		if (!name) return;
		const hit = list.find((user) => String(user?.name || user?.userName || "").trim().toLowerCase() === name);
		add(accountOf(hit));
	});
	return ids;
}
