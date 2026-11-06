/** Profile fields live on the admin user record. Department, role, and backup stay locked. */

const LOCKED = ["department", "role", "level", "backupUserId", "backupApprover", "email"];

/**
 * @param {unknown} name
 * @returns {string}
 */
export function profileInitials(name) {
	const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
	if (!parts.length) return "?";
	return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

/**
 * @param {any} user
 * @param {any} patch
 * @returns {any}
 */
export function applyProfileEdits(user, patch) {
	const next = { ...(user || {}) };
	const src = patch && typeof patch === "object" ? patch : {};
	["name", "position", "mobile", "location", "signature", "avatar"].forEach((key) => {
		if (src[key] != null) next[key] = String(src[key]);
	});
	if (src.displayPrefs && typeof src.displayPrefs === "object") {
		next.displayPrefs = {
			...(next.displayPrefs || {}),
			theme: src.displayPrefs.theme === "dark" ? "dark" : "light",
			fontSize: src.displayPrefs.fontSize === "large" ? "large" : "normal",
			language: "English",
			notifications: src.displayPrefs.notifications === "mute" ? "mute" : "allow",
		};
	}
	LOCKED.forEach((key) => {
		if (user && user[key] != null) next[key] = user[key];
		else delete next[key];
	});
	return next;
}

/**
 * @param {any} user
 * @returns {{ theme: string, fontSize: string, language: string, notifications: string }}
 */
export function readDisplayPrefs(user) {
	const prefs = user?.displayPrefs || {};
	return {
		theme: prefs.theme === "dark" ? "dark" : "light",
		fontSize: prefs.fontSize === "large" ? "large" : "normal",
		language: "English",
		notifications: prefs.notifications === "mute" ? "mute" : "allow",
	};
}

export { LOCKED as PROFILE_LOCKED_FIELDS };
