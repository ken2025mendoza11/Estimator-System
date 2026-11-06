// @ts-nocheck
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	ceBlocksInspectionLines,
	inspectionNotingSteps,
	isOwnSignaturePath,
	needsDraftWatermark,
	shouldLoadExportSignatures,
	signatureObjectPath,
	signaturePeople,
	signatureUserKey,
	stableUserUuid,
	withDeadline
} from "./signatures.js";

const USER_NAMESPACE = "c1e0a7e0-7b1a-4e3a-9c2d-5f6a7b8c9d0e";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Independent copy of issue-access.server.ts stableUserUuid. The app key must match auth.uid(). */
function oracleUserUuid(userId) {
	const trimmed = String(userId || "").trim();
	if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
	const namespace = Buffer.from(USER_NAMESPACE.replace(/-/g, ""), "hex");
	const hash = createHash("sha1").update(namespace).update(trimmed, "utf8").digest();
	const bytes = Buffer.from(hash.subarray(0, 16));
	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

test("the signature key is auth.uid(), not the account id and not the admin roster id", () => {
	const staff = "11111111-1111-4111-8111-111111111111";
	assert.equal(stableUserUuid(staff), staff);
	assert.equal(signatureUserKey(staff.toUpperCase()), staff);
	assert.equal(signatureUserKey("dev-user"), oracleUserUuid("dev-user"));
	assert.equal(signatureUserKey("user/1"), oracleUserUuid("user/1"));
	assert.notEqual(signatureUserKey("dev-user"), "dev-user");
	assert.equal(signatureObjectPath("dev-user"), `signatures/${oracleUserUuid("dev-user")}.png`);
	assert.equal(signatureObjectPath(oracleUserUuid("dev-user")), `signatures/${oracleUserUuid("dev-user")}.png`);
	assert.equal(signatureUserKey({ id: "u-est-a", name: "Estimator A" }), "");
	assert.equal(signatureUserKey({ id: "u-est-a", userId: "dev-user" }), oracleUserUuid("dev-user"));
	assert.equal(isOwnSignaturePath("dev-user", signatureObjectPath("dev-user")), true);
	assert.equal(isOwnSignaturePath("dev-user", signatureObjectPath("other-user")), false);
	assert.equal(isOwnSignaturePath("dev-user", "attachments/dev-user.png"), false);
	assert.equal(signatureObjectPath(""), "");
});

test("export lookup uses the auth id, never adminConfig.users id", () => {
	const people = signaturePeople({
		names: ["Mr. Estimator A", "Test Staff"],
		users: [
			{ id: "u-est-a", name: "Estimator A" },
			{ id: "u-staff", name: "Test Staff", userId: "11111111-1111-4111-8111-111111111111" }
		],
		approval: { steps: [{ by: "Estimator A", byUserId: "dev-user" }] }
	});
	const estimator = people.find((person) => person.name === "Estimator A");
	const staff = people.find((person) => person.name === "Test Staff");
	assert.equal(estimator.userId, "dev-user");
	assert.equal(signatureUserKey(estimator), oracleUserUuid("dev-user"));
	assert.equal(signatureUserKey(staff), "11111111-1111-4111-8111-111111111111");
	const rosterOnly = signaturePeople({
		names: ["Estimator A"],
		users: [{ id: "u-est-a", name: "Estimator A" }]
	});
	assert.equal(signatureUserKey(rosterOnly[0]), "");
});

test("a final cost estimate still loads signature images when the flag is on", () => {
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Done", approvalStatus: "accepted" }), false);
	assert.equal(shouldLoadExportSignatures(true), true);
	assert.equal(shouldLoadExportSignatures(false), false);
	assert.equal(shouldLoadExportSignatures(undefined), false);
	const src = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	assert.match(src, /shouldLoadExportSignatures\(exportEngineOn\)/);
	assert.doesNotMatch(src, /signatureUserKey\(\{ id: person\.id/);
	assert.doesNotMatch(src, /person\?\.id \? \{ id: person\.id/);
});

test("DRAFT is off unless the flag is on, and a final decision is not a draft", () => {
	assert.equal(needsDraftWatermark({ flagOn: false, status: "For approval" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "For approval" }), true);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Ongoing" }), true);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "" }), true);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Pending No quote approval" }), true);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Done" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Noted" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "For approval", approvalStatus: "accepted" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Cancelled" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "No quote" }), false);
	assert.equal(needsDraftWatermark({ flagOn: true, status: "Close bid" }), false);
});

test("inspection is prepared then noted, and a locked estimate blocks inspection lines", () => {
	const steps = inspectionNotingSteps();
	assert.deepEqual(steps.map((step) => step.title), ["Prepared by", "Noted by"]);
	assert.equal(steps[1].isFinal, true);
	assert.equal(ceBlocksInspectionLines(null), false);
	assert.equal(ceBlocksInspectionLines({ status: "Ongoing" }), false);
	assert.equal(ceBlocksInspectionLines({ status: "For revision" }), false);
	assert.equal(ceBlocksInspectionLines({ status: "For approval" }), true);
	assert.equal(ceBlocksInspectionLines({ status: "Done" }), true);
	assert.equal(ceBlocksInspectionLines({ status: "Pending Cancelled approval" }), true);
	assert.equal(ceBlocksInspectionLines({ status: "No quote" }), true);
});

test("a hung signature download settles so the inspection preview can finish", async () => {
	const started = Date.now();
	const hung = await withDeadline(() => new Promise(() => {}), 40, "");
	assert.equal(hung, "");
	assert.equal(Date.now() - started < 500, true);
	const ready = await withDeadline(() => Promise.resolve("data:image/png,ok"), 400, "");
	assert.equal(ready, "data:image/png,ok");
});
