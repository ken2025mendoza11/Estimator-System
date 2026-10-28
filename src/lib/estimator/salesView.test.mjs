import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { commercialNet } from "./money.js";
import { matrixAllows, normalizeNotifyMatrix } from "./notifyMatrix.js";
import {
	CE_APPROVED_EVENT,
	ceApprovedNotice,
	hideCommercialAward,
	lockedCeChangeAllowed,
	salesBlockedFromEdit,
	salesOwnerAccountId,
	salesViewOn,
} from "./salesView.js";
import { noticeVisible } from "./workflow.js";

const sales = { userId: "sales-1", name: "A. Cruz", accountDepartment: "Sales", department: "Shop" };
const costing = { userId: "cost-1", name: "B. Reyes", accountDepartment: "Cost Estimating", department: "Sales" };

/** @returns {any} */
function approvedPayload() {
	return {
		summary: {
			id: "CE-1",
			status: "Done",
			client: "Acme",
			project: "Pump",
			lastEdited: "2026-10-01",
			lastEditedBy: "B. Reyes",
			approval: { status: "accepted" },
		},
		document: {
			ceStatus: "Done",
			status: "Done",
			tasks: [{ id: "t1", title: "Scope", subtasks: [] }],
			commercial: { contingencyPct: 10, discountPct: 5, validityDays: 30 },
			awardStatus: "",
			assumptions: "Subject to the RCE.",
			meta: { client: "Acme", title: "Pump", location: "Manila" },
			projectInfo: { revNo: "0", docNo: "CE-1" },
			approval: { status: "accepted", steps: [{ role: "head", byUserId: "head-1" }] },
			timeline: [{ action: "Approved", who: "head-1" }],
		},
	};
}

test("the sales view flag hides commercial and award fields without changing a stored net", () => {
	assert.equal(salesViewOn({}), false);
	assert.equal(salesViewOn({ release1SalesView: false }), false);
	assert.equal(hideCommercialAward(false), false);
	assert.equal(salesBlockedFromEdit({ flagOn: false, sales: true, sealed: true }), false);
	assert.equal(hideCommercialAward(true), true);
	assert.equal(salesBlockedFromEdit({ flagOn: true, sales: true, sealed: true }), true);
	assert.equal(salesBlockedFromEdit({ flagOn: true, sales: false, sealed: true }), false);
	assert.equal(salesBlockedFromEdit({ flagOn: true, sales: true, sealed: false }), false);
	const grand = 1_000_000;
	assert.equal(commercialNet(grand, 10, 5), 1_045_000);
	assert.equal(commercialNet(1000, 0, 0), 1000);
});

test("the sales owner is an account id, and a missing id sends no notice", () => {
	const users = [sales, costing];
	assert.equal(salesOwnerAccountId({ ce: { salesOwnerId: "sales-9", preparedBy: "A. Cruz" }, users, departmentsOn: true }), "sales-9");
	assert.equal(salesOwnerAccountId({
		rce: { preparedBy: "A. Cruz", approval: { steps: [{ role: "staff", by: "A. Cruz", byUserId: "sales-1" }] } },
		users,
		departmentsOn: true,
	}), "sales-1");
	assert.equal(salesOwnerAccountId({
		rce: { preparedBy: "A. Cruz", approval: { startedByUserId: "cost-1", steps: [{ role: "staff", by: "A. Cruz" }] } },
		users,
		departmentsOn: true,
	}), "");
	assert.equal(salesOwnerAccountId({ rce: { preparedBy: "A. Cruz" }, users, departmentsOn: true }), "");
	const notice = ceApprovedNotice({ ceId: "CE-1", salesOwnerId: "sales-1", rev: "0" });
	assert.equal(notice?.type, CE_APPROVED_EVENT);
	assert.equal(notice?.toUserId, "sales-1");
	assert.equal(notice?.title, "CE approved");
	assert.equal(Object.hasOwn(notice, "email"), false);
	assert.equal(ceApprovedNotice({ ceId: "CE-1", salesOwnerId: "", rev: "0" }), null);
	assert.equal(noticeVisible({ toUserId: "sales-1", to: "A. Cruz" }, "B. Reyes", "staff", "sales-1"), true);
	assert.equal(noticeVisible({ toUserId: "sales-1", to: "A. Cruz" }, "A. Cruz", "staff", "cost-1"), false);
	assert.equal(noticeVisible({ to: "A. Cruz" }, "A. Cruz", "staff", ""), true);
	assert.equal(matrixAllows(normalizeNotifyMatrix([{ event: CE_APPROVED_EVENT, enabled: false }]), CE_APPROVED_EVENT), false);
	assert.equal(matrixAllows(normalizeNotifyMatrix(null), CE_APPROVED_EVENT), true);
});

test("sales cannot change an approved estimate, and a costing revision keeps the totals", () => {
	const oldPayload = approvedPayload();
	const revision = approvedPayload();
	revision.summary.status = "For revision";
	revision.summary.lastEdited = "2026-10-28";
	revision.summary.lastEditedBy = "B. Reyes";
	revision.document.ceStatus = "For revision";
	revision.document.projectInfo = { ...revision.document.projectInfo, revisionPending: true, revisionNote: "Please revise" };
	revision.document.timeline = [...revision.document.timeline, { action: "Revision", who: "cost-1" }];
	revision.document.commercial = { contingencyPct: 10, discountPct: 5, validityDays: 30 };
	revision.document.summaryTaskFilters = { showBreakdown: false, selectedTaskIds: [] };
	revision.document.thirdPartyShow = { mode: "off", keys: [] };
	revision.document.fileAttachments = { BOL: [] };
	assert.equal(lockedCeChangeAllowed(oldPayload, oldPayload, { sales: true }), true);
	assert.equal(lockedCeChangeAllowed(oldPayload, revision, { sales: true }), false);
	assert.equal(lockedCeChangeAllowed(oldPayload, revision, { sales: false }), true);
	const tasks = approvedPayload();
	tasks.document.ceStatus = "For revision";
	tasks.summary.status = "For revision";
	tasks.document.tasks = [{ id: "t1", title: "Changed" }];
	assert.equal(lockedCeChangeAllowed(oldPayload, tasks, { sales: false }), false);
	const discount = approvedPayload();
	discount.document.ceStatus = "For revision";
	discount.summary.status = "For revision";
	discount.document.commercial = { contingencyPct: 10, discountPct: 0, validityDays: 30 };
	assert.equal(lockedCeChangeAllowed(oldPayload, discount, { sales: false }), false);
	assert.equal(commercialNet(1000, 10, 5), commercialNet(1000, oldPayload.document.commercial.contingencyPct, oldPayload.document.commercial.discountPct));
	const award = approvedPayload();
	award.document.awardStatus = "Awarded";
	award.document.awardJo = "JO-1";
	assert.equal(lockedCeChangeAllowed(oldPayload, award, { sales: false }), false);
	const bare = {
		summary: { id: "CE-2", status: "Done", client: "Acme", project: "Pump" },
		document: {
			ceStatus: "Done",
			tasks: [{ id: "t1" }],
			meta: { client: "Acme", title: "Pump" },
			projectInfo: { revNo: "0" },
			approval: { status: "accepted" },
		},
	};
	const bareRev = {
		summary: { ...bare.summary, status: "For revision", lastEdited: "2026-10-28", isNew: true },
		document: {
			...bare.document,
			ceStatus: "For revision",
			commercial: { contingencyPct: 0, discountPct: 0, validityDays: 30 },
			awardStatus: "",
			awardJo: "",
			assumptions: "",
			summaryTaskFilters: { showBreakdown: false, selectedTaskIds: [] },
			thirdPartyShow: { mode: "off", keys: [] },
			projectInfo: { revNo: "0", revisionPending: true, revisionNote: "Revise" },
			timeline: [{ action: "Revision" }],
		},
	};
	assert.equal(lockedCeChangeAllowed(bare, bareRev, { sales: false }), true);
	assert.equal(lockedCeChangeAllowed(bare, bareRev, { sales: true }), false);
});

test("the app, the seed, and the lock SQL keep the flag off until TEST turns it on", () => {
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	const sql = readFileSync(new URL("../../../supabase/p27-ce-lock-2026-10-28.sql", import.meta.url), "utf8");
	const rollback = readFileSync(new URL("../../../supabase/p27-ce-lock-2026-10-28-rollback.sql", import.meta.url), "utf8");
	const matrix = readFileSync(new URL("./notifyMatrix.js", import.meta.url), "utf8");
	assert.equal(app.includes("release1SalesView: false"), true);
	assert.equal(app.includes("release1SalesViewOn"), true);
	assert.equal(app.includes("release1WriteAllowed"), true);
	const lock = readFileSync(new URL("./ceLock.js", import.meta.url), "utf8");
	assert.equal(lock.includes("lockedCeChangeAllowed"), true);
	assert.equal(app.includes(CE_APPROVED_EVENT) || app.includes("CE approved"), true);
	assert.equal(seed.includes("release1SalesView: true"), true);
	assert.equal(sql.includes("Approved estimates cannot be changed."), true);
	assert.equal(sql.includes("drop column"), false);
	assert.equal(sql.includes("caller_is_sales"), true);
	assert.equal(sql.includes("ce_revision_start"), true);
	assert.equal(rollback.includes("Approved estimates cannot change tasks."), true);
	assert.equal(rollback.includes("drop column"), false);
	assert.equal(matrix.includes(CE_APPROVED_EVENT), true);
});
