/** Sales view of an approved cost estimate. Flag off keeps the current editor. */

import { findAccount, isSales } from "./departments.js";
import { stableJson } from "./viewOnlySave.js";

export const RELEASE1_SALES_VIEW_FLAG = "release1SalesView";

export const CE_APPROVED_EVENT = "CE approved";

/**
 * @param {unknown} features
 * @returns {boolean}
 */
export function salesViewOn(features) {
	if (!features || typeof features !== "object") return false;
	return /** @type {{ release1SalesView?: unknown }} */ (features).release1SalesView === true;
}

/** Hide contingency, discount, Awarded, Lost, and the JO number. Stored values stay.
 * @param {boolean} [flagOn]
 * @returns {boolean}
 */
export function hideCommercialAward(flagOn) {
	return flagOn === true;
}

/**
 * Sales cannot revise or line-edit a sealed estimate while the flag is on.
 * @param {{ flagOn?: boolean, sales?: boolean, sealed?: boolean }} input
 * @returns {boolean}
 */
export function salesBlockedFromEdit(input) {
	return input?.flagOn === true && input?.sales === true && input?.sealed === true;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function idText(value) {
	return String(value || "").trim();
}

/**
 * Account id of the Sales owner. A display name is never used.
 * @param {{ ce?: unknown, doc?: unknown, rce?: unknown, users?: unknown, departmentsOn?: boolean }} input
 * @returns {string}
 */
export function salesOwnerAccountId(input) {
	const ce = input?.ce && typeof input.ce === "object" ? /** @type {Record<string, unknown>} */ (input.ce) : {};
	const doc = input?.doc && typeof input.doc === "object" ? /** @type {Record<string, unknown>} */ (input.doc) : {};
	const info = doc.projectInfo && typeof doc.projectInfo === "object" ? /** @type {Record<string, unknown>} */ (doc.projectInfo) : {};
	const rce = input?.rce && typeof input.rce === "object" ? /** @type {Record<string, unknown>} */ (input.rce) : {};
	const direct = [ce.salesOwnerId, doc.salesOwnerId, info.salesOwnerId, rce.salesOwnerId].map(idText).find(Boolean);
	if (direct) return direct;
	const users = Array.isArray(input?.users) ? /** @type {Array<Record<string, unknown>>} */ (input.users) : [];
	const departmentsOn = input?.departmentsOn === true;
	const approval = rce.approval && typeof rce.approval === "object" ? /** @type {Record<string, unknown>} */ (rce.approval) : {};
	const steps = Array.isArray(approval.steps) ? approval.steps : [];
	for (const step of steps) {
		if (!step || typeof step !== "object") continue;
		const row = /** @type {Record<string, unknown>} */ (step);
		if (String(row.role || "").toLowerCase() !== "staff") continue;
		const staffId = idText(row.byUserId);
		if (staffId && isSales(findAccount(users, { userId: staffId, flagOn: departmentsOn }), departmentsOn)) return staffId;
	}
	const started = idText(approval.startedByUserId);
	if (started && isSales(findAccount(users, { userId: started, flagOn: departmentsOn }), departmentsOn)) return started;
	return "";
}

/**
 * In-app notice only. No email. No notice when the Sales account id is missing.
 * @param {{ ceId?: unknown, salesOwnerId?: unknown, rev?: unknown }} input
 * @returns {{ type: string, title: string, body: string, ceId: string, toUserId: string, view: string, rev: string } | null}
 */
export function ceApprovedNotice(input) {
	const toUserId = idText(input?.salesOwnerId);
	if (!toUserId) return null;
	const ceId = idText(input?.ceId);
	return {
		type: CE_APPROVED_EVENT,
		title: "CE approved",
		body: ceId ? `${ceId} is approved` : "A cost estimate is approved",
		ceId,
		toUserId,
		view: "editor",
		rev: idText(input?.rev),
	};
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function jsonEmpty(value) {
	if (value == null || value === "" || value === false) return true;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === "object") return Object.keys(/** @type {Record<string, unknown>} */ (value)).every((key) => jsonEmpty(/** @type {Record<string, unknown>} */ (value)[key]));
	return false;
}

/**
 * @param {unknown} oldValue
 * @param {unknown} newValue
 * @returns {unknown}
 */
function dropEmptyAdditions(oldValue, newValue) {
	if (Array.isArray(newValue) || !newValue || typeof newValue !== "object") return newValue;
	const oldObj = oldValue && typeof oldValue === "object" && !Array.isArray(oldValue) ? /** @type {Record<string, unknown>} */ (oldValue) : {};
	const next = /** @type {Record<string, unknown>} */ (newValue);
	/** @type {Record<string, unknown>} */
	const out = {};
	for (const key of Object.keys(next)) {
		if (!Object.prototype.hasOwnProperty.call(oldObj, key)) {
			if (jsonEmpty(next[key])) continue;
			out[key] = next[key];
			continue;
		}
		out[key] = dropEmptyAdditions(oldObj[key], next[key]);
	}
	return out;
}

/**
 * @param {unknown} doc
 * @param {string} key
 * @returns {string}
 */
function percentText(doc, key) {
	const commercial = doc && typeof doc === "object" ? /** @type {Record<string, unknown>} */ (doc).commercial : null;
	const raw = commercial && typeof commercial === "object" ? /** @type {Record<string, unknown>} */ (commercial)[key] : undefined;
	if (raw == null || raw === "") return "0";
	const n = Number(raw);
	return Number.isFinite(n) ? String(n) : String(raw).trim();
}

/**
 * @param {unknown} oldDoc
 * @param {unknown} newDoc
 * @returns {Record<string, unknown>}
 */
function normalizeCommercial(oldDoc, newDoc) {
	const next = newDoc && typeof newDoc === "object" ? { .../** @type {Record<string, unknown>} */ (newDoc) } : {};
	const old = oldDoc && typeof oldDoc === "object" ? /** @type {Record<string, unknown>} */ (oldDoc) : {};
	if (Object.prototype.hasOwnProperty.call(old, "commercial") || !next.commercial || typeof next.commercial !== "object") return next;
	const commercial = /** @type {Record<string, unknown>} */ (next.commercial);
	const days = commercial.validityDays;
	const daysOk = days == null || days === "" || Number(days) === 30;
	if (percentText(next, "contingencyPct") === "0" && percentText(next, "discountPct") === "0" && daysOk) {
		delete next.commercial;
	}
	return next;
}

/**
 * @param {unknown} oldDoc
 * @param {unknown} newDoc
 * @returns {Record<string, unknown>}
 */
function stripEditorDefaults(oldDoc, newDoc) {
	const next = normalizeCommercial(oldDoc, newDoc);
	const old = oldDoc && typeof oldDoc === "object" ? /** @type {Record<string, unknown>} */ (oldDoc) : {};
	const show = next.thirdPartyShow;
	if (!Object.prototype.hasOwnProperty.call(old, "thirdPartyShow") && show && typeof show === "object") {
		const row = /** @type {Record<string, unknown>} */ (show);
		const keys = Array.isArray(row.keys) ? row.keys : [];
		if (row.mode === "off" && keys.length === 0) delete next.thirdPartyShow;
	}
	if (next.meta && typeof next.meta === "object") {
		const oldMeta = old.meta && typeof old.meta === "object" && !Array.isArray(old.meta) ? /** @type {Record<string, unknown>} */ (old.meta) : {};
		const meta = { .../** @type {Record<string, unknown>} */ (next.meta) };
		if (!Object.prototype.hasOwnProperty.call(oldMeta, "date")) delete meta.date;
		if (!Object.prototype.hasOwnProperty.call(oldMeta, "subtitle")) delete meta.subtitle;
		if (!Object.prototype.hasOwnProperty.call(oldMeta, "title") && (meta.title === "" || meta.title === "New Cost Estimate")) delete meta.title;
		if (!Object.prototype.hasOwnProperty.call(oldMeta, "client") && meta.client === "") delete meta.client;
		if (!Object.prototype.hasOwnProperty.call(oldMeta, "location") && meta.location === "") delete meta.location;
		next.meta = meta;
	}
	return next;
}

const DOC_NOISE = ["timeline", "lastEdited", "lastEditedBy", "schedule", "ceStatus", "status"];
const SUMMARY_NOISE = ["timeline", "lastEdited", "lastEditedBy", "status", "client", "project", "isNew"];

/**
 * @param {unknown} value
 * @param {string[]} keys
 * @returns {Record<string, unknown> | null}
 */
function withoutKeys(value, keys) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const out = { .../** @type {Record<string, unknown>} */ (value) };
	for (const key of keys) delete out[key];
	return out;
}

/**
 * @param {unknown} payload
 * @returns {unknown}
 */
function lockCore(payload) {
	const row = payload && typeof payload === "object" ? /** @type {Record<string, unknown>} */ (payload) : {};
	const doc = withoutKeys(row.document, DOC_NOISE);
	if (doc && doc.projectInfo && typeof doc.projectInfo === "object" && !Array.isArray(doc.projectInfo)) {
		const info = { .../** @type {Record<string, unknown>} */ (doc.projectInfo) };
		delete info.revisionPending;
		delete info.revisionNote;
		doc.projectInfo = info;
	}
	return { summary: withoutKeys(row.summary, SUMMARY_NOISE), document: doc };
}

/**
 * @param {unknown} oldStatus
 * @param {unknown} newStatus
 * @returns {boolean}
 */
function statusOk(oldStatus, newStatus) {
	const next = String(newStatus == null ? "" : newStatus).trim().toLowerCase();
	const prev = String(oldStatus == null ? "" : oldStatus).trim().toLowerCase();
	if (!next || next === prev) return true;
	return next === "for revision";
}

/**
 * @param {unknown} payload
 * @param {string} field
 * @returns {string}
 */
function statusField(payload, field) {
	const row = payload && typeof payload === "object" ? /** @type {Record<string, unknown>} */ (payload) : {};
	const doc = row.document && typeof row.document === "object" ? /** @type {Record<string, unknown>} */ (row.document) : {};
	const summary = row.summary && typeof row.summary === "object" ? /** @type {Record<string, unknown>} */ (row.summary) : {};
	if (field === "summary") return String(summary.status || "");
	return String(doc[field] || "");
}

/**
 * @param {unknown} oldPayload
 * @param {unknown} newPayload
 * @returns {boolean}
 */
function revisionMove(oldPayload, newPayload) {
	const pairs = [
		[statusField(oldPayload, "ceStatus"), statusField(newPayload, "ceStatus")],
		[statusField(oldPayload, "status"), statusField(newPayload, "status")],
		[statusField(oldPayload, "summary"), statusField(newPayload, "summary")],
	];
	if (pairs.some(([prev, next]) => next.trim().toLowerCase() === "for revision" && prev.trim().toLowerCase() !== "for revision")) return true;
	const oldDoc = oldPayload && typeof oldPayload === "object" ? /** @type {Record<string, unknown>} */ (oldPayload).document : null;
	const newDoc = newPayload && typeof newPayload === "object" ? /** @type {Record<string, unknown>} */ (newPayload).document : null;
	const oldInfo = oldDoc && typeof oldDoc === "object" ? /** @type {Record<string, unknown>} */ (oldDoc).projectInfo : null;
	const newInfo = newDoc && typeof newDoc === "object" ? /** @type {Record<string, unknown>} */ (newDoc).projectInfo : null;
	const wasPending = !!(oldInfo && typeof oldInfo === "object" && /** @type {Record<string, unknown>} */ (oldInfo).revisionPending === true);
	const nowPending = !!(newInfo && typeof newInfo === "object" && /** @type {Record<string, unknown>} */ (newInfo).revisionPending === true);
	return nowPending && !wasPending;
}

/**
 * An approved estimate can be saved unchanged.
 * Sales cannot change it. Anyone else can only start a revision, and that save
 * cannot change tasks, contingency, discount, award, or the approval.
 * @param {unknown} oldPayload
 * @param {unknown} newPayload
 * @param {{ sales?: boolean }} [options]
 * @returns {boolean}
 */
export function lockedCeChangeAllowed(oldPayload, newPayload, options) {
	if (stableJson(oldPayload) === stableJson(newPayload)) return true;
	if (options?.sales === true) return false;
	if (!statusOk(statusField(oldPayload, "ceStatus"), statusField(newPayload, "ceStatus"))) return false;
	if (!statusOk(statusField(oldPayload, "status"), statusField(newPayload, "status"))) return false;
	if (!statusOk(statusField(oldPayload, "summary"), statusField(newPayload, "summary"))) return false;
	if (!revisionMove(oldPayload, newPayload)) return false;
	const oldDoc = oldPayload && typeof oldPayload === "object" ? /** @type {Record<string, unknown>} */ (oldPayload).document : null;
	const newDoc = newPayload && typeof newPayload === "object" ? /** @type {Record<string, unknown>} */ (newPayload).document : null;
	if (percentText(oldDoc, "contingencyPct") !== percentText(newDoc, "contingencyPct")) return false;
	if (percentText(oldDoc, "discountPct") !== percentText(newDoc, "discountPct")) return false;
	/** @param {unknown} doc @param {string} key */
	const award = (doc, key) => String(doc && typeof doc === "object" ? /** @type {Record<string, unknown>} */ (doc)[key] || "" : "");
	if (award(oldDoc, "awardStatus") !== award(newDoc, "awardStatus")) return false;
	if (award(oldDoc, "awardJo") !== award(newDoc, "awardJo")) return false;
	const oldRow = oldPayload && typeof oldPayload === "object" ? /** @type {Record<string, unknown>} */ (oldPayload) : {};
	const newRow = newPayload && typeof newPayload === "object" ? /** @type {Record<string, unknown>} */ (newPayload) : {};
	const cleanedNew = {
		summary: dropEmptyAdditions(oldRow.summary, newRow.summary),
		document: dropEmptyAdditions(oldDoc, stripEditorDefaults(oldDoc, newDoc)),
	};
	return stableJson(lockCore(oldPayload)) === stableJson(lockCore(cleanedNew));
}
