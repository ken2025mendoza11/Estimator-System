// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { linkedAccountActive, linkedAccountAdmin, linkedAccountRole, ownAccountStatus } from "./activeUser.js";

const sql = readFileSync(new URL("../../../supabase/p19-active-user-2026-10-20.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../supabase/p19-active-user-2026-10-20-rollback.sql", import.meta.url), "utf8");
const access = readFileSync(new URL("../supabase/account-role.ts", import.meta.url), "utf8");

const active = { user_key: "user-a", email: "same@example.com", status: "active" };
const pendingDup = { user_key: "user-b", email: "same@example.com", status: "pending" };
const declined = { user_key: "user-c", email: "same@example.com", status: "declined" };
const rows = [active, pendingDup, declined];

test("an active user passes only on their own id", () => {
	assert.equal(linkedAccountActive("user-a", rows), true);
	assert.equal(ownAccountStatus("user-a", rows), "active");
});

test("a pending duplicate with the same email is blocked", () => {
	assert.equal(linkedAccountActive("user-b", rows), false);
	assert.equal(ownAccountStatus("user-b", rows), "pending");
	assert.equal(linkedAccountActive("user-b", [active]), false);
});

test("a declined user is blocked even when the email is active elsewhere", () => {
	assert.equal(linkedAccountActive("user-c", rows), false);
	assert.equal(ownAccountStatus("user-c", rows), "declined");
});

test("is_active_user matches the auth user id and the rollback restores only that function", () => {
	const body = sql.slice(0, sql.indexOf("revoke all on function public.is_active_user()"));
	assert.equal(body.includes("user_key = auth.uid()::text"), true);
	assert.equal(body.includes("lower(email)"), false);
	assert.equal(sql.includes("PASS: is_active_user matches the linked account only"), true);
	assert.equal(sql.includes("FAIL: is_active_user still matches by email"), true);
	assert.equal(rollback.includes("lower(email)"), true);
	assert.equal(rollback.includes("drop column"), false);
	assert.equal(rollback.includes("drop table"), false);
	assert.equal(rollback.includes("create or replace function public.is_active_user()"), true);
	assert.equal(access.includes("ownAccountStatus"), true);
	assert.equal(access.includes("linkedAccountActive"), true);
	assert.equal(access.includes("linkedAccountRole"), true);
});

const admin = { user_key: "admin-1", email: "boss@example.com", status: "active", role: "admin" };
const pendingAdminEmail = { user_key: "pending-1", email: "boss@example.com", status: "pending", role: "staff" };
const declinedAdminEmail = { user_key: "declined-1", email: "boss@example.com", status: "declined", role: "staff" };
const activeStaff = { user_key: "staff-1", email: "staff@example.com", status: "active", role: "staff" };
const roleRows = [admin, pendingAdminEmail, declinedAdminEmail, activeStaff];

test("an active admin passes only on their own id", () => {
	assert.equal(linkedAccountAdmin("admin-1", roleRows), true);
	assert.equal(linkedAccountRole("admin-1", roleRows), "admin");
});

test("a pending duplicate with an admin email is not admin and has no role", () => {
	assert.equal(linkedAccountAdmin("pending-1", roleRows), false);
	assert.equal(linkedAccountRole("pending-1", roleRows), null);
	assert.equal(linkedAccountAdmin("pending-1", [admin]), false);
	assert.equal(linkedAccountRole("pending-1", [admin]), null);
});

test("a declined user has no role even when the email is an active admin", () => {
	assert.equal(linkedAccountAdmin("declined-1", roleRows), false);
	assert.equal(linkedAccountRole("declined-1", roleRows), null);
});

test("a normal active user keeps their own role", () => {
	assert.equal(linkedAccountAdmin("staff-1", roleRows), false);
	assert.equal(linkedAccountRole("staff-1", roleRows), "staff");
});

const roleSql = readFileSync(new URL("../../../supabase/p20-role-by-id-2026-10-20.sql", import.meta.url), "utf8");
const roleRollback = readFileSync(new URL("../../../supabase/p20-role-by-id-2026-10-20-rollback.sql", import.meta.url), "utf8");

test("is_admin and caller_role match the auth user id and the rollback restores only those functions", () => {
	const adminBody = roleSql.slice(roleSql.indexOf("create or replace function public.is_admin()"), roleSql.indexOf("create or replace function public.caller_role()"));
	const roleBody = roleSql.slice(roleSql.indexOf("create or replace function public.caller_role()"), roleSql.indexOf("drop policy if exists app_user_roles_select"));
	assert.equal(adminBody.includes("user_key = auth.uid()::text"), true);
	assert.equal(roleBody.includes("user_key = auth.uid()::text"), true);
	assert.equal(adminBody.includes("lower(email)"), false);
	assert.equal(roleBody.includes("lower(email)"), false);
	assert.equal(roleSql.includes("using (user_key = auth.uid()::text);"), true);
	assert.equal(roleSql.includes("PASS: admin and caller role match the linked account only"), true);
	assert.equal(roleRollback.includes("create or replace function public.is_admin()"), true);
	assert.equal(roleRollback.includes("create or replace function public.caller_role()"), true);
	assert.equal(roleRollback.includes("drop column"), false);
	assert.equal(roleRollback.includes("drop table"), false);
	assert.equal(access.includes("linkedAccountRole(userId, rows)"), true);
});
