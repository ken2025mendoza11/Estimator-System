import assert from "node:assert/strict";
import test from "node:test";
import { applyProfileEdits, profileInitials, readDisplayPrefs } from "./salesProfile.js";
import { pipelineKpis } from "./salesStage.js";

test("profile edits cannot change department, role, or backup", () => {
	assert.equal(profileInitials("Ada Estimator"), "AE");
	const user = { name: "Ada", email: "ada@example.com", department: "Sales", level: "staff", backupUserId: "boss", position: "Rep" };
	const next = applyProfileEdits(user, { name: "Ada Mendoza", department: "Admin", level: "admin", backupUserId: "other", position: "Manager", mobile: "0917", displayPrefs: { theme: "dark", fontSize: "large", notifications: "mute" } });
	assert.equal(next.name, "Ada Mendoza");
	assert.equal(next.department, "Sales");
	assert.equal(next.level, "staff");
	assert.equal(next.backupUserId, "boss");
	assert.equal(next.email, "ada@example.com");
	assert.equal(next.position, "Manager");
	assert.equal(next.mobile, "0917");
	assert.equal(readDisplayPrefs(next).theme, "dark");
	assert.equal(readDisplayPrefs(next).notifications, "mute");
	const kpis = pipelineKpis([
		{ stage: "Won", selling: 10 },
		{ stage: "Lost", selling: 5 },
		{ stage: "Sent/awaiting", selling: 20, validity: "2026-11-06" },
	], "2026-11-04");
	assert.equal(kpis.win, 0.5);
	assert.equal(kpis.openValue, 20);
	assert.equal(kpis.expiring, 1);
	assert.equal(kpis.counts["For markup"], 0);
});
