import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorCanDecide } from "../src/lib/estimator/approvalEngine.js";
import { projectTotal } from "../src/lib/estimator/ceTotals.js";
import { ceEditorOpen } from "../src/lib/estimator/phase8.js";
import { actingLevelFor, ceOnMyList } from "../src/lib/estimator/previewAccess.js";
import { needsDraftWatermark } from "../src/lib/estimator/signatures.js";
import { buildDirectCes } from "./seed-documents.mjs";
import {
	ACCEPTED_RCE_ID,
	CE_JOB_TYPES,
	CE_STATUSES,
	INSPECTION_STATUSES,
	LOGIN_NAMES,
	PENDING_RCE_ID,
	QUEUE_LEVELS,
	RCE_STATUSES,
	SAMPLE_ROLES,
	ACTIVE_WELCOME_AT,
	buildSampleSet,
	pendingAccounts,
	rceRequestRow,
	roleRowFor,
} from "./seed-samples.mjs";

const examples = JSON.parse(readFileSync(new URL("../src/lib/estimator/__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const seed = readFileSync(new URL("./seed-test.mjs", import.meta.url), "utf8");
const samples = readFileSync(new URL("./seed-samples.mjs", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/components/EstimatorShell.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/estimator.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/components/CostEstimatorApp.jsx", import.meta.url), "utf8");
const access = readFileSync(new URL("../src/components/AccessScreens.jsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../src/lib/auth/test-login.ts", import.meta.url), "utf8");
const directTotals = {
	shop: 27362.51,
	onsite: 95682.28,
	trading: 31692.31,
	hybrid: 154737.1,
};

function idsOf(docs) {
	return docs.map((doc) => doc.id);
}

test("every RCE status is an app status, and Rev 1 stays Accepted", () => {
	const { docs } = buildSampleSet();
	const rces = docs.filter((doc) => doc.kind === "rce");
	for (const status of RCE_STATUSES) {
		assert.equal(rces.some((doc) => doc.status === status), true, status);
	}
	for (const doc of rces) assert.equal(RCE_STATUSES.includes(doc.status), true, doc.id);
	const rev = docs.find((doc) => doc.id === "SAMPLE-RCE-ACCEPTED-REV1");
	const original = docs.find((doc) => doc.id === "SAMPLE-RCE-SUPERSEDED");
	assert.equal(rev.status, "Accepted");
	assert.equal(rev.rev, "Rev 1");
	assert.equal(rev.payload.revises, original.id);
	assert.equal(original.status, "Accepted");
	assert.equal(original.superseded, true);
	assert.equal(original.payload.supersededBy, rev.id);
});

test("every CE job type and status is an app status, plus the alternate, take-over and locked CE", () => {
	const { docs } = buildSampleSet();
	const ces = docs.filter((doc) => doc.kind === "ce");
	for (const jobType of CE_JOB_TYPES) {
		for (const status of CE_STATUSES) {
			const id = `SAMPLE-CE-${jobType.toUpperCase()}-${status.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
			const doc = docs.find((row) => row.id === id);
			assert.ok(doc, id);
			assert.equal(doc.jobType, jobType);
			assert.equal(doc.status, status);
		}
	}
	for (const doc of ces) assert.equal(CE_STATUSES.includes(doc.status), true, doc.id);
	const alternate = docs.find((doc) => doc.id === "SAMPLE-CE-ALT-A");
	assert.equal(alternate.suffix, "-A");
	assert.equal(alternate.id.endsWith("-A"), true);
	assert.equal(alternate.reason.length > 0, true);
	assert.equal(alternate.leadApproval.decision, "approved");
	assert.equal(alternate.leadApproval.role, "lead");
	const taken = docs.find((doc) => doc.id === "SAMPLE-CE-TAKEOVER");
	assert.equal(taken.takeover.status, "approved");
	assert.notEqual(taken.assignedTo, taken.owner);
	const locked = docs.find((doc) => doc.id === "SAMPLE-CE-LOCKED");
	assert.equal(locked.status, "Done");
	assert.equal(locked.approval.status, "accepted");
	assert.equal(locked.payload.document.status, "Done");
	assert.equal(locked.payload.document.approval.status, "accepted");
});

test("each inspection status is linked to both an RCE and a CE", () => {
	const { docs } = buildSampleSet();
	const rceIds = new Set(docs.filter((doc) => doc.kind === "rce").map((doc) => doc.id));
	const ceIds = new Set(docs.filter((doc) => doc.kind === "ce").map((doc) => doc.id));
	for (const status of INSPECTION_STATUSES) {
		const doc = docs.find((row) => row.kind === "inspection" && row.status === status);
		assert.ok(doc, status);
		assert.equal(rceIds.has(doc.basedOnRce), true);
		assert.equal(ceIds.has(doc.usedByCe), true);
		assert.equal(doc.payload.basedOnRce, doc.basedOnRce);
		assert.equal(doc.payload.usedByCe, doc.usedByCe);
		assert.equal(doc.payload.createdBy, "Test Staff");
		assert.equal(doc.payload.onsiteInspector, "Test Staff");
		assert.equal(doc.basedOnRce, ACCEPTED_RCE_ID);
	}
});

test("staff, lead and head can decide a sample CE, and the admin queue is the pending account", () => {
	const { users, docs } = buildSampleSet();
	for (const role of SAMPLE_ROLES) {
		assert.equal(users.some((user) => user.role === role && user.accountStatus === "active"), true, role);
	}
	for (const level of QUEUE_LEVELS) {
		const hit = docs.some((doc) => doc.kind === "ce" && actorCanDecide(doc.approval, {
			actor: LOGIN_NAMES[level],
			level,
		}));
		assert.equal(hit, true, level);
		const queue = docs.find((doc) => doc.id === `SAMPLE-CE-QUEUE-${level.toUpperCase()}`);
		assert.equal(ceOnMyList(queue.payload.summary, {
			me: LOGIN_NAMES[level],
			level,
			approval: queue.approval,
		}), true, level);
	}
	const admin = users.find((user) => user.role === "admin");
	const queues = docs.filter((doc) => doc.id.startsWith("SAMPLE-CE-QUEUE-"));
	assert.equal(queues.every((doc) => actorCanDecide(doc.approval, { actor: admin.name, level: "admin" }) === false), true);
	assert.equal(queues.every((doc) => actorCanDecide(doc.approval, { actor: LOGIN_NAMES.admin, level: "admin" }) === false), true);
	assert.equal(pendingAccounts(users).some((user) => user.id === "SAMPLE-USER-PENDING"), true);
	assert.equal(users.some((user) => user.accountStatus === "declined" && user.declineReason), true);
	assert.equal(seed.includes("approvalEngineV2: true"), true);
});

test("sample ids are fixed, unique, marked as sample, and do not replace the legacy or direct estimates", () => {
	const first = buildSampleSet();
	const second = buildSampleSet();
	const ids = [...idsOf(first.docs), ...first.users.map((user) => user.id)];
	assert.deepEqual(idsOf(first.docs), idsOf(second.docs));
	assert.deepEqual(first.users.map((user) => user.id), second.users.map((user) => user.id));
	assert.deepEqual(JSON.stringify(first), JSON.stringify(second));
	assert.equal(new Set(ids).size, ids.length);
	for (const id of ids) assert.equal(id.startsWith("SAMPLE-"), true, id);
	for (const doc of first.docs) assert.equal(doc.sample, true);
	for (const user of first.users) assert.equal(user.sample, true);
	assert.equal(ids.includes("CE-TEST-LEGACY"), false);
	assert.equal(ids.includes("CE-EX-SHOP"), false);
	assert.equal(ids.includes("RCE-TEST-001"), false);
});

test("the seed names the service role key and does not store it", () => {
	assert.equal(seed.includes("SUPABASE_SERVICE_ROLE_KEY"), true);
	assert.equal(seed.includes("buildSampleSet"), true);
	assert.equal(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/.test(seed), false);
	assert.equal(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/.test(samples), false);
	assert.equal(/eyJ[A-Za-z0-9_-]{20,}/.test(`${seed}\n${samples}`), false);
});

test("the four direct-v1 seed totals stay unchanged", () => {
	const docs = buildDirectCes(examples);
	assert.equal(docs.length, 4);
	for (const doc of docs) {
		const key = doc.id.replace("CE-EX-", "").toLowerCase();
		assert.equal(projectTotal(doc.tasks, doc.pricing), directTotals[key], doc.id);
	}
});

test("every sample CE points at a seeded RCE, and a non-draft CE is priced on the accepted RCE", () => {
	const { docs } = buildSampleSet();
	const rces = docs.filter((doc) => doc.kind === "rce");
	const rows = [rceRequestRow({ id: "RCE-TEST-001", status: "Accepted", payload: { id: "RCE-TEST-001", status: "Accepted" } }), ...rces.map(rceRequestRow)];
	const ids = new Set(rows.map((row) => row.id));
	assert.equal(ids.has("RCE-TEST-001"), true);
	assert.equal(ids.has(ACCEPTED_RCE_ID), true);
	assert.equal(ids.has(PENDING_RCE_ID), true);
	const accepted = rces.find((doc) => doc.id === ACCEPTED_RCE_ID);
	assert.equal(accepted.status, "Accepted");
	for (const doc of docs.filter((row) => row.kind === "ce")) {
		const rceId = doc.payload.summary.rceId;
		assert.equal(ids.has(rceId), true, doc.id);
		if (doc.status === "Draft") {
			assert.equal(rceId, PENDING_RCE_ID);
			assert.equal(doc.payload.document.tasks.length, 0);
		} else {
			assert.equal(rceId, ACCEPTED_RCE_ID, doc.id);
			const total = projectTotal(doc.payload.document.tasks, doc.payload.document.pricing);
			assert.equal(Number.isFinite(total) && total > 0, true, doc.id);
		}
	}
	const seedBody = seed.slice(seed.indexOf("async function seedSupabase"));
	const requestAt = seedBody.indexOf("upsertRceRequest");
	const ceAt = seedBody.indexOf('await upsertDoc("ce"');
	assert.equal(requestAt >= 0 && requestAt < ceAt, true);
	assert.equal(seed.includes("rce_requests?on_conflict=id"), true);
});

test("draft watermark and signatures follow the final status, and locked editors hide submit", () => {
	const { docs } = buildSampleSet();
	const done = docs.find((doc) => doc.id === "SAMPLE-CE-SHOP-DONE");
	const approval = docs.find((doc) => doc.id === "SAMPLE-CE-SHOP-FOR-APPROVAL");
	assert.equal(needsDraftWatermark({
		flagOn: true,
		status: done.status,
		approvalStatus: done.approval.status,
	}), false);
	assert.equal(done.payload.document.projectInfo.preparedStamp.includes("Test Staff"), true);
	assert.equal(done.payload.document.projectInfo.approvedBy, "Test Head");
	assert.equal(needsDraftWatermark({
		flagOn: true,
		status: approval.status,
		approvalStatus: approval.approval?.status,
	}), true);
	assert.equal(ceEditorOpen("For approval"), false);
	assert.equal(ceEditorOpen("Done"), false);
	assert.equal(ceEditorOpen("Draft"), true);
	assert.equal(ceEditorOpen("For revision"), true);
	assert.equal(app.includes("ceEditorOpen"), true);
	assert.equal(app.includes("estimateOpen &&"), true);
});

test("each login sees its own estimates and its queue, and acting as uses that login's role", () => {
	const { docs } = buildSampleSet();
	const ces = docs.filter((doc) => doc.kind === "ce");
	for (const level of QUEUE_LEVELS) {
		const mine = ces.filter((doc) => ceOnMyList(doc.payload.summary, {
			me: LOGIN_NAMES[level],
			level,
			approval: doc.approval,
		}));
		assert.equal(mine.length > 8, true, `${level} ${mine.length}`);
		assert.equal(mine.some((doc) => doc.id === `SAMPLE-CE-QUEUE-${level.toUpperCase()}`), true, level);
	}
	const users = [
		{ name: LOGIN_NAMES.admin, level: "admin" },
		{ name: LOGIN_NAMES.lead, level: "lead" },
		{ name: LOGIN_NAMES.staff, level: "staff" },
	];
	assert.equal(actingLevelFor({ realLevel: "admin", editorName: LOGIN_NAMES.lead, users, impersonating: true }), "lead");
	assert.equal(actingLevelFor({ realLevel: "admin", editorName: LOGIN_NAMES.admin, users, impersonating: false }), "admin");
	assert.equal(app.includes("actingLevelFor"), true);
});

test("active seed users are profile-complete, and pending and declined are in the picker", () => {
	const active = roleRowFor({ id: "SAMPLE-USER-STAFF", email: "sample-staff@estimator-test.invalid", dbRole: "staff", name: "Sample staff", accountStatus: "active" });
	assert.equal(active.profile_complete, true);
	assert.equal(active.welcome_seen_at, ACTIVE_WELCOME_AT);
	const pending = roleRowFor({ userId: "55555555-5555-4555-8555-555555555555", email: "sample-pending@estimator-test.invalid", role: "staff", name: "Sample Pending", accountStatus: "pending" });
	assert.equal(pending.status, "pending");
	assert.equal(pending.profile_complete, true);
	assert.equal(pending.welcome_seen_at, null);
	const declined = roleRowFor({ userId: "66666666-6666-4666-8666-666666666666", email: "sample-declined@estimator-test.invalid", role: "staff", name: "Sample Declined", accountStatus: "declined" });
	assert.equal(declined.status, "declined");
	assert.equal(declined.decline_reason, "Sample declined account");
	assert.equal(picker.includes("sample-pending@estimator-test.invalid"), true);
	assert.equal(picker.includes("sample-declined@estimator-test.invalid"), true);
	assert.equal(picker.includes('accountStatus: "pending"'), true);
	assert.equal(picker.includes('accountStatus: "declined"'), true);
	assert.equal(seed.includes("for (const user of TEST_USERS)"), true);
});

test("the save banner does not cover the monitoring tabs", () => {
	assert.equal(shell.includes('position: "fixed"'), false);
	assert.equal(shell.includes("zIndex: 10000"), false);
	assert.equal(shell.includes("ce-save-banner"), true);
	assert.equal(css.includes(".mon-hub-tabs.mon-hub-tabs{position:relative;z-index:6}"), true);
	assert.equal(access.includes("needsProfileForm"), true);
	assert.equal(access.includes("Sign out"), true);
	assert.equal(app.includes("Sign out"), true);
});
