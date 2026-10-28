/** Sales list, pending approvals, dashboard figures, and the 12-hour escalation. */

import { holderId } from "./monitoringFamilies.js";
import { escalationDue } from "./reminders.js";
import { speedDays, winRate } from "./reports.js";
import { accountId } from "./departments.js";

export const RELEASE1_MONITOR_FLAG = "release1Monitor";
export const ESCALATE_HOURS = 12;

/**
 * @param {unknown} features
 * @returns {boolean}
 */
export function monitorFlagOn(features) {
	if (!features || typeof features !== "object") return false;
	return /** @type {{ release1Monitor?: unknown }} */ (features).release1Monitor === true;
}

/**
 * @param {unknown} from
 * @param {unknown} now
 * @returns {number}
 */
export function hoursSince(from, now) {
	const start = Date.parse(String(from || ""));
	const end = Date.parse(String(now || ""));
	if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
	return (end - start) / 36e5;
}

/**
 * @param {unknown} from
 * @param {unknown} now
 * @returns {number}
 */
export function ageDays(from, now) {
	return Math.max(0, Math.floor(hoursSince(from, now) / 24));
}

/**
 * @param {any} row
 * @returns {string}
 */
function waitingSince(row) {
	const steps = row?.steps || [];
	const step = steps[Number(row?.currentIndex) || 0] || {};
	if (step.since) return String(step.since);
	if (row?.waitingSince) return String(row.waitingSince);
	const timeline = Array.isArray(row?.timeline) ? row.timeline : [];
	const last = timeline.length ? timeline[timeline.length - 1]?.at : "";
	return String(last || row?.prDate || row?.dateIssued || "");
}

/**
 * @param {{ proposals?: any[], jobOrders?: any[], now?: unknown }} input
 */
export function salesWorklist(input) {
	const now = input?.now;
	/** @type {{ kind: string, id: string, status: string, ageDays: number, holderId: string, ownerId: string }[]} */
	const rows = [];
	(input?.proposals || []).forEach((row) => {
		rows.push({
			kind: "proposal",
			id: String(row.controlNo || row.id || ""),
			status: String(row.status || ""),
			ageDays: ageDays(row.prDate || row.timeline?.[0]?.at, now),
			holderId: holderId(row) || String(row.ownerId || ""),
			ownerId: String(row.ownerId || ""),
		});
	});
	(input?.jobOrders || []).forEach((row) => {
		rows.push({
			kind: "jobOrder",
			id: String(row.joNo || row.id || ""),
			status: String(row.status || ""),
			ageDays: ageDays(row.dateIssued || row.timeline?.[0]?.at, now),
			holderId: holderId(row) || String(row.ownerId || ""),
			ownerId: String(row.ownerId || ""),
		});
	});
	return rows;
}

/**
 * @param {any[]} docs
 * @param {unknown} now
 */
export function pendingApprovals(docs, now) {
	return (docs || []).filter((row) => row && (row.status === "Submitted" || row.status === "For approval")).map((row) => {
		const hours = hoursSince(waitingSince(row), now);
		return {
			kind: String(row.kind || ""),
			id: String(row.controlNo || row.joNo || row.id || ""),
			holderId: holderId(row),
			hours: Math.round(hours * 10) / 10,
			overdue: escalationDue(waitingSince(row), now, ESCALATE_HOURS),
		};
	});
}

/**
 * @param {{ proposals?: any[], ces?: any[], now?: unknown }} input
 */
export function monitorDashboard(input) {
	const ces = input?.ces || [];
	const win = winRate(ces.map((row) => ({
		awardStatus: row.awardStatus || (String(row.status || "") === "Awarded" ? "Awarded" : ""),
	})));
	const turnaround = speedDays(ces.map((row) => ({
		received: row.received || row.dateReceived || "",
		done: row.status === "Done" || row.status === "Awarded" ? (row.done || row.lastEdited || "") : "",
	})));
	/** @type {Record<string, { salesRepId: string, count: number, oldestDays: number }>} */
	const aging = {};
	(input?.proposals || []).forEach((row) => {
		const salesRepId = String(row.salesRepId || row.ownerId || "");
		if (!aging[salesRepId]) aging[salesRepId] = { salesRepId, count: 0, oldestDays: 0 };
		aging[salesRepId].count += 1;
		aging[salesRepId].oldestDays = Math.max(aging[salesRepId].oldestDays, ageDays(row.prDate || row.timeline?.[0]?.at, input?.now));
	});
	return { winRate: win, ceTurnaroundDays: turnaround, proposalAging: Object.values(aging) };
}

/**
 * @param {any[]} proposals
 * @param {unknown} now
 * @param {number} [withinDays]
 */
export function expiringProposals(proposals, now, withinDays = 7) {
	return (proposals || []).filter((row) => {
		if (!row || (row.status !== "Approved" && row.status !== "Sent") || !row.validUntil) return false;
		const left = hoursSince(now, row.validUntil) / 24;
		return left <= withinDays;
	}).map((row) => ({
		id: String(row.controlNo || row.id || ""),
		toUserId: String(row.ownerId || row.salesRepId || ""),
		notice: "Proposal expiring",
	}));
}

/**
 * Move a waiting step to its backup, or to the next step, after 12 hours.
 * @param {any} doc
 * @param {unknown} now
 * @param {number} [hours]
 * @returns {{ ok: true, doc: any, toUserId: string, notice: string } | { ok: false, doc: any, message?: string }}
 */
export function escalateWaiting(doc, now, hours = ESCALATE_HOURS) {
	if (!doc || (doc.status !== "Submitted" && doc.status !== "For approval")) return { ok: false, doc, message: "Not waiting." };
	const index = Number(doc.currentIndex) || 0;
	const steps = (doc.steps || []).map((/** @type {any} */ step) => ({ ...step }));
	const step = steps[index];
	if (!step) return { ok: false, doc, message: "No approver is assigned." };
	const since = waitingSince(doc);
	if (!escalationDue(since, now, hours)) return { ok: false, doc, message: "Not due." };
	if (step.escalated) return { ok: false, doc, message: "Already escalated." };
	const at = String(now || "");
	if (step.backupUserId && !step.usedBackup) {
		steps[index] = { ...step, usedBackup: true, escalated: true, since: at };
		const timeline = [...(doc.timeline || []), { id: crypto.randomUUID(), at, who: step.userId || "", action: "Escalated", remarks: step.backupUserId }];
		return { ok: true, doc: { ...doc, steps, timeline }, toUserId: String(step.backupUserId), notice: "Escalated" };
	}
	if (index < steps.length - 1) {
		steps[index] = { ...step, decision: "escalated", escalated: true, byUserId: step.userId || "" };
		const next = steps[index + 1];
		next.since = at;
		const timeline = [...(doc.timeline || []), { id: crypto.randomUUID(), at, who: step.userId || "", action: "Escalated", remarks: next.userId || "" }];
		return { ok: true, doc: { ...doc, steps, currentIndex: index + 1, timeline }, toUserId: String(next.userId || ""), notice: "Escalated" };
	}
	return { ok: false, doc, message: "No backup or next level." };
}

/**
 * @param {any[]} docs
 * @param {unknown} now
 * @returns {{ ok: true, doc: any, toUserId: string, notice: string }[]}
 */
export function runEscalation(docs, now) {
	/** @type {{ ok: true, doc: any, toUserId: string, notice: string }[]} */
	const done = [];
	(docs || []).forEach((doc) => {
		const result = escalateWaiting(doc, now);
		if (result.ok) done.push(result);
	});
	return done;
}

/** Drop fields that were only added so the server route could tell documents apart.
 * @param {any} doc
 */
export function escalationDoc(doc) {
	if (!doc || typeof doc !== "object") return doc;
	const next = { ...doc };
	delete next.kind;
	delete next.mailTo;
	return next;
}

/**
 * The address for a server email. An account id is never sent as the address.
 * @param {unknown} toUserId
 * @param {unknown[]} users
 * @param {unknown} subject
 * @param {unknown} text
 * @returns {{ to: string, subject: string, text: string } | null}
 */
export function release1MailRequest(toUserId, users, subject, text) {
	const id = String(toUserId || "").trim();
	let email = id.includes("@") ? id : "";
	if (!email) {
		const hit = (Array.isArray(users) ? users : []).find((user) => accountId(user) === id);
		email = String(hit && typeof hit === "object" ? /** @type {{ email?: unknown }} */ (hit).email || "" : "");
	}
	if (!email.includes("@")) return null;
	return { to: email, subject: String(subject || ""), text: String(text || "") };
}

/**
 * Another Sales account can take an approved document.
 * @param {{ doc: any, actorId?: unknown, sales?: boolean, now?: unknown }} input
 */
export function takeOverApproved(input) {
	const doc = input?.doc;
	if (!doc || (doc.status !== "Approved" && doc.status !== "Sent")) return { ok: false, message: "Take over an approved document." };
	if (input?.sales !== true) return { ok: false, message: "Sales can take this over." };
	const actorId = String(input?.actorId || "").trim();
	if (!actorId || actorId === String(doc.ownerId || "")) return { ok: false, message: "Another Sales account can take this over." };
	return {
		ok: true,
		doc: {
			...doc,
			ownerId: actorId,
			timeline: [...(doc.timeline || []), { id: crypto.randomUUID(), at: String(input?.now || ""), who: actorId, action: "Taken over", remarks: "" }],
		},
	};
}

/**
 * @param {{ doc: any, actorId?: unknown, toUserId?: unknown, authorized?: boolean, now?: unknown }} input
 */
export function reassignDoc(input) {
	if (input?.authorized !== true) return { ok: false, message: "Only an authorised user can reassign." };
	const actorId = String(input?.actorId || "").trim();
	const toUserId = String(input?.toUserId || "").trim();
	if (!actorId || !toUserId) return { ok: false, message: "Choose an account." };
	return {
		ok: true,
		doc: {
			...input.doc,
			ownerId: toUserId,
			timeline: [...(input.doc?.timeline || []), { id: crypto.randomUUID(), at: String(input?.now || ""), who: actorId, action: "Reassigned", remarks: toUserId }],
		},
	};
}
