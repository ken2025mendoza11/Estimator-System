import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	accountId,
	approverBackupId,
	backupSignatureLabel,
	findAccount,
	fixedDepartment,
	isAdminDepartment,
	isCostApprover,
	isManagement,
	isSales,
	normalizeApproverLists,
} from "./departments.js";

const salesText = { name: "A. Cruz", department: "Sales", designation: "Representative" };
const costingText = { name: "B. Reyes", department: "Costing", designation: "Estimator" };
const emptyText = { name: "C. Sales", department: "", designation: "" };

test("flag off keeps the old department and designation text match", () => {
	assert.equal(isSales(salesText, false), true);
	assert.equal(isSales(costingText, false), false);
	assert.equal(isCostApprover(costingText, false), true);
	assert.equal(isCostApprover(salesText, false), false);
	assert.equal(isSales({ ...costingText, accountDepartment: "Sales" }, false), false);
	assert.equal(isManagement(salesText, false), false);
	assert.equal(isAdminDepartment(salesText, false), false);
});

test("a set department wins, and an unset one falls back to the old text", () => {
	assert.equal(isSales({ ...costingText, accountDepartment: "Sales" }, true), true);
	assert.equal(isCostApprover({ ...costingText, accountDepartment: "Sales" }, true), false);
	assert.equal(isCostApprover({ name: "Sales Person", department: "Sales", designation: "Sales", accountDepartment: "Cost Estimating" }, true), true);
	assert.equal(isSales(costingText, true), false);
	assert.equal(isCostApprover(costingText, true), true);
	assert.equal(isSales(emptyText, true), false);
	assert.equal(isCostApprover({ department: "", designation: "Cost Estimator" }, true), true);
	assert.equal(isManagement({ accountDepartment: "Management" }, true), true);
	assert.equal(isAdminDepartment({ accountDepartment: "Admin" }, true), true);
	assert.equal(fixedDepartment({ department: "Sales" }), "");
	assert.equal(fixedDepartment({ accountDepartment: "Not a department" }), "");
});

test("identity is the account id, never the name, once the flag is on", () => {
	const users = [
		{ id: "other", userId: "acct-1", name: "Same Name" },
		{ id: "acct-2", name: "Same Name" },
	];
	assert.equal(accountId(users[0]), "acct-1");
	assert.equal(accountId({ name: "Same Name" }), "");
	assert.equal(findAccount(users, { userId: "acct-1", name: "Same Name", flagOn: true }), users[0]);
	assert.equal(findAccount(users, { name: "Same Name", flagOn: true }), null);
	assert.equal(findAccount(users, { name: "Same Name", flagOn: false }), users[0]);
	assert.equal(isSales({ name: "Sales Manager", department: "Shop" }, true), false);
});

test("approver lists keep account ids and a backup signs for the named person", () => {
	const lists = normalizeApproverLists({
		markup: [
			{ userId: "acct-1", backupUserId: "acct-1", name: "Ignore me" },
			{ userId: "acct-2", backupUserId: "acct-3" },
			{ userId: "acct-2", backupUserId: "acct-9" },
		],
		proposal: [{ accountId: "acct-4", backupUserId: "acct-5" }],
		jobOrder: [{ userId: "", backupUserId: "acct-5" }],
	});
	assert.deepEqual(lists.markup, [{ userId: "acct-1", backupUserId: "" }, { userId: "acct-2", backupUserId: "acct-3" }]);
	assert.deepEqual(lists.proposal, [{ userId: "acct-4", backupUserId: "acct-5" }]);
	assert.deepEqual(lists.jobOrder, []);
	assert.equal(approverBackupId(lists, "markup", "acct-2"), "acct-3");
	assert.equal(backupSignatureLabel("M. Dalmacio"), "for M. Dalmacio");
	assert.equal(backupSignatureLabel("  "), "");
	assert.equal(Object.hasOwn(lists.markup[0], "name"), false);
});

test("the app, the seed, and the SQL use the department flag without retyping the old column", () => {
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const seed = readFileSync(new URL("../../../scripts/seed-test.mjs", import.meta.url), "utf8");
	const sql = readFileSync(new URL("../../../supabase/p26-departments-approvers-2026-10-28.sql", import.meta.url), "utf8");
	const rollback = readFileSync(new URL("../../../supabase/p26-departments-approvers-2026-10-28-rollback.sql", import.meta.url), "utf8");
	assert.equal(app.includes("isSales(user, release1DepartmentsOn)"), true);
	assert.equal(app.includes("isCostEstimating(user, release1DepartmentsOn)"), true);
	assert.equal(app.includes("findAccount(users,"), true);
	assert.equal(seed.includes("release1Departments: true"), true);
	assert.equal(sql.includes("account_department"), true);
	assert.equal(sql.includes("drop column"), false);
	assert.equal(/alter column\s+department/i.test(sql), false);
	assert.equal(rollback.includes("drop column if exists account_department"), true);
	assert.equal(rollback.includes("drop column if exists department"), false);
});
