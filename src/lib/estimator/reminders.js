// @ts-nocheck
/** Lazy approval reminders, closing requests, take-over, and the RCE-changed tag. */

import { phParts } from "./phTime.js";

/** Manila hours. The window is 08:00–22:00, one slot every 3 hours. 23:00 is outside it. */
export const REMINDER_HOURS = [8, 11, 14, 17, 20];

export const CLOSING_TARGETS = ["Cancelled", "No quote", "Close bid"];

function personKey(value) {
	return String(value || "").trim().toLowerCase();
}

function samePerson(a, b) {
	const left = personKey(a);
	const right = personKey(b);
	return !!left && left === right;
}

/** Manila wall time has no DST. UTC+8 all year. */
function slotIso(year, month, day, hour) {
	const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 8, 0, 0));
	return utc.toISOString();
}

/** Slots that have already opened today in Asia/Manila. Nothing before 08:00. */
export function reminderSlotsUntil(now = new Date()) {
	const p = phParts(now);
	const minutes = Number(p.hour) * 60 + Number(p.minute);
	if (minutes < 8 * 60) return [];
	return REMINDER_HOURS.filter((hour) => hour * 60 <= minutes).map((hour) => ({
		hour,
		label: `${String(hour).padStart(2, "0")}:00`,
		at: slotIso(p.year, p.month, p.day, hour)
	}));
}

/**
 * Slots still owed since lastNotifiedAt.
 * The first run (no timestamp) sends only the latest open slot, not the whole morning.
 * After that, each missed slot is returned once.
 */
export function dueReminderSlots({ now = new Date(), lastNotifiedAt = "" } = {}) {
	const slots = reminderSlotsUntil(now);
	if (!slots.length) return [];
	const last = Date.parse(lastNotifiedAt || "");
	if (!Number.isFinite(last)) return [slots[slots.length - 1]];
	return slots.filter((slot) => Date.parse(slot.at) > last);
}

/** True after the waiting time reaches the given hours. Default is 12. */
export function escalationDue(since, now, hours = 12) {
	const start = Date.parse(String(since || ""));
	const end = now instanceof Date ? now.getTime() : Date.parse(String(now || ""));
	if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
	return (end - start) / 36e5 >= Number(hours);
}

export function pendingClosingStatus(target) {
	return `Pending ${target} approval`;
}

export function planClosing({ fromStatus = "", target, reason } = {}) {
	if (!CLOSING_TARGETS.includes(target)) return { ok: false, message: "That status cannot be requested." };
	const why = String(reason || "").trim();
	if (!why) return { ok: false, message: "A reason is required." };
	return {
		ok: true,
		pendingStatus: pendingClosingStatus(target),
		target,
		fromStatus: fromStatus || "",
		reason: why
	};
}

export function planTakeover({ owner = "", actor = "", reason = "", now } = {}) {
	const why = String(reason || "").trim();
	if (!why) return { ok: false, message: "A reason is required." };
	if (!String(actor || "").trim()) return { ok: false, message: "A person is required." };
	return {
		ok: true,
		takeover: {
			status: "pending",
			reason: why,
			by: actor,
			at: now || new Date().toISOString(),
			owner: owner || ""
		},
		timeline: { action: "Take-over requested", remarks: why, who: actor }
	};
}

export function canDecideTakeover({ owner, actor, authorisedNames } = {}) {
	if (samePerson(actor, owner)) return true;
	return (authorisedNames || []).some((name) => samePerson(name, actor));
}

export function decideTakeover({ takeover, actor, authorisedNames, decision, now } = {}) {
	if (!takeover || takeover.status !== "pending") return { ok: false, message: "No take-over is waiting." };
	if (!canDecideTakeover({ owner: takeover.owner, actor, authorisedNames })) {
		return { ok: false, message: "Only the owner or an authorised person can approve a take-over." };
	}
	const at = now || new Date().toISOString();
	if (decision === "approve") {
		return {
			ok: true,
			takeover: { ...takeover, status: "approved", decidedBy: actor, decidedAt: at },
			assignedTo: takeover.by,
			timeline: {
				action: "Take-over approved",
				remarks: `${takeover.owner || "owner"} → ${takeover.by}. ${takeover.reason}`,
				who: actor
			}
		};
	}
	return {
		ok: true,
		takeover: { ...takeover, status: "declined", decidedBy: actor, decidedAt: at },
		timeline: { action: "Take-over declined", remarks: takeover.reason, who: actor }
	};
}

/** Identity of the RCE the CE was built from. A missing stamp means "not tagged". */
export function rceStamp(rce) {
	if (!rce) return "";
	return [
		rce.revNo || "0",
		rce.customer || rce.client || "",
		rce.projectTitle || rce.description || "",
		rce.onsite ? "1" : "0",
		rce.shopwork || rce.shop ? "1" : "0",
		rce.trading ? "1" : "0"
	].join("|");
}

/** True only when the CE recorded a stamp and the RCE has since changed. Does not edit the CE. */
export function rceChanged(ce, rce) {
	if (!ce?.rceStamp || !rce) return false;
	return ce.rceStamp !== rceStamp(rce);
}

/** Flag off does not use this gate. Flag on: only an accepted RCE can start a CE. */
export function ceCreateAllowed(rce, flagOn) {
	if (!flagOn) return true;
	if (!rce) return false;
	if (rce.approval?.status === "accepted") return true;
	const status = String(rce.status || "").toLowerCase();
	return status === "accepted" || status === "approved";
}
