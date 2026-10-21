// @ts-nocheck

/** Sign-in and sign-up helpers. No sessions, totals, or network calls. */

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
	if (!remindedAt) return true;
	const last = Date.parse(remindedAt);
	if (!Number.isFinite(last)) return true;
	return at - last >= REMINDER_MS;
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
