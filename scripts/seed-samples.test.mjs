import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectTotal } from "../src/lib/estimator/ceTotals.js";
import { buildDirectCes } from "./seed-documents.mjs";
import {
	CE_JOB_TYPES,
	CE_STATUSES,
	INSPECTION_STATUSES,
	RCE_STATUSES,
	SAMPLE_ROLES,
	buildSampleSet,
	queueFor,
} from "./seed-samples.mjs";

const examples = JSON.parse(readFileSync(new URL("../src/lib/estimator/__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const seed = readFileSync(new URL("./seed-test.mjs", import.meta.url), "utf8");
const samples = readFileSync(new URL("./seed-samples.mjs", import.meta.url), "utf8");
const directTotals = {
	shop: 27362.51,
	onsite: 95682.28,
	trading: 31692.31,
	hybrid: 154737.1,
};

function idsOf(docs) {
	return docs.map((doc) => doc.id);
}

test("every RCE status is a fixed sample row, and the revision keeps Rev 1", () => {
	const { docs } = buildSampleSet();
	for (const status of RCE_STATUSES) {
		assert.equal(docs.some((doc) => doc.kind === "rce" && doc.status === status), true, status);
	}
	const rev = docs.find((doc) => doc.id === "SAMPLE-RCE-REVISED");
	const original = docs.find((doc) => doc.id === "SAMPLE-RCE-SUPERSEDED");
	assert.equal(rev.rev, "Rev 1");
	assert.equal(rev.payload.revises, original.id);
	assert.equal(original.superseded, true);
	assert.equal(original.payload.supersededBy, rev.id);
});

test("every CE job type and status exists, plus the alternate, take-over and locked CE", () => {
	const { docs } = buildSampleSet();
	for (const jobType of CE_JOB_TYPES) {
		for (const status of CE_STATUSES) {
			const id = `SAMPLE-CE-${jobType.toUpperCase()}-${status.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
			const doc = docs.find((row) => row.id === id);
			assert.ok(doc, id);
			assert.equal(doc.jobType, jobType);
			assert.equal(doc.status, status);
		}
	}
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
	assert.equal(locked.locked, true);
	assert.equal(locked.status, "final approved");
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
	}
});

test("every role has a sample user and a non-empty queue, and pending and declined exist", () => {
	const { users, docs } = buildSampleSet();
	for (const role of SAMPLE_ROLES) {
		assert.equal(users.some((user) => user.role === role && user.accountStatus === "active"), true, role);
		assert.equal(queueFor(role, docs).length > 0, true, role);
	}
	assert.equal(users.some((user) => user.accountStatus === "pending"), true);
	assert.equal(users.some((user) => user.accountStatus === "declined" && user.declineReason), true);
});

test("sample ids are fixed, unique, marked as sample, and do not replace the legacy or direct estimates", () => {
	const first = buildSampleSet();
	const second = buildSampleSet();
	const ids = [...idsOf(first.docs), ...first.users.map((user) => user.id)];
	assert.deepEqual(idsOf(first.docs), idsOf(second.docs));
	assert.deepEqual(first.users.map((user) => user.id), second.users.map((user) => user.id));
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
