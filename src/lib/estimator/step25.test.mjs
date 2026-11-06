// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { showDecisionButtons } from "./decisionAccess.js";
import { needsDraftWatermark } from "./signatures.js";
import { actorCanDecide } from "./approvalEngine.js";
import { buildSampleSet, LOGIN_IDS } from "../../../scripts/seed-samples.mjs";
import { ceMirrorRows } from "../../../scripts/seed-mirror.mjs";

const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../components/EstimatorShell.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../auth/test-login.ts", import.meta.url), "utf8");
const seedTest = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");

const ces = () => buildSampleSet().docs.filter((doc) => doc.kind === "ce");
const approvalOf = (id) => ces().find((doc) => doc.id === id)?.payload?.document?.approval;
const ACTORS = {
	staff: { actor: "Test Staff", level: "staff" },
	lead: { actor: "Test Lead", level: "lead" },
	head: { actor: "Test Head", level: "head" },
	admin: { actor: "Test Admin", level: "admin" },
};

test("Filed and Noted inspections have no DRAFT mark", () => {
	for (const status of ["Filed", "filed", "Noted"]) {
		assert.equal(needsDraftWatermark({ flagOn: true, status, docType: "oif" }), false, status);
	}
	assert.equal(needsDraftWatermark({ flagOn: true, status: "", docType: "oif" }), true);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Draft", docType: "oif" }), true);
	// A CE called Filed is unchanged.
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Filed" }), true);
	assert.equal((app.match(/docType: "oif" \}\)/g) || []).length, 2);
});

test("decision buttons only for the assigned reviewer/approver", () => {
	const shown = (id, who) => showDecisionButtons(approvalOf(id), ACTORS[who]);
	for (const id of ces().map((doc) => doc.id)) {
		const approval = approvalOf(id);
		if (!approval) continue;
		assert.equal(shown(id, "admin"), false, id);
		for (const who of Object.keys(ACTORS)) {
			if (shown(id, who)) assert.ok(actorCanDecide(approval, ACTORS[who]), `${who} ${id}`);
		}
	}
	assert.equal(shown("SAMPLE-CE-QUEUE-STAFF", "staff"), true);
	assert.equal(shown("SAMPLE-CE-QUEUE-LEAD", "staff"), false);
	assert.equal(shown("SAMPLE-CE-QUEUE-HEAD", "staff"), false);
	assert.equal(shown("SAMPLE-CE-QUEUE-LEAD", "lead"), true);
	assert.equal(shown("SAMPLE-CE-QUEUE-LEAD", "head"), false);
	assert.equal(shown("SAMPLE-CE-QUEUE-HEAD", "head"), true);
	assert.equal(shown("SAMPLE-CE-ALT-A", "staff"), false);
	assert.ok(!app.includes("actorCanDecide(approvalNow, { actor: editingUser, level: actingLevel }) && /* @__PURE__ */ jsx(\"button\""));
	assert.ok(app.includes("showDecisionButtons(approval, { actor: me, level: actingLevel })"));
});

test("seeded signer ids are real test-login accounts", () => {
	for (const [role, id] of Object.entries(LOGIN_IDS)) assert.ok(login.includes(id), role);
	const real = new Set(Object.values(LOGIN_IDS));
	for (const doc of ces()) {
		for (const step of doc.payload?.document?.approval?.steps || []) {
			if (step.byUserId) assert.ok(real.has(step.byUserId), `${doc.id} ${step.byUserId}`);
		}
	}
});

test("seed writes the save_workspace_doc mirror rows", () => {
	const doc = ces().find((d) => d.id === "SAMPLE-CE-QUEUE-LEAD");
	const rows = ceMirrorRows(doc.id, doc.payload, new Set());
	assert.equal(rows.estimate.id, doc.id);
	assert.equal(rows.document.ce_id, doc.id);
	assert.deepEqual(rows.document.document.approval, doc.payload.document.approval);
	assert.equal(ceMirrorRows("X", {}, new Set()), null);
	assert.ok(seedTest.includes('sb("ce_documents?on_conflict=ce_id"'));
});

test("load does not save: baseline persist and local reminders", () => {
	assert.ok(app.includes("persistRef.current?.(payload, { baseline: true })"));
	assert.ok(app.includes("setLocalReminders"));
	assert.ok(shell.includes("options?.baseline"));
});
