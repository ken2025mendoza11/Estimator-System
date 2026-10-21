// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	WELCOME_STOPS,
	accessCopy,
	accessState,
	compareAccounts,
	classifyEmail,
	linkAllowed,
	nameScore,
	nextAdminReminder,
	normalizeBranding,
	phGreeting,
	profileErrors,
	profileReady,
	queueRows,
	reminderDue
} from "./loginUi.js";

const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../../routes/login.tsx", import.meta.url), "utf8");
const pending = readFileSync(new URL("../../components/AccessScreens.jsx", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../supabase/plui-signup-2026-10-20-rollback.sql", import.meta.url), "utf8");
const sql = readFileSync(new URL("../../../supabase/plui-signup-2026-10-20.sql", import.meta.url), "utf8");

test("a profile needs a name, a department, a mobile number, and a signature", () => {
	const missing = profileErrors({ name: "A", department: "", mobile: "123", signature: "" });
	assert.equal(Boolean(missing.name && missing.department && missing.mobile && missing.signature), true);
	const ready = {
		name: "Ken Mendoza",
		department: "Costing",
		mobile: "+63 917 000 0000",
		signature: `data:image/png;base64,${"a".repeat(80)}`
	};
	assert.equal(profileReady(ready), true);
	assert.deepEqual(profileErrors(ready), {});
});

test("the same email is a strong match and a similar name is only a warning", () => {
	const google = { userKey: "google-user", email: "Person@Example.com", name: "Ken Mendoza" };
	const microsoft = { userKey: "microsoft-user", email: "person@example.com", name: "Other" };
	assert.equal(compareAccounts(google, microsoft), "strong");
	assert.equal(compareAccounts(google, { userKey: "other", email: "other@example.com", name: "Ken Mendoze" }), "advisory");
	assert.equal(nameScore("Ken Mendoza", "Ken Mendoza"), 1);
	assert.equal(compareAccounts(google, google), "none");
});

test("access states keep a decline reason and do not treat a new provider as signed in", () => {
	assert.equal(accessState({ status: "declined", note: "Duplicate. This email already has an account.", duplicate: true }), "duplicate");
	assert.equal(accessCopy("duplicate", "").copy.includes("not linked"), true);
	assert.equal(accessState({ status: "declined", note: "Your account is not allowed to open the estimator." }), "not-allowed");
	assert.equal(accessState({ status: "disabled" }), "disabled");
	assert.equal(accessCopy("declined", "No seat").copy, "No seat");
	assert.equal(accessState({ status: "pending" }), "pending");
});

test("an admin reminder waits three hours and does not repeat inside that window", () => {
	const requested = "2026-10-20T00:00:00.000Z";
	const twoHours = new Date("2026-10-20T02:00:00.000Z");
	const fourHours = new Date("2026-10-20T04:00:00.000Z");
	assert.equal(reminderDue(requested, null, twoHours), false);
	assert.equal(reminderDue(requested, null, fourHours), true);
	assert.equal(reminderDue(requested, "2026-10-20T04:00:00.000Z", new Date("2026-10-20T06:00:00.000Z")), false);
});

test("public branding keeps only the name, an https logo, and a contact line", () => {
	const brand = normalizeBranding({ name: "Acme", logo: "javascript:alert(1)", contact: "Manila", email: "hidden@example.com", role: "admin" });
	assert.deepEqual(brand, { name: "Acme", logo: "", contact: "Manila" });
	assert.equal(normalizeBranding({ logo: "https://cdn.example.com/logo.png" }).logo, "https://cdn.example.com/logo.png");
});

test("the welcome has three stops, the link flow stays off, and the queue has six tabs", () => {
	assert.equal(WELCOME_STOPS.length, 3);
	assert.equal(linkAllowed({}), false);
	assert.equal(linkAllowed({ microsoftLinkFlow: false }), false);
	assert.equal(linkAllowed({ microsoftLinkFlow: true }), true);
	assert.equal(queueRows([{ status: "pending" }, { status: "active" }], "pending").length, 1);
	assert.equal(/microsoftLinkFlow: false/.test(app), true);
	assert.equal(/microsoftLinkFlow: src\.features\?\.microsoftLinkFlow === true/.test(app), true);
});

test("the login page keeps the loader and the sign-in calls, and the test banner is gated", () => {
	assert.equal(login.includes("Opening session…"), true);
	assert.equal(login.includes("signIn(p.providerId"), true);
	assert.equal(login.includes("authClient.signIn"), true);
	assert.equal(/testLogin \? /.test(login), true);
	assert.equal(login.includes("get_public_branding") || login.includes("loadPublicBranding"), true);
});

test("the sign-up SQL adds the required functions and does not alter clients", () => {
	for (const name of [
		"update_pending_profile",
		"decline_user_with_reason",
		"mark_welcome_seen",
		"account_link_requests",
		"grant_role(p_user_key text, p_role text)",
		"decline_as_duplicate",
		"approve_instead",
		"possible_duplicates",
		"access_audit_log",
		"get_public_branding"
	]) {
		assert.equal(sql.includes(name), true, name);
	}
	assert.equal(/another active account already uses this email/i.test(sql), true);
	assert.equal(sql.includes("alter table public.clients"), false);
	assert.equal(sql.includes("alter table public.masterlist_items"), false);
	assert.equal(sql.includes("linked', false") || sql.includes("'linked', false"), true);
	assert.equal(sql.includes("duplicate_of"), true);
	assert.equal(sql.includes("duplicate_refused"), false);
	assert.equal(rollback.includes("drop column"), false);
	assert.equal(rollback.includes("register_pending"), true);
	assert.equal(rollback.includes("grant_role"), true);
	assert.equal(rollback.includes("list_user_access"), true);
	assert.equal(login.includes("phGreeting"), true);
	assert.equal(pending.includes("phStamp"), true);
	assert.equal(sql.includes("FAIL: pending user can still read workspace_docs"), true);
	assert.equal(sql.includes("PASS: signup profile, one active email, and public branding"), true);
});

function manila(wall) {
	return new Date(`${wall}:00+08:00`);
}

test("the greeting follows Asia/Manila and ignores the browser zone", () => {
	assert.equal(phGreeting(manila("2026-10-20T04:59")), "Magandang gabi");
	assert.equal(phGreeting(manila("2026-10-20T05:00")), "Magandang umaga");
	assert.equal(phGreeting(manila("2026-10-20T11:59")), "Magandang umaga");
	assert.equal(phGreeting(manila("2026-10-20T12:00")), "Magandang tanghali");
	assert.equal(phGreeting(manila("2026-10-20T12:59")), "Magandang tanghali");
	assert.equal(phGreeting(manila("2026-10-20T13:00")), "Magandang hapon");
	assert.equal(phGreeting(manila("2026-10-20T17:59")), "Magandang hapon");
	assert.equal(phGreeting(manila("2026-10-20T18:00")), "Magandang gabi");
	assert.equal(phGreeting(new Date("2026-10-20T16:30:00.000Z")), "Magandang gabi");
});

test("email is personal or other, and company only when the list is set", () => {
	assert.equal(classifyEmail("person@gmail.com"), "personal");
	assert.equal(classifyEmail("person@gmail.com", []), "personal");
	assert.equal(classifyEmail("person@gmail.com", ["gmail.com"]), "personal");
	assert.equal(classifyEmail("staff@acme.com"), "other");
	assert.equal(classifyEmail("staff@acme.com", []), "other");
	assert.equal(classifyEmail("staff@acme.com", ["@acme.com"]), "company");
	assert.equal(classifyEmail("not-an-email", ["acme.com"]), "other");
});

test("an admin reminder stays inside 08:00–22:00 Philippine time", () => {
	const submitted = "2026-10-20T13:30:00.000Z";
	const next = nextAdminReminder(submitted);
	assert.equal(next.label, "08:00");
	assert.equal(next.at, "2026-10-21T00:00:00.000Z");
	assert.equal(reminderDue(submitted, null, new Date("2026-10-20T16:30:00.000Z")), false);
	assert.equal(reminderDue(submitted, null, new Date("2026-10-21T00:00:00.000Z")), true);
});
