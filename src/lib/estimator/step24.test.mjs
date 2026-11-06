// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	canShowHeaderEdit,
	ceDocReadOnly,
	dropReadOnlyDirtyKeys,
	leaveNeedsPrompt,
	sameDocument,
	shouldSendDocChange,
	stableJson,
} from "./viewOnlySave.js";
import {
	SAVE_ERROR_KEY,
	clearEstimatorClientState,
	isSigningOut,
	markSigningOut,
	readReminderStamps,
	readSaveError,
	signOutClean,
	writeReminderStamps,
	writeSaveError,
} from "./clientSession.js";
import { cachedSignature, forgetMissingSignatures, loadSignatureImage, needsDraftWatermark, signatureObjectPath } from "./signatures.js";

const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../components/EstimatorShell.tsx", import.meta.url), "utf8");
const access = readFileSync(new URL("../../components/AccessScreens.jsx", import.meta.url), "utf8");

function memoryStorage() {
	const map = new Map();
	return {
		get length() {
			return map.size;
		},
		key: (i) => [...map.keys()][i] ?? null,
		getItem: (k) => (map.has(k) ? map.get(k) : null),
		setItem: (k, v) => map.set(k, String(v)),
		removeItem: (k) => map.delete(k),
		map,
	};
}

// 1. Opening or viewing saves nothing.
test("opening an estimate with no change sends nothing", () => {
	const doc = { meta: { title: "A", client: "B" }, tasks: [], approval: { status: "in-progress", steps: [{ by: "x" }] } };
	const baseline = stableJson(doc);
	assert.equal(shouldSendDocChange({ baseline, next: { ...doc } }), false);
	assert.equal(shouldSendDocChange({ baseline, next: { tasks: [], approval: doc.approval, meta: { client: "B", title: "A" } } }), false);
	assert.equal(shouldSendDocChange({ baseline, next: { ...doc, meta: { title: "A2", client: "B" } } }), true);
});

test("a read-only estimate never autosaves, except an approval or revision action", () => {
	const baseline = stableJson({ a: 1 });
	assert.equal(shouldSendDocChange({ readOnly: true, baseline, next: { a: 2 } }), false);
	assert.equal(shouldSendDocChange({ readOnly: true, allowed: true, baseline, next: { a: 2 } }), true);
	assert.equal(shouldSendDocChange({ readOnly: true, allowed: true, baseline, next: { a: 1 } }), false);
});

test("sameDocument ignores key order and undefined values", () => {
	assert.equal(sameDocument({ a: 1, b: { c: 2, d: undefined } }, { b: { c: 2 }, a: 1 }), true);
	assert.equal(sameDocument({ a: 1 }, { a: 2 }), false);
});

test("stale local copies of sealed estimates are not pushed on load", () => {
	const server = {
		ceList: [{ id: "CE-1", status: "For approval" }, { id: "CE-2", status: "Draft" }, { id: "CE-3", status: "Done" }],
		documents: { "CE-2": { ceStatus: "Draft" }, "CE-4": { ceStatus: "Pending head approval" } },
	};
	const keys = ["ce:CE-1", "ce:CE-2", "ce:CE-3", "ce:CE-4", "ce:CE-NEW", "rce:R-1", "admin:company"];
	assert.deepEqual(dropReadOnlyDirtyKeys(server, keys), ["ce:CE-2", "ce:CE-NEW", "rce:R-1", "admin:company"]);
	assert.equal(ceDocReadOnly({ status: "Ongoing" }, { approval: { status: "accepted" } }), true);
	assert.equal(ceDocReadOnly({ status: "Ongoing" }, {}), false);
});

test("leaving a view-only estimate does not ask, an editable one still does", () => {
	assert.equal(leaveNeedsPrompt({ viewOnly: true, saveState: "error" }), false);
	assert.equal(leaveNeedsPrompt({ viewOnly: true, saveState: "idle" }), false);
	assert.equal(leaveNeedsPrompt({ viewOnly: true, headerEditing: true }), true);
	assert.equal(leaveNeedsPrompt({ viewOnly: false }), true);
});

test("the editor gates document changes and reminders no longer edit cost estimates", () => {
	assert.match(app, /shouldSendDocChange\(\{\s*readOnly: !!readOnly \|\| !!isEditorLocked/);
	assert.match(app, /if \(current && sameDocument\(current, buildDoc\(current\)\)\) return;/);
	assert.doesNotMatch(app, /reminderAt: hit\.slots/);
	assert.match(app, /writeReminderStamps\(reminderStore/);
	assert.match(app, /Object\.prototype\.hasOwnProperty\.call\(prior, "approval"\) \? \{ approval: prior\.approval \}/);
	assert.match(shell, /dropReadOnlyDirtyKeys\(data, local\?\.dirtyKeys \|\| \[\]\)/);
});

// 2. Sign-out clears per-user state.
test("a save error is shown only to the account that had it", () => {
	const session = memoryStorage();
	writeSaveError(session, "user-a", "TypeError: Failed to fetch. Your changes are still here.");
	assert.equal(readSaveError(session, "user-b"), null);
	assert.equal(session.getItem(SAVE_ERROR_KEY), null);
	writeSaveError(session, "user-a", "boom");
	assert.equal(readSaveError(session, "user-a"), "boom");
	session.setItem(SAVE_ERROR_KEY, "legacy plain text");
	assert.equal(readSaveError(session, "user-a"), null);
});

test("sign-out clears the save error and every workspace backup, then signs out", async () => {
	const session = memoryStorage();
	const local = memoryStorage();
	writeSaveError(session, "user-a", "boom");
	local.setItem("estimator-workspace-backup:user-a", "{}");
	local.setItem("estimator-workspace-backup", "{}");
	local.setItem("unrelated", "keep");
	let called = 0;
	await signOutClean(async () => {
		called += 1;
		assert.equal(isSigningOut(), true);
	}, { session, local });
	assert.equal(called, 1);
	assert.equal(session.getItem(SAVE_ERROR_KEY), null);
	assert.deepEqual([...local.map.keys()], ["unrelated"]);
	markSigningOut(false);
	await assert.rejects(signOutClean(async () => { throw new Error("no"); }, { session, local }));
	assert.equal(isSigningOut(), false);
	clearEstimatorClientState({});
});

test("reminder stamps are per user and stay in the browser", () => {
	const local = memoryStorage();
	writeReminderStamps(local, "u1", { "CE-1": "2026-10-21T01:00:00Z" });
	assert.deepEqual(readReminderStamps(local, "u1"), { "CE-1": "2026-10-21T01:00:00Z" });
	assert.deepEqual(readReminderStamps(local, "u2"), {});
});

test("every sign-out button goes through the clean sign-out, and the shell resets on a new account", () => {
	assert.doesNotMatch(app, /void signOut\(\)/);
	assert.doesNotMatch(access, /void signOut\(\)/);
	assert.match(app, /signOutEstimator\(\(\) => signOut\(\)\)/);
	assert.match(access, /signOutEstimator\(\(\) => signOut\(\)\)/);
	assert.match(shell, /readSaveError\(sessionStorage, signedInId\)/);
	assert.match(shell, /if \(!dirty\.current \|\| isSigningOut\(\)\) return;/);
	assert.doesNotMatch(shell, /sessionStorage\.getItem\("estimator-save-error"\)/);
});

// 3. Missing signature images degrade to the typed name.
test("a missing signature file is asked for once and then returns empty", async () => {
	forgetMissingSignatures();
	let calls = 0;
	const missing = async () => {
		calls += 1;
		throw new Error("Object not found (400)");
	};
	assert.equal(await loadSignatureImage("SAMPLE-USER-MISSING", missing), "");
	assert.equal(await loadSignatureImage("SAMPLE-USER-MISSING", missing), "");
	assert.equal(calls, 1);
	const found = async (path) => {
		assert.equal(path, signatureObjectPath("SAMPLE-USER-FOUND"));
		return "data:image/png;base64,AAAA";
	};
	assert.equal(await loadSignatureImage("SAMPLE-USER-FOUND", found), "data:image/png;base64,AAAA");
	assert.equal(cachedSignature("SAMPLE-USER-FOUND"), "data:image/png;base64,AAAA");
	assert.equal(await loadSignatureImage("SAMPLE-USER-HTML", async () => "<html>"), "");
	forgetMissingSignatures();
});

test("the PDF draws the typed name when no image is cached", () => {
	assert.match(app, /if \(script && !drewImage\)/);
});

// 4. View-only hides Edit.
test("Edit and Import hide when the estimate is not open to this user", () => {
	assert.equal(canShowHeaderEdit({ editLocked: true }), false);
	assert.equal(canShowHeaderEdit({ editLocked: false }), true);
	assert.match(app, /editLocked: !estimateOpen,/);
	assert.match(app, /canShowHeaderEdit\(\{ editLocked \}\) \? \/\* @__PURE__ \*\/ jsxs\("button", \{\s*className: "ce-btn-ghost ce-btn-sm",\s*onClick: \(\) => \{\s*setDraft\(meta\);/);
});

// 5. DRAFT mark: present before final approval (For approval included), absent on Done / approved.
test("DRAFT is on every export before final approval and off once final", () => {
	for (const status of ["Draft", "Ongoing", "For approval", "Pending head approval", "For revision", "Filed", "For review"]) {
		assert.equal(needsDraftWatermark({ flagOn: true, status }), true, status);
	}
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Done" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "For approval", approvalStatus: "accepted" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Noted" }), false);
	assert.equal(needsDraftWatermark({ flagOn: false, status: "Draft" }), false);
});
