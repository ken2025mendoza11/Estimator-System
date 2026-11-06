// @ts-nocheck
/**
 * Step 24: per-user client state. A save error, an unsaved backup, or a
 * reminder stamp from one account must never show in the next account.
 */

export const SAVE_ERROR_KEY = "estimator-save-error";
export const BACKUP_PREFIX = "estimator-workspace-backup";
export const REMINDER_PREFIX = "estimator-reminders:";

let signingOut = false;

export function markSigningOut(value = true) {
	signingOut = value === true;
}

export function isSigningOut() {
	return signingOut;
}

function safe(fn, fallback) {
	try {
		return fn();
	} catch {
		return fallback;
	}
}

/** Returns the stored message only when it belongs to this user. A legacy plain string is dropped. */
export function readSaveError(storage, userId) {
	if (!storage || !userId) return null;
	const raw = safe(() => storage.getItem(SAVE_ERROR_KEY), null);
	if (!raw) return null;
	const parsed = safe(() => JSON.parse(raw), null);
	if (!parsed || typeof parsed !== "object" || parsed.userId !== userId || typeof parsed.message !== "string") {
		safe(() => storage.removeItem(SAVE_ERROR_KEY));
		return null;
	}
	return parsed.message;
}

export function writeSaveError(storage, userId, message) {
	if (!storage || !userId || !message) return;
	safe(() => storage.setItem(SAVE_ERROR_KEY, JSON.stringify({ userId, message: String(message) })));
}

export function clearSaveError(storage) {
	if (!storage) return;
	safe(() => storage.removeItem(SAVE_ERROR_KEY));
}

function keysOf(storage) {
	if (!storage) return [];
	const out = [];
	const total = safe(() => storage.length, 0) || 0;
	for (let i = 0; i < total; i += 1) {
		const key = safe(() => storage.key(i), null);
		if (key) out.push(key);
	}
	return out;
}

/** Clears the save error and every unsaved workspace backup. Reminder stamps stay (they are per user). */
export function clearEstimatorClientState({ session = null, local = null } = {}) {
	clearSaveError(session);
	for (const key of keysOf(local)) {
		if (key === BACKUP_PREFIX || key.startsWith(`${BACKUP_PREFIX}:`)) safe(() => local.removeItem(key));
	}
	for (const key of keysOf(session)) {
		if (key === SAVE_ERROR_KEY) safe(() => session.removeItem(key));
	}
}

/** Sign out through the app: stop the unload save, clear per-user state, then sign out. */
export async function signOutClean(signOut, stores = {}) {
	markSigningOut(true);
	clearEstimatorClientState(stores);
	try {
		await signOut();
	} catch (err) {
		markSigningOut(false);
		throw err;
	}
}

function browserStores() {
	return {
		session: typeof sessionStorage === "undefined" ? null : sessionStorage,
		local: typeof localStorage === "undefined" ? null : localStorage,
	};
}

export function signOutEstimator(signOut) {
	return signOutClean(signOut, browserStores());
}

/** Reminder stamps live in this browser, per user, so a reminder never edits a cost estimate. */
export function readReminderStamps(storage, userId) {
	if (!storage || !userId) return {};
	const parsed = safe(() => JSON.parse(storage.getItem(`${REMINDER_PREFIX}${userId}`) || "{}"), {});
	return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

export function writeReminderStamps(storage, userId, stamps) {
	if (!storage || !userId) return;
	safe(() => storage.setItem(`${REMINDER_PREFIX}${userId}`, JSON.stringify(stamps || {})));
}
