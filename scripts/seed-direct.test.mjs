// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectTotal } from "../src/lib/estimator/ceTotals.js";
import { buildDirectCes } from "./seed-documents.mjs";

const examples = JSON.parse(readFileSync(new URL("../src/lib/estimator/__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const seed = readFileSync(new URL("./seed-test.mjs", import.meta.url), "utf8");
const expect = {
	shop: 27362.51,
	onsite: 95682.28,
	trading: 31692.31,
	hybrid: 154737.1,
};

test("the four direct seed estimates match the golden direct totals", () => {
	const docs = buildDirectCes(examples);
	assert.equal(docs.length, 4);
	for (const doc of docs) {
		const key = doc.id.replace("CE-EX-", "").toLowerCase();
		assert.equal(doc.pricing.model, "direct-v1");
		assert.equal(projectTotal(doc.tasks, doc.pricing), expect[key], doc.id);
	}
});

test("the seed keeps one legacy CE, one RCE and one inspection, and names the service role key", () => {
	assert.equal(seed.includes("CE-TEST-LEGACY"), true);
	assert.equal(seed.includes("RCE-TEST-001"), true);
	assert.equal(seed.includes("OIF-TEST-001"), true);
	assert.equal(seed.includes("buildDirectCes"), true);
	assert.equal(seed.includes("SUPABASE_SERVICE_ROLE_KEY"), true);
	assert.equal(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/.test(seed), false);
});
