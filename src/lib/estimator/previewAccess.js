import { actorCanDecide } from "./approvalEngine.js";

const LEVELS = new Set(["admin", "head", "lead", "staff"]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function levelOf(value) {
	const key = String(value || "").trim().toLowerCase();
	return LEVELS.has(key) ? key : "";
}

/**
 * Acting as a test user uses that user's role. A real login keeps its own role.
 * Admin never inherits a step just by staying admin while the name changes.
 * @param {{ realLevel?: unknown, editorName?: unknown, users?: Array<{ name?: unknown, level?: unknown }> | null, impersonating?: boolean }} [input]
 * @returns {string}
 */
export function actingLevelFor({ realLevel, editorName, users, impersonating } = {}) {
	const real = levelOf(realLevel) || "staff";
	if (!impersonating) return real;
	const name = String(editorName || "");
	const match = (users || []).find((user) => String(user?.name || "") === name);
	return levelOf(match?.level) || real;
}

/**
 * Home list: my estimates, plus a queue row I am allowed to decide.
 * @param {{ assignedTo?: unknown, lastEditedBy?: unknown, approval?: { engine?: string, status?: string } | null }} [ce]
 * @param {{ me?: unknown, level?: unknown, approval?: { engine?: string, status?: string } | null }} [input]
 * @returns {boolean}
 */
export function ceOnMyList(ce, { me, level, approval } = {}) {
	const name = String(me || "");
	if ((ce?.assignedTo || ce?.lastEditedBy || name) === name) return true;
	const row = approval || ce?.approval;
	return !!(row && row.engine === "v2" && row.status === "in-progress" && actorCanDecide(row, { actor: name, level }));
}
