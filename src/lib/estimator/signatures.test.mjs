// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
	ceBlocksInspectionLines,
	inspectionNotingSteps,
	isOwnSignaturePath,
	needsDraftWatermark,
	signatureObjectPath,
	signatureUserKey
} from "./signatures.js";

test("a signature image is signatures/<user_key>.png and only that user owns it", () => {
	assert.equal(signatureUserKey({ id: "user/1" }), "user_1");
	assert.equal(signatureObjectPath("user_1"), "signatures/user_1.png");
	assert.equal(signatureObjectPath(""), "");
	assert.equal(isOwnSignaturePath("user_1", "signatures/user_1.png"), true);
	assert.equal(isOwnSignaturePath("user_1", "signatures/user_2.png"), false);
	assert.equal(isOwnSignaturePath("user_1", "attachments/user_1.png"), false);
	assert.equal(isOwnSignaturePath("", "signatures/.png"), false);
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
