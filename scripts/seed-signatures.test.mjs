// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { buildSampleSet } from "./seed-samples.mjs";
import { SIGNATURE_BUCKET, SIGNATURE_HEIGHT, SIGNATURE_WIDTH, signaturePng, signatureTargets } from "./seed-signatures.mjs";
import { signatureObjectPath, stableUserUuid } from "../src/lib/estimator/signatures.js";

const seed = readFileSync(new URL("./seed-test.mjs", import.meta.url), "utf8");

test("signaturePng is a valid, fixed PNG with ink", () => {
	const png = signaturePng("Test Staff");
	assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	assert.equal(png.toString("ascii", 12, 16), "IHDR");
	assert.equal(png.readUInt32BE(16), SIGNATURE_WIDTH);
	assert.equal(png.readUInt32BE(20), SIGNATURE_HEIGHT);
	assert.deepEqual(signaturePng("Test Staff"), png);
	assert.notDeepEqual(signaturePng("Test Lead"), png);
	const idatAt = png.indexOf("IDAT");
	const len = png.readUInt32BE(idatAt - 4);
	const raw = inflateSync(png.subarray(idatAt + 4, idatAt + 4 + len));
	assert.equal(raw.length, (SIGNATURE_WIDTH * 4 + 1) * SIGNATURE_HEIGHT);
	let inked = 0;
	for (let i = 0; i < raw.length; i += 1) if (raw[i] === 255) inked += 1;
	assert.ok(inked > 100);
});

test("signature targets use the same path the app reads", () => {
	const people = [
		{ name: "Test Staff", userKey: stableUserUuid("11111111-1111-4111-8111-111111111111") },
		{ name: "Sample admin", id: "SAMPLE-USER-ADMIN" },
		{ name: "Duplicate", userKey: stableUserUuid("11111111-1111-4111-8111-111111111111") },
	];
	const targets = signatureTargets(people, stableUserUuid);
	assert.equal(targets.length, 2);
	assert.equal(targets[0].path, signatureObjectPath("11111111-1111-4111-8111-111111111111"));
	assert.equal(targets[1].path, signatureObjectPath("SAMPLE-USER-ADMIN"));
	assert.equal(SIGNATURE_BUCKET, "estimator-files");
});

test("the TEST seed uploads signatures, makes the bucket when missing, and stays test-only", () => {
	assert.match(seed, /seedSignatures\(/);
	assert.match(seed, /storage\/v1\/bucket/);
	assert.match(seed, /public: false/);
	assert.match(seed, /"x-upsert": "true"/);
	assert.match(seed, /seedRefusal\(process\.env\)/);
	assert.ok(seed.indexOf("seedRefusal(process.env)") < seed.indexOf("await seedSupabase("));
	assert.doesNotMatch(seed, /console\.log\([^)]*SERVICE_ROLE/);
});

test("roster users carry userId so other people's signatures can be found", () => {
	assert.match(seed, /userId: user\.userKey/);
});

test("a reseeded document gets a newer version", () => {
	assert.match(seed, /version: version \+ 1/);
});

test("a submitted sample CE carries the preparer stamp; drafts carry none", () => {
	const { docs } = buildSampleSet();
	const submitted = docs.find((doc) => doc.id === "SAMPLE-CE-SHOP-FOR-APPROVAL");
	assert.equal(submitted.payload.document.projectInfo.preparedBy, "Test Staff");
	assert.match(submitted.payload.document.projectInfo.preparedStamp, /^Test Staff 2026-10-21 08:00$/);
	const draft = docs.find((doc) => doc.id === "SAMPLE-CE-SHOP-DRAFT");
	assert.equal(draft.payload.document.projectInfo.preparedStamp, undefined);
	const done = docs.find((doc) => doc.id === "SAMPLE-CE-SHOP-DONE");
	assert.equal(done.payload.document.projectInfo.approvedBy, "Test Head");
});
