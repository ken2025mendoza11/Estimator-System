/** RCE withdraw until the final approver, and a Sales request for a CE revision or a new CE. Flag off keeps today's withdraw rule. */

import { accountId, findAccount, isCostEstimating, normalizeApproverLists } from "./departments.js";
import { planRevise } from "./approvalEngine.js";

export const RELEASE1_WITHDRAW_REQUEST_FLAG = "release1WithdrawRequest";

const FINAL_DECISION = new Set(["accept", "approve", "approve-comment", "approved"]);
const SUBMITTED = new Set(["Pending", "For approval", "Rejected", "For revision"]);

/**
 * @param {unknown} features
 * @returns {boolean}
 */
export function withdrawRequestOn(features) {
	if (!features || typeof features !== "object") return false;
	return /** @type {{ release1WithdrawRequest?: unknown }} */ (features).release1WithdrawRequest === true;
}

/**
 * Today's rule. A first approval blocks withdraw.
 * @param {any} rce
 * @returns {boolean}
 */
function legacyCanWithdraw(rce) {
	if (!rce) return false;
	const ap = rce.approval;
	if (!ap || ap.status !== "in-progress") return rce.status === "Pending" || rce.status === "For approval";
	if (ap.engine === "v2") return !(ap.steps || []).some((/** @type {any} */ step) => step.decision === "approve" || step.decision === "approve-comment");
	return !(ap.steps || []).some((/** @type {any} */ step, /** @type {number} */ index) => index >= 1 && (step.decision === "accept" || step.decision === "reject"));
}

/**
 * @param {any} rce
 * @returns {boolean}
 */
export function finalApproverApproved(rce) {
	if (!rce) return false;
	if (rce.approval?.status === "accepted") return true;
	const status = String(rce.status || "").toLowerCase();
	if (status === "accepted" || status === "approved") return true;
	const steps = Array.isArray(rce.approval?.steps) ? rce.approval.steps : [];
	if (!steps.length) return false;
	const marked = [...steps].reverse().find((step) => step && step.isFinal);
	const finalStep = marked || steps[steps.length - 1];
	return FINAL_DECISION.has(String(finalStep?.decision || "").toLowerCase());
}

/**
 * Flag off: the first approval blocks withdraw.
 * Flag on: withdraw stays open after submit until the final approver approves.
 * @param {any} rce
 * @param {boolean} [flagOn]
 * @returns {boolean}
 */
export function rceWithdrawAllowed(rce, flagOn) {
	if (flagOn !== true) return legacyCanWithdraw(rce);
	if (!rce) return false;
	const status = String(rce.status || "");
	if (status === "Cancelled" || status === "Withdrawn") return false;
	if (finalApproverApproved(rce)) return false;
	if (SUBMITTED.has(status)) return true;
	const approvalStatus = rce.approval?.status;
	return approvalStatus === "in-progress" || approvalStatus === "rejected";
}

/**
 * @param {{ who?: unknown, remarks?: unknown }} input
 * @returns {{ ok: boolean, message?: string, entry?: { who: string, action: string, remarks: string } }}
 */
export function withdrawLog(input) {
	const remarks = String(input?.remarks || "").trim();
	if (!remarks) return { ok: false, message: "A remark is required." };
	const who = String(input?.who || "").trim();
	if (!who) return { ok: false, message: "An account id is required." };
	return { ok: true, entry: { who, action: "Withdrawn", remarks } };
}

/**
 * The first Cost Estimating account on the approver lists. A Sales account is not used.
 * @param {{ approverLists?: unknown, users?: any[], departmentsOn?: boolean }} input
 * @returns {{ userId: string, backupUserId: string }}
 */
export function costingApproverForRequest(input) {
	const lists = normalizeApproverLists(input?.approverLists);
	const users = Array.isArray(input?.users) ? input.users : [];
	const departmentsOn = input?.departmentsOn === true;
	const kinds = /** @type {const} */ (["markup", "proposal", "jobOrder"]);
	for (const kind of kinds) {
		for (const row of lists[kind]) {
			const user = findAccount(users, { userId: row.userId, flagOn: true });
			if (user && isCostEstimating(user, departmentsOn)) return { userId: row.userId, backupUserId: row.backupUserId || "" };
		}
	}
	const costing = users.find((user) => isCostEstimating(user, departmentsOn) && accountId(user));
	if (costing) return { userId: accountId(costing), backupUserId: "" };
	return { userId: "", backupUserId: "" };
}

/**
 * Sales asks. This does not open the editor.
 * @param {{ kind?: unknown, remark?: unknown, byUserId?: unknown, approver?: { userId?: string, backupUserId?: string }, existing?: { status?: string } }} input
 */
export function planSalesCeRequest(input) {
	const kind = input?.kind === "new" ? "new" : input?.kind === "revision" ? "revision" : "";
	if (!kind) return { ok: false, message: "Pick a revision or a new estimate.", salesMayEdit: false };
	const remark = String(input?.remark || "").trim();
	if (!remark) return { ok: false, message: "A remark is required.", salesMayEdit: false };
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required.", salesMayEdit: false };
	if (input?.existing?.status === "pending") return { ok: false, message: "A request is already waiting for Cost Estimating.", salesMayEdit: false };
	const toUserId = String(input?.approver?.userId || "").trim();
	if (!toUserId) return { ok: false, message: "No Cost Estimating approver is set.", salesMayEdit: false };
	const action = kind === "new" ? "New CE requested" : "CE revision requested";
	return {
		ok: true,
		salesMayEdit: false,
		request: {
			kind,
			status: "pending",
			remark,
			byUserId,
			toUserId,
			backupUserId: String(input?.approver?.backupUserId || "").trim(),
			at: new Date().toISOString()
		},
		entry: { who: byUserId, action, remarks: remark },
		notice: { type: "CE request", title: action, body: remark, toUserId, view: "editor" }
	};
}

/**
 * @param {{ status?: string, toUserId?: string, backupUserId?: string } | null | undefined} request
 * @param {unknown} actorId
 * @returns {boolean}
 */
export function actorMayAcceptCeRequest(request, actorId) {
	const id = String(actorId || "").trim();
	if (!request || request.status !== "pending" || !id) return false;
	return id === String(request.toUserId || "") || (!!request.backupUserId && id === String(request.backupUserId));
}

/**
 * The Cost Estimating approver accepts. The revision then uses the normal revise approval.
 * Sales is never given the editor.
 * @param {{ request?: any, actorId?: unknown, approval?: any, flow?: any, owner?: unknown, now?: string }} input
 */
export function acceptSalesCeRequest(input) {
	const request = input?.request;
	if (!actorMayAcceptCeRequest(request, input?.actorId)) {
		return { ok: false, message: "Only the Cost Estimating approver can take this request.", salesMayEdit: false };
	}
	const actorId = String(input.actorId || "").trim();
	const at = input?.now || new Date().toISOString();
	const nextRequest = { ...request, status: "accepted", acceptedByUserId: actorId, acceptedAt: at };
	const entry = {
		who: actorId,
		action: request.kind === "new" ? "New CE request accepted" : "CE revision request accepted",
		remarks: request.remark || ""
	};
	if (request.kind === "new") return { ok: true, salesMayEdit: false, next: "new-ce", request: nextRequest, entry };
	const planned = planRevise({
		approval: input?.approval || null,
		flow: input?.flow || input?.approval?.flowSnapshot || {},
		owner: input?.owner || "",
		actor: "",
		userId: actorId,
		now: at,
		rev: input?.approval?.rev
	});
	return {
		ok: true,
		salesMayEdit: false,
		next: "revision",
		request: nextRequest,
		entry,
		approval: planned.ok ? planned.approval : null
	};
}
