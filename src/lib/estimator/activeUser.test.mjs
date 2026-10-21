// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { linkedAccountActive, ownAccountStatus } from "./activeUser.js";

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
});
