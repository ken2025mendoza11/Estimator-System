/** Release 1 writes on a locked estimate. Markup is its own record. Award and cancel may change status and the timeline only. */

import { lockedCeChangeAllowed } from "./salesView.js";
import { stableJson } from "./viewOnlySave.js";

const DOC_NOISE = ["timeline", "lastEdited", "lastEditedBy", "schedule", "ceStatus", "status"];
const SUMMARY_NOISE = ["timeline", "lastEdited", "lastEditedBy", "status", "client", "project", "isNew"];

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function rowOf(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};
}

/**
 * @param {unknown} payload
 * @param {"document" | "summary"} side
 * @returns {Record<string, unknown>}
 */
function sideOf(payload, side) {
	return rowOf(rowOf(payload)[side]);
}

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
export function cePayloadLocked(payload) {
	const doc = sideOf(payload, "document");
	const summary = sideOf(payload, "summary");
	const approval = String(rowOf(doc.approval).status || rowOf(summary.approval).status || "").trim().toLowerCase();
	if (approval === "accepted") return true;
	const status = String(summary.status || doc.ceStatus || doc.status || "").trim().toLowerCase();
	return status === "done" || status === "accepted";
}

/**
 * Same status the p34 SQL reads: summary status, then ceStatus, then document status.
 * A blank summary status is blank. It does not fall through.
 * @param {unknown} payload
 * @returns {string}
 */
function awardStatus(payload) {
	const doc = sideOf(payload, "document");
	const summary = sideOf(payload, "summary");
	if (Object.prototype.hasOwnProperty.call(summary, "status") && summary.status != null) {
		return String(summary.status).trim().toLowerCase();
	}
	if (Object.prototype.hasOwnProperty.call(doc, "ceStatus") && doc.ceStatus != null) {
		return String(doc.ceStatus).trim().toLowerCase();
	}
	if (Object.prototype.hasOwnProperty.call(doc, "status") && doc.status != null) {
		return String(doc.status).trim().toLowerCase();
	}
	return String(rowOf(payload).status || "").trim().toLowerCase();
}

/**
 * @param {unknown} value
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
function without(value, keys) {
	const next = { ...rowOf(value) };
	for (const key of keys) delete next[key];
	return next;
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
function coreText(payload) {
	const doc = without(sideOf(payload, "document"), DOC_NOISE);
	if (doc.projectInfo && typeof doc.projectInfo === "object" && !Array.isArray(doc.projectInfo)) {
		const info = { ...rowOf(doc.projectInfo) };
		delete info.revisionPending;
		delete info.revisionNote;
		doc.projectInfo = info;
	}
	return stableJson({
		summary: without(sideOf(payload, "summary"), SUMMARY_NOISE),
		document: doc,
	});
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
function sqlStatus(payload) {
	const doc = sideOf(payload, "document");
	const summary = sideOf(payload, "summary");
	const summaryStatus = String(summary.status ?? "").trim();
	if (summary.status != null && summaryStatus) return summaryStatus.toLowerCase();
	if (summary.status != null && String(summary.status) === "") return "";
	const ceStatus = String(doc.ceStatus ?? "").trim();
	if (doc.ceStatus != null && String(doc.ceStatus) !== "") return ceStatus.toLowerCase();
	return String(rowOf(payload).status || "").trim().toLowerCase();
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
function sqlApproval(payload) {
	const doc = sideOf(payload, "document");
	const summary = sideOf(payload, "summary");
	const top = rowOf(payload);
	const first = rowOf(doc.approval).status;
	if (first != null && String(first) !== "") return String(first).trim().toLowerCase();
	const second = rowOf(summary.approval).status;
	if (second != null && String(second) !== "") return String(second).trim().toLowerCase();
	return String(rowOf(top.approval).status || "").trim().toLowerCase();
}

/**
 * @param {unknown} payload
 * @returns {number}
 */
function timelineCount(payload) {
	const doc = sideOf(payload, "document").timeline;
	const summary = sideOf(payload, "summary").timeline;
	return (Array.isArray(doc) ? doc.length : 0) + (Array.isArray(summary) ? summary.length : 0);
}

/**
 * @param {unknown} payload
 * @returns {Record<string, unknown> | null}
 */
function newestTimeline(payload) {
	const doc = sideOf(payload, "document").timeline;
	const summary = sideOf(payload, "summary").timeline;
	const list = Array.isArray(doc) && doc.length ? doc : Array.isArray(summary) ? summary : [];
	const last = list[list.length - 1];
	return last && typeof last === "object" ? rowOf(last) : null;
}

/**
 * Award or cancel, or an empty string when the change is something else.
 * Markup, award status, and the JO link are not stripped, so writing them onto the CE is refused.
 * @param {unknown} oldPayload
 * @param {unknown} newPayload
 * @returns {"award" | "cancel" | ""}
 */
export function ceAwardOrCancel(oldPayload, newPayload) {
	if (!cePayloadLocked(oldPayload)) return "";
	if (coreText(oldPayload) !== coreText(newPayload)) return "";
	if (timelineCount(newPayload) !== timelineCount(oldPayload) + 1) return "";
	const entry = newestTimeline(newPayload);
	if (!entry || !String(entry.who || "").trim() || !String(entry.at || "").trim()) return "";
	const prev = awardStatus(oldPayload);
	const next = awardStatus(newPayload);
	if ((prev === "done" || prev === "accepted") && next === "awarded") return "award";
	if (prev === "awarded" && (next === "done" || next === "accepted")) return "cancel";
	return "";
}

/**
 * Award is allowed only when an approved job order links this estimate.
 * Cancel is allowed only when that job order is cancelled.
 * @param {unknown} move
 * @param {unknown} ceId
 * @param {unknown} jobOrders
 * @returns {boolean}
 */
export function jobOrderAllowsAward(move, ceId, jobOrders) {
	const id = String(ceId || "");
	const wanted = move === "award" ? "approved" : move === "cancel" ? "cancelled" : "";
	if (!id || !wanted) return false;
	return (Array.isArray(jobOrders) ? jobOrders : []).some((/** @type {unknown} */ jo) => {
		const row = rowOf(jo);
		const ids = Array.isArray(row.ceIds) ? row.ceIds.map((/** @type {unknown} */ item) => String(item || "")) : [];
		return ids.includes(id) && String(row.status || "").trim().toLowerCase() === wanted;
	});
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
function ceIdOf(payload) {
	const summary = sideOf(payload, "summary");
	const doc = sideOf(payload, "document");
	return String(summary.id || doc.id || rowOf(payload).id || "");
}

/**
 * @param {{ kind?: unknown, oldPayload?: unknown, newPayload?: unknown, sales?: boolean, jobOrders?: unknown }} input
 * @returns {{ ok: true, reason: string } | { ok: false, reason?: undefined, message: string }}
 */
export function release1WriteAllowed(input) {
	const kind = String(input?.kind || "");
	if (kind === "markup") {
		const next = rowOf(input?.newPayload);
		const status = String(next.status || "");
		if (status === "Approved" || status === "Returned") return { ok: true, reason: "markup-approval" };
		return { ok: true, reason: "markup-save" };
	}
	if (kind !== "ce") return { ok: true, reason: "other" };
	if (stableJson(input?.oldPayload) === stableJson(input?.newPayload)) return { ok: true, reason: "same" };
	if (sqlStatus(input?.newPayload) === "done" && sqlApproval(input?.newPayload) !== "accepted") {
		return { ok: false, message: "Done is only available after the approval is accepted." };
	}
	if (!cePayloadLocked(input?.oldPayload)) return { ok: true, reason: "open" };
	const move = ceAwardOrCancel(input?.oldPayload, input?.newPayload);
	if (move) {
		const ceId = ceIdOf(input?.oldPayload) || ceIdOf(input?.newPayload);
		if (!jobOrderAllowsAward(move, ceId, input?.jobOrders)) {
			return {
				ok: false,
				message: move === "award"
					? "Award needs an approved job order for this estimate."
					: "Cancel needs a cancelled job order for this estimate.",
			};
		}
		return { ok: true, reason: move };
	}
	if (lockedCeChangeAllowed(input?.oldPayload, input?.newPayload, { sales: input?.sales === true })) return { ok: true, reason: "revision" };
	return { ok: false, message: "Approved estimates cannot be changed." };
}
