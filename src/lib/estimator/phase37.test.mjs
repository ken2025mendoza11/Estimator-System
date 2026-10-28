import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mailForRoster, sendRelease1Mail } from "./release1Mail.server.js";
import { documentsFromRows, loadStoredCe, markupEstimateId, storedDocumentLabel } from "./release1Store.server.js";
import { ESTIMATOR_TEST_PROJECT_REF, TEST_SIGN_IN_DATABASE, seedWriteTarget } from "../../../scripts/seed-safety.mjs";

const root = new URL("../../../", import.meta.url);
/** @param {string} path */
const text = (path) => readFileSync(new URL(path, root), "utf8");
const LIVE_PROJECT = "rgppzzwitldwbfkgezoz";
const roster = [{ userId: "sales-1", email: "sales@estimator-test.invalid", name: "Test Sales" }];

test("the seed refuses the live project and the live sign-in database, and allows only the test pair", () => {
	assert.equal(ESTIMATOR_TEST_PROJECT_REF, "nqxijgsbpffewizzefwi");
	assert.equal(TEST_SIGN_IN_DATABASE, "estimator-test-auth");
	const testUrl = `https://${ESTIMATOR_TEST_PROJECT_REF}.supabase.co`;
	const testDb = `postgres://seed-user:secret-not-logged@db.example/${TEST_SIGN_IN_DATABASE}?sslmode=require`;

	const liveProject = seedWriteTarget({
		VITE_SUPABASE_URL: `https://${LIVE_PROJECT}.supabase.co`,
		DATABASE_URL: testDb,
	});
	assert.equal(liveProject.ok, false);
	assert.equal(liveProject.supabaseProject, LIVE_PROJECT);
	assert.equal(liveProject.signInDatabase, TEST_SIGN_IN_DATABASE);
	assert.match(liveProject.message, /not the estimator-test project/);
	assert.equal(liveProject.lines[0], `Supabase project: ${LIVE_PROJECT}`);
	assert.equal(liveProject.lines.join("\n").includes("secret-not-logged"), false);

	const near = seedWriteTarget({
		VITE_SUPABASE_URL: `https://${ESTIMATOR_TEST_PROJECT_REF}extra.supabase.co/nqxijgsbpffewizzefwi`,
		DATABASE_URL: testDb,
	});
	assert.equal(near.ok, false);
	assert.notEqual(near.supabaseProject, ESTIMATOR_TEST_PROJECT_REF);

	const liveDb = seedWriteTarget({
		VITE_SUPABASE_URL: testUrl,
		DATABASE_URL: "postgres://estimator-test-auth:secret-not-logged@db.example/estimator-auth?sslmode=require",
	});
	assert.equal(liveDb.ok, false);
	assert.equal(liveDb.supabaseProject, ESTIMATOR_TEST_PROJECT_REF);
	assert.equal(liveDb.signInDatabase, "estimator-auth");
	assert.match(liveDb.message, /estimator-test-auth/);
	assert.equal(liveDb.lines[1], "Sign-in database: estimator-auth");
	assert.equal(liveDb.lines.join("\n").includes("secret-not-logged"), false);

	const longerName = seedWriteTarget({
		VITE_SUPABASE_URL: `${testUrl}/`,
		DATABASE_URL: "postgres://db.example/estimator-test-auth-backup",
	});
	assert.equal(longerName.ok, false);
	assert.equal(longerName.signInDatabase, "estimator-test-auth-backup");

	const allowed = seedWriteTarget({
		VITE_SUPABASE_URL: `${testUrl}/`,
		DATABASE_URL: testDb,
	});
	assert.equal(allowed.ok, true);
	assert.equal(allowed.message, "");
	assert.deepEqual(allowed.lines, [
		`Supabase project: ${ESTIMATOR_TEST_PROJECT_REF}`,
		`Sign-in database: ${TEST_SIGN_IN_DATABASE}`,
	]);

	const seed = text("scripts/seed-test.mjs");
	const guard = seed.indexOf("seedWriteTarget(process.env)");
	const printed = seed.indexOf("for (const line of target.lines) console.log(line)");
	const users = seed.indexOf("await seedUsers");
	const supa = seed.indexOf("await seedSupabase");
	assert.ok(guard > 0 && printed > guard && printed < users && users < supa);
	const golive = text("docs/release1-golive.md");
	assert.equal(golive.includes(ESTIMATOR_TEST_PROJECT_REF), true);
	assert.equal(golive.includes("estimator-test-auth"), true);
	assert.equal(golive.includes("`estimator-auth`"), true);
	assert.equal(golive.includes("supabase/p1a-numbering-2026-10-20.sql"), true);
	assert.equal(golive.includes("supabase/p35-release1-2026-10-28.sql"), true);
	assert.equal(golive.includes("supabase/p36"), false);
	assert.equal(golive.includes("supabase/p37"), false);
});

test("a markup email uses the CE number, not the internal estimate id", async () => {
	const internalId = "9f3a1c2e4b5d4e6f8a7b1c2d3e4f5a6b";
	const ceNumber = "CE-26-014";
	const stored = documentsFromRows([
		{ kind: "markup", doc_id: "MK-1", payload: { id: "MK-1", ceId: internalId, status: "Approved" } },
		{ kind: "proposal", doc_id: "0004", payload: { id: "0004", controlNo: "0004", ceId: internalId, status: "Approved" } },
	]);
	stored.jobOrders = [{ id: "JO-1", joNo: "JO-001-SW-SAM-26-0004", ceId: internalId }];
	assert.equal(markupEstimateId(stored, "MK-1"), internalId);
	const ces = await loadStoredCe(
		{ VITE_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" },
		/** @type {typeof fetch} */ (async (url) => {
			assert.match(String(url), /kind=eq\.ce/);
			assert.match(String(url), new RegExp(`doc_id=eq\\.${internalId}`));
			return {
				ok: true,
				json: async () => [{
					kind: "ce",
					doc_id: internalId,
					payload: { summary: { id: internalId }, document: { projectInfo: { docNo: ceNumber } } },
				}],
			};
		}),
		internalId,
	);
	const label = storedDocumentLabel({ ...stored, ces }, "MK-1", "markup");
	assert.equal(label, ceNumber);
	assert.equal(label.includes(internalId), false);
	assert.equal(label.includes("0004"), false);
	assert.equal(label.includes("JO-001"), false);
	const missingNumber = storedDocumentLabel({
		markups: [{ id: "MK-1", ceId: internalId }],
		ces: [{ id: internalId, summary: { id: internalId }, document: { projectInfo: {} } }],
	}, "MK-1", "markup");
	assert.equal(missingNumber, "");
	const letter = mailForRoster({ toUserId: "sales-1", template: "approved", label, roster });
	assert.equal(letter.ok, true);
	if (!letter.ok) return;
	/** @type {{ body?: string }[]} */
	const sent = [];
	const mailed = await sendRelease1Mail({
		to: letter.to,
		subject: letter.subject,
		text: letter.text,
		env: { RELEASE1_MAIL_KEY: "mail-key", RELEASE1_MAIL_URL: "https://mail.test/send", RELEASE1_MAIL_FROM: "from@estimator-test.invalid" },
		log: () => {},
		fetchImpl: async (_url, init) => {
			sent.push({ body: init?.body });
			return { ok: true };
		},
	});
	assert.equal(mailed.ok, true);
	const body = JSON.parse(String(sent[0]?.body || "{}"));
	assert.equal(body.text, `${ceNumber} was approved.`);
	assert.equal(body.text.includes(internalId), false);
	assert.equal(body.text.includes("sales-1"), false);
	const route = text("src/routes/api/release1-mail.ts");
	assert.equal(route.includes("markupEstimateId"), true);
	assert.equal(route.includes('kind === "ce" || kind === "markup"'), true);
	assert.equal(route.includes("loadStoredCe"), true);
	assert.equal(route.includes("body.label"), false);
});
