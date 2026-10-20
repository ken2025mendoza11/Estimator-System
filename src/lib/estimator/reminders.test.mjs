// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { matrixAllows, normalizeNotifyMatrix } from "./notifyMatrix.js";
import {
	canDecideTakeover,
	ceCreateAllowed,
	decideTakeover,
	dueReminderSlots,
	pendingClosingStatus,
	planClosing,
	planTakeover,
	rceChanged,
	rceStamp,
	reminderSlotsUntil
} from "./reminders.js";

const at = (iso) => new Date(iso);

test("reminder slots are 08:00–20:00 Manila, every 3 hours, and nothing before 08:00", () => {
	assert.deepEqual(reminderSlotsUntil(at("2026-10-19T23:30:00.000Z")).map((slot) => slot.label), []);
	assert.deepEqual(reminderSlotsUntil(at("2026-10-20T00:00:00.000Z")).map((slot) => slot.label), ["08:00"]);
	assert.deepEqual(reminderSlotsUntil(at("2026-10-20T02:30:00.000Z")).map((slot) => slot.label), ["08:00"]);
	assert.deepEqual(reminderSlotsUntil(at("2026-10-20T10:30:00.000Z")).map((slot) => slot.label), ["08:00", "11:00", "14:00", "17:00"]);
	assert.equal(reminderSlotsUntil(at("2026-10-20T14:30:00.000Z")).at(-1).label, "20:00");
});

test("the first look sends only the latest open slot, then one notice per missed slot", () => {
	const morning = dueReminderSlots({ now: at("2026-10-20T02:30:00.000Z"), lastNotifiedAt: "" });
	assert.deepEqual(morning.map((slot) => slot.label), ["08:00"]);
	const still = dueReminderSlots({ now: at("2026-10-20T02:30:00.000Z"), lastNotifiedAt: morning[0].at });
	assert.deepEqual(still, []);
	const next = dueReminderSlots({ now: at("2026-10-20T03:00:00.000Z"), lastNotifiedAt: morning[0].at });
	assert.deepEqual(next.map((slot) => slot.label), ["11:00"]);
	const catchUp = dueReminderSlots({ now: at("2026-10-20T10:30:00.000Z"), lastNotifiedAt: morning[0].at });
	assert.deepEqual(catchUp.map((slot) => slot.label), ["11:00", "14:00", "17:00"]);
	const firstAfternoon = dueReminderSlots({ now: at("2026-10-20T10:30:00.000Z"), lastNotifiedAt: "" });
	assert.deepEqual(firstAfternoon.map((slot) => slot.label), ["17:00"]);
});

test("closing waits as Pending … approval and a blank reason is refused", () => {
	assert.equal(planClosing({ target: "No quote", reason: " " }).ok, false);
	const planned = planClosing({ fromStatus: "Ongoing", target: "No quote", reason: "No prices" });
	assert.equal(planned.ok, true);
	assert.equal(planned.pendingStatus, "Pending No quote approval");
	assert.equal(pendingClosingStatus("Cancelled"), "Pending Cancelled approval");
	assert.equal(pendingClosingStatus("Close bid"), "Pending Close bid approval");
	assert.equal(planClosing({ target: "Done", reason: "no" }).ok, false);
});

test("take-over needs a reason, and only the owner or an authorised person can approve it", () => {
	assert.equal(planTakeover({ actor: "Test Lead", reason: " " }).ok, false);
	const planned = planTakeover({
		owner: "Test Staff",
		actor: "Test Lead",
		reason: "Staff is out",
		now: "2026-10-20T01:00:00.000Z"
	});
	assert.equal(planned.ok, true);
	assert.equal(planned.timeline.action, "Take-over requested");
	assert.equal(planned.takeover.status, "pending");
	const stranger = decideTakeover({ takeover: planned.takeover, actor: "Test Head", decision: "approve" });
	assert.equal(stranger.ok, false);
	assert.equal(canDecideTakeover({ owner: "Test Staff", actor: "Test Admin", authorisedNames: [] }), false);
	const owner = decideTakeover({
		takeover: planned.takeover,
		actor: "Test Staff",
		decision: "approve",
		now: "2026-10-20T02:00:00.000Z"
	});
	assert.equal(owner.ok, true);
	assert.equal(owner.assignedTo, "Test Lead");
	assert.equal(owner.timeline.action, "Take-over approved");
	assert.match(owner.timeline.remarks, /Test Staff → Test Lead/);
	const named = decideTakeover({
		takeover: planned.takeover,
		actor: "Test Head",
		authorisedNames: ["Test Head"],
		decision: "decline",
		now: "2026-10-20T02:00:00.000Z"
	});
	assert.equal(named.ok, true);
	assert.equal(named.takeover.status, "declined");
	assert.equal(named.timeline.action, "Take-over declined");
});

test("an accepted RCE unlocks CE creation only when the flag is on, and a changed RCE does not edit the CE", () => {
	const ce = { id: "CE-1", tasks: [{ id: "t1", qty: 2 }], rceStamp: rceStamp({ revNo: "0", customer: "A", projectTitle: "Pump", onsite: true }) };
	const before = JSON.stringify(ce);
	const same = { revNo: "0", customer: "A", projectTitle: "Pump", onsite: true };
	assert.equal(rceChanged(ce, same), false);
	assert.equal(rceChanged(ce, { ...same, revNo: "01" }), true);
	assert.equal(rceChanged({ id: "old" }, { revNo: "01" }), false);
	assert.equal(JSON.stringify(ce), before);
	assert.equal(ceCreateAllowed({ status: "Pending" }, false), true);
	assert.equal(ceCreateAllowed({ status: "Pending" }, true), false);
	assert.equal(ceCreateAllowed({ status: "Accepted" }, true), true);
	assert.equal(ceCreateAllowed({ approval: { status: "accepted" }, status: "For approval" }, true), true);
});

test("the notification matrix stays on unless a row is explicitly off", () => {
	assert.equal(matrixAllows(null, "Reminder"), true);
	assert.equal(matrixAllows([{ event: "Reminder", enabled: false }], "Reminder"), false);
	assert.equal(matrixAllows([{ event: "Reminder", enabled: false }], "Needs your approval"), true);
	assert.equal(matrixAllows([], "Something new"), true);
	const rows = normalizeNotifyMatrix([{ event: "Reminder", enabled: false }]);
	assert.equal(rows.find((row) => row.event === "Reminder").enabled, false);
	assert.equal(rows.find((row) => row.event === "RCE accepted").enabled, true);
});
