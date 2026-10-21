// @ts-nocheck

/** Sign-in and sign-up helpers. No sessions, totals, or network calls. */

import { phParts } from "./phTime.js";

export const WELCOME_STOPS = [
	{ id: "estimates", title: "Cost estimates", body: "Open an estimate from the board. The totals on a saved estimate do not change because you signed in." },
	{ id: "requests", title: "Requests", body: "RCE requests and inspection reports stay with the job. Your role decides which ones you can open." },
	{ id: "role", title: "Your role", body: "An administrator chooses what you can open. This welcome is shown once." }
];

export const QUEUE_TABS = [
	["pending", "Pending"],
	["duplicates", "Possible duplicates"],
	["active", "Active"],
	["declined", "Declined"],
	["disabled", "Disabled"],
	["allowlist", "Allowlist"]
];

const REMINDER_MS = 3 * 60 * 60 * 1000;
const PERSONAL_DOMAINS = [
	"gmail.com",
	"googlemail.com",
	"yahoo.com",
	"yahoo.com.ph",
	"hotmail.com",
	"outlook.com",
	"live.com",
	"icloud.com",
	"me.com",
	"aol.com"
];

function manilaParts(date) {
	const when = date instanceof Date ? date : new Date(date);
	return phParts(Number.isNaN(when.getTime()) ? new Date() : when);
}

/** Greeting from Asia/Manila. The browser time zone is not used. */
export function phGreeting(date = new Date()) {
	const p = manilaParts(date);
	const minutes = Number(p.hour) * 60 + Number(p.minute);
	if (minutes >= 5 * 60 && minutes < 12 * 60) return "Magandang umaga";
	if (minutes >= 12 * 60 && minutes < 13 * 60) return "Magandang tanghali";
	if (minutes >= 13 * 60 && minutes < 18 * 60) return "Magandang hapon";
	return "Magandang gabi";
}

function domainOf(email) {
	const text = String(email || "").trim().toLowerCase();
	const at = text.lastIndexOf("@");
	if (at < 1) return "";
	return text.slice(at + 1);
}

/**
 * personal, company, or other.
 * Company only when a domain list is set and matches. An empty list is never company.
 */
export function classifyEmail(email, companyDomains) {
	const domain = domainOf(email);
	if (!domain) return "other";
	if (PERSONAL_DOMAINS.includes(domain)) return "personal";
	const list = Array.isArray(companyDomains)
		? companyDomains.map((item) => String(item || "").trim().toLowerCase().replace(/^@/, "")).filter(Boolean)
		: [];
	if (list.length && list.includes(domain)) return "company";
	return "other";
}

function manilaIso(year, month, day, hour, minute = 0) {
	return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 8, minute, 0)).toISOString();
}

/**
 * Next admin reminder, 3 hours later, only inside 08:00–22:00 Asia/Manila.
 * A time outside that window moves to the next 08:00.
 */
export function nextAdminReminder(submittedAt) {
	const start = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
	const plus = new Date(start.getTime() + REMINDER_MS);
	const p = manilaParts(plus);
	const minutes = Number(p.hour) * 60 + Number(p.minute);
	if (minutes >= 8 * 60 && minutes < 22 * 60) {
		return { at: plus.toISOString(), label: `${p.hour}:${p.minute}` };
	}
	let year = Number(p.year);
	let month = Number(p.month);
	let day = Number(p.day);
	if (minutes >= 22 * 60) {
		const next = new Date(Date.UTC(year, month - 1, day + 1));
		year = next.getUTCFullYear();
		month = next.getUTCMonth() + 1;
		day = next.getUTCDate();
	}
	return { at: manilaIso(year, month, day, 8), label: "08:00" };
}

export function signatureReady(value) {
	const text = String(value || "");
	return text.startsWith("data:image/") && text.length > 80;
}

export function profileErrors(input) {
	const src = input && typeof input === "object" ? input : {};
	const errors = {};
	const name = String(src.name || "").trim();
	const department = String(src.department || "").trim();
	const digits = String(src.mobile || "").replace(/\D/g, "");
	if (name.length < 2) errors.name = "Full name is required.";
	if (!department) errors.department = "Department is required.";
	if (digits.length < 10) errors.mobile = "A mobile number is required.";
	if (!signatureReady(src.signature)) errors.signature = "An e-signature is required.";
	return errors;
}

export function profileReady(input) {
	return Object.keys(profileErrors(input)).length === 0;
}

export function accessState(account) {
	const src = account && typeof account === "object" ? account : {};
	const reason = String(src.note || src.reason || "");
	if (src.duplicate === true || /duplicate/i.test(reason)) return "duplicate";
	if (/not allowed/i.test(reason)) return "not-allowed";
	if (src.status === "disabled") return "disabled";
	if (src.status === "declined") return "declined";
	if (src.status === "pending") return "pending";
	return "active";
}

export function accessCopy(state, reason) {
	const why = String(reason || "").trim();
	if (state === "duplicate") {
		return { heading: "Duplicate", copy: why || "This email already has an account. It was not linked." };
	}
	if (state === "not-allowed") {
		return { heading: "Not allowed", copy: why || "Your account is not allowed to open the estimator." };
	}
	if (state === "disabled") {
		return { heading: "Disabled", copy: why || "An administrator disabled this account." };
	}
	if (state === "declined") {
		return { heading: "Declined", copy: why || "An administrator declined this account." };
	}
	if (state === "pending") {
		return { heading: "Waiting for admin approval", copy: why || "An administrator has to grant your role before any records are loaded." };
	}
	return { heading: "Signed in", copy: "" };
}

function normName(value) {
	return String(value || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function bigrams(value) {
	const text = normName(value).replace(/ /g, "");
	const out = [];
	for (let i = 0; i < text.length - 1; i += 1) out.push(text.slice(i, i + 2));
	return out;
}

export function nameScore(left, right) {
	const a = bigrams(left);
	const b = bigrams(right);
	if (!a.length || !b.length) return 0;
	const bag = new Map();
	for (const gram of b) bag.set(gram, (bag.get(gram) || 0) + 1);
	let same = 0;
	for (const gram of a) {
		const count = bag.get(gram) || 0;
		if (!count) continue;
		same += 1;
		bag.set(gram, count - 1);
	}
	return (2 * same) / (a.length + b.length);
}

export function compareAccounts(left, right) {
	const a = left && typeof left === "object" ? left : {};
	const b = right && typeof right === "object" ? right : {};
	const keyA = String(a.userKey || a.user_key || "");
	const keyB = String(b.userKey || b.user_key || "");
	if (!keyA || !keyB || keyA === keyB) return "none";
	const emailA = String(a.email || "").trim().toLowerCase();
	const emailB = String(b.email || "").trim().toLowerCase();
	if (emailA && emailA === emailB) return "strong";
	const nameA = a.name || a.display_name || "";
	const nameB = b.name || b.display_name || "";
	if (normName(nameA).length >= 4 && nameScore(nameA, nameB) >= 0.72) return "advisory";
	return "none";
}

export function reminderDue(requestedAt, remindedAt, now) {
	const start = Date.parse(requestedAt || "");
	const at = now instanceof Date ? now.getTime() : Date.parse(now || "");
	if (!Number.isFinite(start) || !Number.isFinite(at)) return false;
	if (at - start < REMINDER_MS) return false;
	if (!remindedAt) {
		const open = manilaParts(new Date(at));
		const minutes = Number(open.hour) * 60 + Number(open.minute);
		if (minutes < 8 * 60 || minutes >= 22 * 60) return false;
		return true;
	}
	const last = Date.parse(remindedAt);
	if (!Number.isFinite(last)) return true;
	if (at - last < REMINDER_MS) return false;
	const open = manilaParts(new Date(at));
	const minutes = Number(open.hour) * 60 + Number(open.minute);
	return minutes >= 8 * 60 && minutes < 22 * 60;
}

export function normalizeBranding(row) {
	const src = row && typeof row === "object" ? row : {};
	const logo = String(src.logo || src.logo_url || "");
	const name = String(src.name || "Estimator System").trim().slice(0, 80);
	return {
		name: name || "Estimator System",
		logo: /^https:\/\//i.test(logo) ? logo.slice(0, 500) : "",
		contact: String(src.contact || "").trim().slice(0, 120)
	};
}

export function linkAllowed(features) {
	return features?.microsoftLinkFlow === true;
}

export function queueRows(rows, tab) {
	const list = Array.isArray(rows) ? rows : [];
	if (tab === "pending") return list.filter((row) => row?.status === "pending");
	if (tab === "active") return list.filter((row) => row?.status === "active");
	if (tab === "declined") return list.filter((row) => row?.status === "declined");
	if (tab === "disabled") return list.filter((row) => row?.status === "disabled");
	return [];
}
