import assert from "node:assert/strict";
import test from "node:test";
import { ceAwardOrCancel, release1WriteAllowed } from "./ceLock.js";

const NOW = "2026-10-28T00:00:00.000Z";

function locked() {
	return {
		summary: { id: "CE-1", status: "Done", client: "A", project: "P" },
		document: {
			ceStatus: "Done",
			status: "Done",
			approval: { status: "accepted" },
			tasks: [{ id: "t1", title: "Retube" }],
			timeline: [],
		},
	};
}

test("markup save and markup approval are allowed without writing the estimate", () => {
	const save = release1WriteAllowed({ kind: "markup", newPayload: { status: "Draft", directCost: 10 } });
	assert.equal(save.ok, true);
	assert.equal(save.reason, "markup-save");
	const approval = release1WriteAllowed({ kind: "markup", newPayload: { status: "Approved" } });
	assert.equal(approval.ok, true);
	assert.equal(approval.reason, "markup-approval");
	const returned = release1WriteAllowed({ kind: "markup", newPayload: { status: "Returned" } });
	assert.equal(returned.reason, "markup-approval");
});

test("award and cancel may change a locked estimate, and every other change is refused", () => {
	const old = locked();
	const stuffed = {
		summary: { ...old.summary, markup: { selling: 1 }, awardStatus: "Awarded", awardJo: "JO-1" },
		document: old.document,
	};
	const refused = release1WriteAllowed({ kind: "ce", oldPayload: old, newPayload: stuffed, sales: false });
	assert.equal(refused.ok, false);
	assert.equal(refused.message, "Approved estimates cannot be changed.");
	const tasks = { ...old, document: { ...old.document, tasks: [{ id: "t1", title: "Changed" }] } };
	assert.equal(release1WriteAllowed({ kind: "ce", oldPayload: old, newPayload: tasks, sales: true }).ok, false);
	const awarded = {
		summary: { ...old.summary, status: "Awarded" },
		document: {
			...old.document,
			status: "Awarded",
			ceStatus: "Awarded",
			timeline: [{ who: "acct-1", at: NOW, action: "Awarded" }],
		},
	};
	const award = release1WriteAllowed({ kind: "ce", oldPayload: old, newPayload: awarded, sales: false });
	assert.equal(award.ok, true);
	assert.equal(award.reason, "award");
	assert.equal(ceAwardOrCancel(old, awarded), "award");
	const stray = {
		summary: { ...old.summary },
		document: { ...old.document, status: "Draft" },
	};
	const awardedStray = {
		summary: { ...stray.summary, status: "Awarded" },
		document: {
			...stray.document,
			status: "Awarded",
			ceStatus: "Awarded",
			timeline: [{ who: "acct-1", at: NOW, action: "Awarded" }],
		},
	};
	assert.equal(release1WriteAllowed({ kind: "ce", oldPayload: stray, newPayload: awardedStray }).reason, "award");
	const missingWho = {
		...awarded,
		document: { ...awarded.document, timeline: [{ action: "Awarded", at: NOW }] },
	};
	assert.equal(release1WriteAllowed({ kind: "ce", oldPayload: old, newPayload: missingWho }).ok, false);
	const cancelled = {
		summary: { ...awarded.summary, status: "Done" },
		document: {
			...awarded.document,
			status: "Done",
			ceStatus: "Done",
			timeline: [...awarded.document.timeline, { who: "acct-1", at: NOW, action: "Award cancelled" }],
		},
	};
	const cancel = release1WriteAllowed({ kind: "ce", oldPayload: awarded, newPayload: cancelled, sales: false });
	assert.equal(cancel.ok, true);
	assert.equal(cancel.reason, "cancel");
	const earlyDone = {
		summary: { id: "CE-2", status: "Draft" },
		document: { ceStatus: "Draft", status: "Draft", timeline: [] },
	};
	const forced = {
		summary: { ...earlyDone.summary, status: "Done" },
		document: { ...earlyDone.document, status: "Done", ceStatus: "Done" },
	};
	const blocked = release1WriteAllowed({ kind: "ce", oldPayload: earlyDone, newPayload: forced });
	assert.equal(blocked.ok, false);
	assert.match(blocked.message, /approval is accepted/);
});
