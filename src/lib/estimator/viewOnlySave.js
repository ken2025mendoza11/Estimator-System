// @ts-nocheck
/**
 * Step 24: opening or viewing a cost estimate must not save anything.
 * Pure helpers so the rules can be unit-tested without the editor.
 */

/** Same statuses ceIsSealed uses: For approval, Done, Accepted, Pending … approval. */
export function sealedStatus(value) {
	const key = String(value || "").trim().toLowerCase();
	return key === "for approval" || key === "done" || key === "accepted" || (key.startsWith("pending ") && key.endsWith(" approval"));
}

/** A cost estimate nobody may line-edit right now. */
export function ceDocReadOnly(summary, doc) {
	return [summary?.status, doc?.ceStatus, doc?.status, doc?.approval?.status, summary?.approval?.status].some(sealedStatus);
}

/** Key order does not matter. undefined values are dropped, like JSON. */
export function stableJson(value) {
	const walk = (input) => {
		if (Array.isArray(input)) return input.map((item) => (item === undefined ? null : walk(item)));
		if (!input || typeof input !== "object") return input;
		const out = {};
		for (const key of Object.keys(input).sort()) {
			if (input[key] === undefined || typeof input[key] === "function") continue;
			out[key] = walk(input[key]);
		}
		return out;
	};
	try {
		return JSON.stringify(walk(value ?? null));
	} catch {
		return "";
	}
}

export function sameDocument(a, b) {
	const left = stableJson(a);
	return left !== "" && left === stableJson(b);
}

/**
 * The editor reports a document change only when the content really moved.
 * A read-only (sealed or locked) estimate reports only an allowed workflow
 * action: an approval decision or starting a revision.
 */
export function shouldSendDocChange({ readOnly = false, allowed = false, baseline = "", next } = {}) {
	if (readOnly && !allowed) return false;
	const body = stableJson(next);
	if (!body) return false;
	return body !== baseline;
}

/**
 * Local unsaved copies kept from an earlier session are not pushed for a cost
 * estimate the server now holds as sealed. Those copies are stale and the
 * server refuses them (signer check, 403).
 */
export function dropReadOnlyDirtyKeys(server, keys) {
	const list = Array.isArray(keys) ? keys : [];
	const summaries = new Map((server?.ceList || []).filter((ce) => ce && ce.id).map((ce) => [String(ce.id), ce]));
	const documents = server?.documents && typeof server.documents === "object" ? server.documents : {};
	return list.filter((key) => {
		const text = String(key || "");
		if (!text.startsWith("ce:")) return true;
		const id = text.slice(3);
		const summary = summaries.get(id);
		const doc = documents[id];
		if (!summary && !doc) return true;
		return !ceDocReadOnly(summary, doc);
	});
}

/** Leaving a view-only estimate with nothing pending needs no prompt. */
export function leaveNeedsPrompt({ viewOnly = false, headerEditing = false, saveState = "idle" } = {}) {
	if (headerEditing) return true;
	if (!viewOnly) return true;
	return saveState === "saving";
}

/** The header Edit button shows only when the estimate is open to this user. */
export function canShowHeaderEdit({ editLocked = false } = {}) {
	return editLocked !== true;
}
