import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ESTIMATOR_TEST_PROJECT_REF, TEST_SIGN_IN_ENDPOINTS, seedWriteTarget } from "../../../scripts/seed-safety.mjs";

const root = new URL("../../../", import.meta.url);
/** @param {string} path */
const text = (path) => readFileSync(new URL(path, root), "utf8");
const TEST_ENDPOINT = "ep-jolly-sound-azpo5a4b";
const LIVE_ENDPOINT = "ep-wandering-morning-aocsri1h";
const REGION = "c-3.ap-southeast-1.aws.neon.tech";

/** @param {string} endpoint @param {boolean} [pooler] */
function neonUrl(endpoint, pooler = true) {
	const label = pooler ? `${endpoint}-pooler` : endpoint;
	return `postgres://seed-user:secret-not-logged@${label}.${REGION}/neondb?sslmode=require`;
}

test("the seed allows the test Neon endpoint with or without the pooler and refuses every other endpoint", () => {
	assert.deepEqual(TEST_SIGN_IN_ENDPOINTS, [TEST_ENDPOINT]);
	assert.equal(TEST_SIGN_IN_ENDPOINTS.includes(LIVE_ENDPOINT), false);
	const supabase = `https://${ESTIMATOR_TEST_PROJECT_REF}.supabase.co`;

	const pooled = seedWriteTarget({ VITE_SUPABASE_URL: supabase, DATABASE_URL: neonUrl(TEST_ENDPOINT, true) });
	assert.equal(pooled.ok, true);
	assert.equal(pooled.signInEndpoint, TEST_ENDPOINT);
	assert.deepEqual(pooled.lines, [
		`Supabase project: ${ESTIMATOR_TEST_PROJECT_REF}`,
		`Sign-in endpoint: ${TEST_ENDPOINT}`,
	]);
	assert.equal(pooled.lines.join("\n").includes("secret-not-logged"), false);
	assert.equal(pooled.lines.join("\n").includes(REGION), false);
	assert.equal(pooled.lines.join("\n").includes("neondb"), false);

	const direct = seedWriteTarget({ VITE_SUPABASE_URL: supabase, DATABASE_URL: neonUrl(TEST_ENDPOINT, false) });
	assert.equal(direct.ok, true);
	assert.equal(direct.signInEndpoint, TEST_ENDPOINT);

	const live = seedWriteTarget({ VITE_SUPABASE_URL: supabase, DATABASE_URL: neonUrl(LIVE_ENDPOINT, true) });
	assert.equal(live.ok, false);
	assert.equal(live.signInEndpoint, LIVE_ENDPOINT);
	assert.match(live.message, /not an allowed estimator-test sign-in endpoint/);
	assert.equal(live.lines[1], `Sign-in endpoint: ${LIVE_ENDPOINT}`);
	assert.equal(live.lines.join("\n").includes("secret-not-logged"), false);
	assert.equal(live.message.includes("secret-not-logged"), false);
	assert.equal(live.message.includes(REGION), false);

	const liveDirect = seedWriteTarget({ VITE_SUPABASE_URL: supabase, DATABASE_URL: neonUrl(LIVE_ENDPOINT, false) });
	assert.equal(liveDirect.ok, false);
	assert.equal(liveDirect.signInEndpoint, LIVE_ENDPOINT);
	assert.match(liveDirect.message, /not an allowed estimator-test sign-in endpoint/);

	const unknown = seedWriteTarget({
		VITE_SUPABASE_URL: supabase,
		DATABASE_URL: neonUrl("ep-quiet-leaf-zzzz9999", true),
	});
	assert.equal(unknown.ok, false);
	assert.equal(unknown.signInEndpoint, "ep-quiet-leaf-zzzz9999");

	const hidden = seedWriteTarget({
		VITE_SUPABASE_URL: supabase,
		DATABASE_URL: neonUrl(`${TEST_ENDPOINT}extra`, true),
	});
	assert.equal(hidden.ok, false);
	assert.equal(hidden.signInEndpoint, `${TEST_ENDPOINT}extra`);
	assert.equal(hidden.signInEndpoint.includes(TEST_ENDPOINT), true);

	const golive = text("docs/release1-golive.md");
	assert.equal(golive.includes(ESTIMATOR_TEST_PROJECT_REF), true);
	assert.equal(golive.includes(TEST_ENDPOINT), true);
	assert.equal(golive.includes(LIVE_ENDPOINT), true);
	assert.equal(golive.includes("preview/grok/"), true);
	assert.equal(golive.includes("supabase/p1a-numbering-2026-10-20.sql"), true);
	assert.equal(golive.includes("supabase/p35-release1-2026-10-28.sql"), true);
	assert.equal(golive.includes("supabase/p36"), false);
	assert.equal(golive.includes("supabase/p38"), false);
});
