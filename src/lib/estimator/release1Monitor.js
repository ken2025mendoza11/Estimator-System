/** Sales list, pending approvals, dashboard figures, and the 12-hour escalation. */

import { holderId } from "./monitoringFamilies.js";
import { escalationDue } from "./reminders.js";
import { speedDays, winRate } from "./reports.js";
import { matrixAllows } from "./notifyMatrix.js";
import { accountId, personName } from "./departments.js";

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
 * @param {{ proposals?: any[], jobOrders?: any[], now?: unknown, users?: unknown[] }} input
 */
export function salesWorklist(input) {
	const now = input?.now;
	/** @type {{ kind: string, id: string, status: string, ageDays: number, holderId: string, holderName: string, ownerId: string, ownerName: string }[]} */
	const rows = [];
	(input?.proposals || []).forEach((row) => {
		const holder = holderId(row) || String(row.ownerId || "");
		rows.push({
			kind: "proposal",
			id: String(row.controlNo || row.id || ""),
			status: String(row.status || ""),
			ageDays: ageDays(row.prDate || row.timeline?.[0]?.at, now),
			holderId: holder,
			holderName: personName(holder, input?.users),
			ownerId: String(row.ownerId || ""),
			ownerName: personName(row.ownerId, input?.users),
		});
	});
	(input?.jobOrders || []).forEach((row) => {
		const holder = holderId(row) || String(row.ownerId || "");
		rows.push({
			kind: "jobOrder",
			id: String(row.joNo || row.id || ""),
			status: String(row.status || ""),
			ageDays: ageDays(row.dateIssued || row.timeline?.[0]?.at, now),
			holderId: holder,
			holderName: personName(holder, input?.users),
			ownerId: String(row.ownerId || ""),
			ownerName: personName(row.ownerId, input?.users),
		});
	});
	return rows;
}

/**
 * @param {any[]} docs
 * @param {unknown} now
 * @param {unknown[] | null | undefined} [users]
 */
export function pendingApprovals(docs, now, users) {
	return (docs || []).filter((row) => row && (row.status === "Submitted" || row.status === "For approval")).map((row) => {
		const hours = hoursSince(waitingSince(row), now);
		const holder = holderId(row);
		return {
			kind: String(row.kind || ""),
			id: String(row.controlNo || row.joNo || row.id || ""),
			holderId: holder,
			holderName: personName(holder, users),
			hours: Math.round(hours * 10) / 10,
			overdue: escalationDue(waitingSince(row), now, ESCALATE_HOURS),
		};
	});
}

/**
 * @param {{ proposals?: any[], ces?: any[], now?: unknown, users?: unknown[] }} input
 */
export function monitorDashboard(input) {
	const ces = input?.ces || [];
	const users = input?.users;
	const win = winRate(ces.map((row) => ({
		awardStatus: row.awardStatus || (String(row.status || "") === "Awarded" ? "Awarded" : ""),
	})));
	const turnaround = speedDays(ces.map((row) => ({
		received: row.received || row.dateReceived || "",
		done: row.status === "Done" || row.status === "Awarded" ? (row.done || row.lastEdited || "") : "",
	})));
	/** @type {Record<string, { salesRepId: string, salesRepName: string, ces: any[], proposals: any[] }>} */
	const buckets = {};
	const bucket = (/** @type {unknown} */ id) => {
		const salesRepId = String(id || "");
		if (!buckets[salesRepId]) buckets[salesRepId] = { salesRepId, salesRepName: personName(salesRepId, users), ces: [], proposals: [] };
		return buckets[salesRepId];
	};
	ces.forEach((row) => bucket(row.salesRepId || row.salesOwnerId || row.ownerId).ces.push(row));
	(input?.proposals || []).forEach((row) => bucket(row.salesRepId || row.ownerId).proposals.push(row));
	const bySalesRep = Object.values(buckets).map((group) => {
		const aging = group.proposals.reduce((oldest, row) => Math.max(oldest, ageDays(row.prDate || row.timeline?.[0]?.at, input?.now)), 0);
		const ceRows = group.ces.map((row) => ({
			awardStatus: row.awardStatus || (String(row.status || "") === "Awarded" ? "Awarded" : ""),
		}));
		const proposalRows = group.proposals.flatMap((row) => {
			const status = String(row.status || "");
			if (status === "Won") return [{ awardStatus: "Awarded" }];
			if (status === "Lost") return [{ awardStatus: "Lost" }];
			return [];
		});
		return {
			salesRepId: group.salesRepId,
			salesRepName: group.salesRepName,
			winRate: winRate([...ceRows, ...proposalRows]),
			ceTurnaroundDays: speedDays(group.ces.map((row) => ({
				received: row.received || row.dateReceived || "",
				done: row.status === "Done" || row.status === "Awarded" ? (row.done || row.lastEdited || "") : "",
			}))),
			proposalCount: group.proposals.length,
			oldestDays: aging,
		};
	});
	/** @type {Record<string, { salesRepId: string, salesRepName: string, count: number, oldestDays: number }>} */
	const aging = {};
	(input?.proposals || []).forEach((row) => {
		const salesRepId = String(row.salesRepId || row.ownerId || "");
		if (!aging[salesRepId]) aging[salesRepId] = { salesRepId, salesRepName: personName(salesRepId, users), count: 0, oldestDays: 0 };
		aging[salesRepId].count += 1;
		aging[salesRepId].oldestDays = Math.max(aging[salesRepId].oldestDays, ageDays(row.prDate || row.timeline?.[0]?.at, input?.now));
	});
	return { winRate: win, ceTurnaroundDays: turnaround, proposalAging: Object.values(aging), bySalesRep };
}

/**
 * @param {any[]} proposals
 * @param {unknown} now
 * @param {number} [withinDays]
 */
export function expiringProposals(proposals, now, withinDays = 7) {
	const end = Date.parse(String(now || ""));
	return (proposals || []).filter((row) => {
		if (!row || row.expiryNotified === true || !row.validUntil) return false;
		if (row.status === "Expired" || row.status === "Won" || row.status === "Lost" || row.status === "Cancelled") return false;
		if (row.status !== "Approved" && row.status !== "Sent") return false;
		const until = Date.parse(String(row.validUntil));
		if (!Number.isFinite(until) || !Number.isFinite(end) || until < end) return false;
		const left = (until - end) / 86400000;
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
	const keys = Array.isArray(step.escalateKeys) ? step.escalateKeys.map((/** @type {unknown} */ key) => String(key)) : [];
	const at = String(now || "");
	if (step.backupUserId && !step.usedBackup) {
		const key = `backup:${index}`;
		if (keys.includes(key)) return { ok: false, doc, message: "Already escalated." };
		steps[index] = { ...step, usedBackup: true, since: at, escalateKeys: [...keys, key] };
		const timeline = [...(doc.timeline || []), { id: crypto.randomUUID(), at, who: step.userId || "", action: "Escalated", remarks: step.backupUserId }];
		return { ok: true, doc: { ...doc, steps, timeline }, toUserId: String(step.backupUserId), notice: "Escalated" };
	}
	if (index < steps.length - 1) {
		const key = `next:${index}`;
		if (keys.includes(key)) return { ok: false, doc, message: "Already escalated." };
		steps[index] = { ...step, decision: "escalated", byUserId: step.userId || "", escalateKeys: [...keys, key] };
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
	let email = "";
	const hit = (Array.isArray(users) ? users : []).find((user) => accountId(user) === id || String(/** @type {{ email?: unknown }} */ (user)?.email || "") === id);
	email = String(hit && typeof hit === "object" ? /** @type {{ email?: unknown }} */ (hit).email || "" : "");
	if (!email.includes("@")) return null;
	return { to: email, subject: String(subject || ""), text: String(text || "") };
}

/**
 * Read the stored documents, escalate each waiting step once, and skip proposals that are already expired.
 * A backup can be escalated again 12 hours later.
 * @param {{ markups?: any[], proposals?: any[], jobOrders?: any[] }} documents
 * @param {unknown} now
 */
export function runServerEscalation(documents, now) {
	const source = documents || {};
	/** @type {{ kind: string, doc: any, toUserId: string, notice: string, template: string }[]} */
	const notices = [];
	/** @type {any[]} */
	const markups = [];
	/** @type {any[]} */
	const proposals = [];
	/** @type {any[]} */
	const jobOrders = [];
	const take = (/** @type {any} */ doc, /** @type {string} */ kind, /** @type {any[]} */ into) => {
		if (!doc) return;
		if (kind === "proposal" && (doc.status === "Expired" || (doc.validUntil && Date.parse(String(doc.validUntil)) < Date.parse(String(now || ""))))) {
			into.push(doc);
			return;
		}
		const result = escalateWaiting(doc, now);
		if (!result.ok) {
			into.push(doc);
			return;
		}
		const stored = escalationDoc(result.doc);
		into.push(stored);
		notices.push({ kind, doc: stored, toUserId: result.toUserId, notice: result.notice, template: "escalated" });
	};
	(source.markups || []).forEach((doc) => take(doc, "markup", markups));
	(source.proposals || []).forEach((doc) => {
		if (doc && doc.status !== "Expired" && doc.expiryNotified !== true && (doc.status === "Approved" || doc.status === "Sent")) {
			const due = expiringProposals([doc], now);
			if (due.length) {
				const at = String(now || "");
				const who = String(due[0].toUserId || doc.ownerId || "");
				proposals.push({
					...doc,
					expiryNotified: true,
					timeline: [...(doc.timeline || []), { id: crypto.randomUUID(), at, who, action: "Proposal expiring", remarks: "" }],
				});
				notices.push({ kind: "proposal", doc, toUserId: due[0].toUserId, notice: due[0].notice, template: "expiring" });
				return;
			}
		}
		take(doc, "proposal", proposals);
	});
	(source.jobOrders || []).forEach((doc) => take(doc, "jobOrder", jobOrders));
	return { documents: { markups, proposals, jobOrders }, notices };
}

/**
 * The in-app notice that phase 33 showed for an escalation or an expiring proposal.
 * @param {any} alert
 * @param {unknown} now
 */
export function inAppNoticeFromAlert(alert, now) {
	const template = String(alert?.template || "");
	const type = template === "expiring" ? "Proposal expiring" : template === "escalated" ? "Escalated" : "";
	const toUserId = String(alert?.toUserId || "").trim();
	if (!type || !toUserId) return null;
	const doc = alert?.doc || {};
	const label = String(doc.controlNo || doc.joNo || doc.ceId || doc.id || "");
	return {
		id: crypto.randomUUID(),
		at: String(now || ""),
		read: false,
		type,
		title: type,
		body: label,
		to: "*",
		toRole: "",
		rceId: "",
		ceId: String(doc.ceId || ""),
		view: "editor",
		toUserId,
	};
}

/**
 * Add the in-app notices. A turned-off matrix row is skipped. The list stays on the notifications record.
 * @param {unknown} existing
 * @param {any[]} alerts
 * @param {unknown} now
 * @param {unknown} matrix
 */
export function appendInAppNotices(existing, alerts, now, matrix) {
	let list = Array.isArray(existing) ? existing.slice() : [];
	for (const alert of alerts || []) {
		const notice = inAppNoticeFromAlert(alert, now);
		if (!notice || !matrixAllows(matrix, notice.type)) continue;
		list = [notice, ...list].slice(0, 80);
	}
	return list;
}

/**
 * Mail only the documents whose save succeeded.
 * @param {any[]} notices
 * @param {{ failed?: { id?: string }[] } | null | undefined} saveResult
 */
export function noticesToMail(notices, saveResult) {
	const failed = new Set((saveResult?.failed || []).map((row) => String(row?.id || "")));
	return (notices || []).filter((notice) => {
		const doc = notice?.doc || {};
		const id = String(doc.id || doc.controlNo || doc.joNo || doc.ceId || "");
		return id !== "" && !failed.has(id);
	});
}

/**
 * The server calls read and save. The browser does not.
 * @param {{ read: () => Promise<{ markups?: any[], proposals?: any[], jobOrders?: any[], notifications?: any[], notifyMatrix?: unknown }>, save: (documents: { markups?: any[], proposals?: any[], jobOrders?: any[] }, notices: any[], now: string) => Promise<unknown>, now?: unknown }} input
 */
export async function executeServerEscalation(input) {
	const loaded = await input.read();
	const now = input?.now ? String(input.now) : new Date().toISOString();
	const result = runServerEscalation(loaded, now);
	const saved = await input.save(result.documents, result.notices, now);
	return { ...result, now, saved };
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
