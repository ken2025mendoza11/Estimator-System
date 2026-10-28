/** Job order. No prices are stored on the order, the text, or the quantity-only cost estimate. */

import { backupSignatureLabel, normalizeApproverLists } from "./departments.js";
import { formatJobOrderNo } from "./docNumbers.js";

export const RELEASE1_JOB_ORDER_FLAG = "release1JobOrder";

const JO_TYPES = ["SW", "F", "T", "O"];
const KEEP = new Set(["id", "description", "role", "title", "name", "qty", "unit", "days", "section", "uom", "item"]);
const PRICE = /price|rate|cost|amount|subtotal|selling|total|markup|contingency|discount|peso|php/i;

/**
 * @param {unknown} features
 * @returns {boolean}
 */
export function jobOrderFlagOn(features) {
	if (!features || typeof features !== "object") return false;
	return /** @type {{ release1JobOrder?: unknown }} */ (features).release1JobOrder === true;
}

/**
 * @param {string} who
 * @param {string} action
 * @param {string} remarks
 * @param {unknown} now
 */
function entry(who, action, remarks, now) {
	return {
		id: crypto.randomUUID(),
		at: now ? String(now) : new Date().toISOString(),
		who,
		action,
		remarks: remarks || "",
	};
}

/**
 * Drop every price. Keep quantities and names only.
 * @param {unknown} value
 * @returns {unknown}
 */
export function quantityOnly(value) {
	if (Array.isArray(value)) return value.map((item) => quantityOnly(item));
	if (!value || typeof value !== "object") return value;
	/** @type {Record<string, unknown>} */
	const out = {};
	for (const [key, inner] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
		if (PRICE.test(key) || !KEEP.has(key) && (typeof inner === "number" || typeof inner === "string") && key !== "id") {
			if (!KEEP.has(key)) continue;
		}
		if (!KEEP.has(key) && (typeof inner !== "object" || inner == null)) continue;
		out[key] = quantityOnly(inner);
	}
	return out;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function containsPrice(value) {
	const text = JSON.stringify(value ?? "");
	if (/"?(rate|unitCost|unit_cost|amount|price|subtotal|selling|totalAmount|markup)"?\s*:/i.test(text)) return true;
	if (/₱|PHP\s*\d|\d+\.\d{2}/.test(text)) return true;
	return false;
}

/**
 * @param {any} jo
 * @returns {string[]}
 */
export function jobOrderLines(jo) {
	const row = jo || {};
	const rev = Number(row.rev) > 0 ? `REV${String(row.rev).padStart(3, "0")}` : "";
	return [
		"Job order",
		`JO no. ${row.joNo || "—"} ${rev}`.trim(),
		`Date issued ${row.dateIssued || "—"}`,
		`Client ${row.client || "—"}`,
		`PO ref no. ${row.poRef || "—"}`,
		`Project ${row.project || "—"}`,
		`PR ref no. ${row.prNo || "—"}`,
		`Salesperson ${row.salesRepId || ""} ${row.salesPosition || ""}`.trim(),
		`Project in charge ${row.inCharge || ""} ${row.inChargePosition || ""}`.trim(),
		`Client contact ${row.clientContact || ""} ${row.clientContactPosition || ""}`.trim(),
		`Duration ${row.duration || "—"}`,
		`Type ${row.type || "—"}`,
		`Prepared by ${row.salesRepId || ""}`,
		`Checked and approved by ${row.approverId || ""}`,
		row.approverFor ? `Signature ${row.approverFor}` : "Signature",
		`Linked CE ${(row.ceIds || []).join(", ") || "—"}`,
		`PO or NTP ${row.poFileName || "—"}`,
	];
}

/**
 * @param {any} input
 * @returns {{ ok: true, jobOrder: any } | { ok: false, message: string, jobOrder?: undefined }}
 */
export function createJobOrder(input) {
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	const type = String(input?.type || "").trim().toUpperCase();
	if (!JO_TYPES.includes(type)) return { ok: false, message: "Type must be SW, F, T, or O." };
	const ceIds = (Array.isArray(input?.ceIds) ? input.ceIds : []).map((/** @type {unknown} */ id) => String(id || "").trim()).filter(Boolean);
	if (!ceIds.length) return { ok: false, message: "Link at least one cost estimate." };
	const joNo = formatJobOrderNo(input?.seq, type, input?.clientCode, input?.year, input?.controlNo, 0);
	if (!joNo) return { ok: false, message: "The job order number is not complete." };
	const qty = quantityOnly(input?.ceQuantity || []);
	const jobOrder = {
		id: joNo,
		joNo,
		seq: Math.trunc(Number(input.seq)),
		rev: 0,
		type,
		clientCode: String(input.clientCode || "").trim().toUpperCase(),
		year: String(input.year || ""),
		controlNo: String(input.controlNo || ""),
		dateIssued: String(input.dateIssued || input.now || "").slice(0, 10),
		client: String(input.client || ""),
		poRef: String(input.poRef || ""),
		project: String(input.project || ""),
		prNo: String(input.prNo || ""),
		salesRepId: byUserId,
		salesPosition: String(input.salesPosition || ""),
		inCharge: String(input.inCharge || ""),
		inChargePosition: String(input.inChargePosition || ""),
		clientContact: String(input.clientContact || ""),
		clientContactPosition: String(input.clientContactPosition || ""),
		duration: String(input.duration || ""),
		ceIds,
		poFileName: String(input.poFileName || ""),
		drawingNames: (Array.isArray(input.drawingNames) ? input.drawingNames : []).map((/** @type {unknown} */ name) => String(name || "")).filter(Boolean),
		ceQuantity: qty,
		status: "Draft",
		finalApproved: false,
		ownerId: byUserId,
		approverId: "",
		approverFor: "",
		steps: [],
		currentIndex: -1,
		timeline: [entry(byUserId, "Job order created", "", input?.now)],
	};
	return { ok: true, jobOrder };
}

/**
 * @param {any} jo
 * @returns {boolean}
 */
export function jobOrderEditable(jo) {
	return !!jo && (jo.status === "Draft" || jo.status === "Submitted") && jo.finalApproved !== true;
}

/**
 * @param {any} jo
 * @param {any} patch
 * @returns {{ ok: true, jobOrder: any } | { ok: false, message: string, jobOrder?: undefined }}
 */
export function patchJobOrder(jo, patch) {
	if (!jobOrderEditable(jo)) return { ok: false, message: "This job order is locked. Revise it to make a new REV." };
	const src = patch && typeof patch === "object" ? patch : {};
	const next = { ...jo };
	for (const key of ["dateIssued", "client", "poRef", "project", "prNo", "salesPosition", "inCharge", "inChargePosition", "clientContact", "clientContactPosition", "duration", "poFileName"]) {
		if (src[key] != null) next[key] = String(src[key]);
	}
	if (Array.isArray(src.ceIds)) {
		const ceIds = src.ceIds.map((/** @type {unknown} */ id) => String(id || "").trim()).filter(Boolean);
		if (!ceIds.length) return { ok: false, message: "Link at least one cost estimate." };
		next.ceIds = ceIds;
	}
	if (Array.isArray(src.drawingNames)) next.drawingNames = src.drawingNames.map((/** @type {unknown} */ name) => String(name || "")).filter(Boolean);
	next.joNo = jo.joNo;
	next.rev = jo.rev;
	next.id = jo.id;
	next.ceQuantity = jo.ceQuantity;
	return { ok: true, jobOrder: next };
}

/**
 * @param {any} jo
 * @param {{ byUserId?: unknown, approverLists?: unknown, now?: unknown }} input
 * @returns {{ ok: true, jobOrder: any, toUserId: string } | { ok: false, message: string, jobOrder?: undefined, toUserId?: undefined }}
 */
export function submitJobOrder(jo, input) {
	if (!jo || jo.status !== "Draft") return { ok: false, message: "Only a draft can be submitted." };
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId || byUserId !== jo.ownerId) return { ok: false, message: "Only the Sales owner can submit this job order." };
	if (!String(jo.poFileName || "").trim()) return { ok: false, message: "Attach the PO or the NTP." };
	if (!Array.isArray(jo.ceIds) || !jo.ceIds.length) return { ok: false, message: "Link at least one cost estimate." };
	const rows = normalizeApproverLists(input?.approverLists).jobOrder;
	if (!rows.length) return { ok: false, message: "Add a Job order approver in Admin." };
	const steps = rows.map((row, index) => ({
		userId: row.userId,
		backupUserId: row.backupUserId,
		isFinal: index === rows.length - 1,
		decision: "",
		byUserId: "",
		at: "",
		remarks: "",
		forUserId: "",
	}));
	return {
		ok: true,
		toUserId: steps[0].userId,
		jobOrder: {
			...jo,
			status: "Submitted",
			steps,
			currentIndex: 0,
			timeline: [...(jo.timeline || []), entry(byUserId, "Job order submitted", "", input?.now)],
		},
	};
}

/**
 * @param {any} jo
 * @param {unknown} actorId
 * @returns {boolean}
 */
export function actorMayDecideJobOrder(jo, actorId) {
	if (!jo || jo.status !== "Submitted") return false;
	const step = (jo.steps || [])[jo.currentIndex];
	if (!step) return false;
	const actor = String(actorId || "").trim();
	return actor === step.userId || (!!step.backupUserId && actor === step.backupUserId);
}

/**
 * @param {any} jo
 * @param {{ actorId?: unknown, decision?: unknown, remarks?: unknown, now?: unknown, approverName?: unknown }} input
 * @returns {{ ok: true, jobOrder: any, final?: boolean, toUserId?: string, effect?: { award: true, ceIds: string[], proposalControl: string, joNo: string } } | { ok: false, message: string, jobOrder?: undefined }}
 */
export function decideJobOrder(jo, input) {
	if (!jo || jo.status !== "Submitted") return { ok: false, message: "This job order is not waiting for approval." };
	const actorId = String(input?.actorId || "").trim();
	const steps = (jo.steps || []).map((/** @type {any} */ step) => ({ ...step }));
	const index = Number(jo.currentIndex);
	const step = steps[index];
	if (!step) return { ok: false, message: "No approver is assigned." };
	const asPrimary = actorId === step.userId;
	const asBackup = !!step.backupUserId && actorId === step.backupUserId && !asPrimary;
	if (!asPrimary && !asBackup) return { ok: false, message: "This step is for another approver." };
	const decision = input?.decision === "return" ? "return" : input?.decision === "approve" ? "approve" : "";
	if (!decision) return { ok: false, message: "Choose approve or return." };
	const remarks = String(input?.remarks || "").trim();
	if (decision === "return" && !remarks) return { ok: false, message: "A remark is required." };
	const at = input?.now ? String(input.now) : new Date().toISOString();
	const forUserId = asBackup ? step.userId : "";
	const approverFor = forUserId ? backupSignatureLabel(String(input?.approverName || forUserId)) : "";
	const note = [approverFor, remarks].filter(Boolean).join(" ");
	steps[index] = { ...step, decision, byUserId: actorId, at, remarks: note, forUserId };
	const timeline = [...(jo.timeline || []), entry(actorId, decision === "return" ? "Job order returned" : "Job order approved", note, at)];
	if (decision === "return") {
		return { ok: true, jobOrder: { ...jo, status: "Draft", finalApproved: false, steps, timeline } };
	}
	if (index >= steps.length - 1) {
		const jobOrder = { ...jo, status: "Approved", finalApproved: true, approverId: actorId, approverFor, steps, timeline };
		return {
			ok: true,
			final: true,
			jobOrder,
			effect: { award: true, ceIds: jobOrder.ceIds, proposalControl: jobOrder.controlNo, joNo: jobOrder.joNo },
		};
	}
	return {
		ok: true,
		final: false,
		toUserId: steps[index + 1].userId,
		jobOrder: { ...jo, status: "Submitted", steps, currentIndex: index + 1, timeline },
	};
}

/**
 * @param {any} jo
 * @param {{ byUserId?: unknown, remarks?: unknown, now?: unknown }} input
 * @returns {{ ok: true, jobOrder: any, effect?: { clear: true, ceIds: string[], proposalControl: string } } | { ok: false, message: string, jobOrder?: undefined }}
 */
export function cancelJobOrder(jo, input) {
	if (!jo || jo.status === "Cancelled") return { ok: false, message: "This job order is already cancelled." };
	const byUserId = String(input?.byUserId || "").trim();
	const remarks = String(input?.remarks || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	if (!remarks) return { ok: false, message: "A reason is required." };
	const wasAward = jo.status === "Approved";
	const jobOrder = {
		...jo,
		status: "Cancelled",
		timeline: [...(jo.timeline || []), entry(byUserId, "Job order cancelled", remarks, input?.now)],
	};
	return {
		ok: true,
		jobOrder,
		...(wasAward ? { effect: { clear: true, ceIds: jo.ceIds, proposalControl: jo.controlNo } } : {}),
	};
}

/**
 * @param {any} jo
 * @param {{ byUserId?: unknown, now?: unknown }} input
 * @returns {{ ok: true, jobOrder: any } | { ok: false, message: string, jobOrder?: undefined }}
 */
export function reviseJobOrder(jo, input) {
	if (!jo || jo.status !== "Approved") return { ok: false, message: "Revise an approved job order." };
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	const rev = (Number(jo.rev) || 0) + 1;
	const joNo = formatJobOrderNo(jo.seq, jo.type, jo.clientCode, jo.year, jo.controlNo, rev);
	if (!joNo) return { ok: false, message: "The revision number could not be built." };
	return {
		ok: true,
		jobOrder: {
			...jo,
			rev,
			joNo,
			status: "Draft",
			finalApproved: false,
			approverId: "",
			approverFor: "",
			steps: [],
			currentIndex: -1,
			timeline: [...(jo.timeline || []), entry(byUserId, "Job order revised", joNo, input?.now)],
		},
	};
}

/**
 * @param {{ flagOn?: boolean, sales?: boolean, proposalStatus?: unknown, existing?: unknown }} input
 * @returns {boolean}
 */
export function canGenerateJobOrder(input) {
	if (input?.flagOn !== true || input?.sales !== true) return false;
	const status = String(input?.proposalStatus || "");
	if (status !== "Approved" && status !== "Sent") return false;
	return !input.existing;
}
