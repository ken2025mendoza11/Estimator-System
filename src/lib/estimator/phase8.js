// @ts-nocheck
/**
 * Phase 8. Flags quotations, availability, clientLocations, and pendingRecords
 * stay off unless each one is exactly true. Items and clients stay on the
 * masterlist JSON. The new tables are an optional mirror.
 */

import { flattenSubs } from "./ceTotals.js";
import { dueReminderSlots } from "./reminders.js";
import { workingDaysBetween } from "./phCalendar.js";
import { phDate } from "./phTime.js";

const CATS = ["BOL", "BOTE", "BOCM", "PPE", "MISC"];

export function isReviewerLevel(level) {
	const key = String(level || "").toLowerCase();
	return key === "lead" || key === "head" || key === "admin";
}

export function isAdminLevel(level) {
	return String(level || "").toLowerCase() === "admin";
}

export function missingPhase8Table(error) {
	const record = error && typeof error === "object" ? error : {};
	const message = String(record.message || error || "");
	const code = String(record.code || "");
	if (code === "42P01" || code === "PGRST205" || code === "PGRST202") return true;
	return /quotations|quotation_lines|document_quotations|client_locations|pending_records/i.test(message)
		&& /does not exist|could not find|schema cache/i.test(message);
}

/** A missing mirror table does not fail the save. The JSON doc is the source. */
export async function tryMirror(client, table, rows) {
	if (!client || !rows || !rows.length) return { ok: true, skipped: true };
	const { error } = await client.from(table).upsert(rows);
	if (!error) return { ok: true };
	if (missingPhase8Table(error)) return { ok: false, missing: true };
	return { ok: false, error };
}

export async function sha256Hex(bytes) {
	const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesToDataUrl(bytes, mime) {
	const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let bin = "";
	const chunk = 0x8000;
	for (let i = 0; i < data.length; i += chunk) {
		bin += String.fromCharCode(...data.subarray(i, i + chunk));
	}
	return `data:${mime || "application/pdf"};base64,${btoa(bin)}`;
}

export function addQuotation(library, quotation) {
	const list = Array.isArray(library) ? library.slice() : [];
	const hash = String(quotation?.sha256 || "");
	const existing = list.find((row) => row && row.sha256 === hash);
	if (existing) return { duplicate: true, quotation: existing, library: list };
	const row = {
		id: quotation?.id || `qt-${hash.slice(0, 16)}`,
		sha256: hash,
		fileName: String(quotation?.fileName || ""),
		mime: String(quotation?.mime || "application/pdf"),
		byteLength: Number(quotation?.byteLength) || 0,
		dataUrl: String(quotation?.dataUrl || ""),
		lines: Array.isArray(quotation?.lines) ? quotation.lines : [],
		at: quotation?.at || ""
	};
	return { duplicate: false, quotation: row, library: [...list, row] };
}

export function addQuotationLine(quotation, line) {
	const id = String(line?.id || `ql-${Math.random().toString(16).slice(2, 10)}`);
	const next = {
		id,
		description: String(line?.description || "").trim(),
		unit: String(line?.unit || "").trim(),
		qty: Number(line?.qty) || 1,
		unitCost: Number(line?.unitCost) || 0,
		masterlistId: String(line?.masterlistId || "")
	};
	return { ...quotation, lines: [...(quotation?.lines || []), next] };
}

/** A cost estimate stores the quotation id only. The file stays on the library row. */
export function quotationReference(quotationId) {
	return { quotationId: String(quotationId || ""), includeAnnex: true };
}

export function quotationMirrorRow(quotation) {
	return {
		id: quotation.id,
		sha256: quotation.sha256,
		file_name: quotation.fileName || "",
		mime: quotation.mime || "",
		byte_length: Number(quotation.byteLength) || 0
	};
}

export function quotationLineMirrorRow(quotation, line) {
	return {
		id: line.id,
		quotation_id: quotation.id,
		description: line.description || "",
		unit: line.unit || "",
		qty: Number(line.qty) || 0,
		unit_cost: Number(line.unitCost) || 0,
		masterlist_id: line.masterlistId || ""
	};
}

export function documentQuotationMirrorRow(docId, ref) {
	const quotationId = String(ref?.quotationId || "");
	return {
		id: `${docId}:${quotationId}`,
		document_id: String(docId || ""),
		quotation_id: quotationId,
		include_annex: ref?.includeAnnex !== false
	};
}

export function dbPriceOf(item, category) {
	if (!item) return 0;
	const fields = category === "BOL" || category === "BOTE"
		? ["rate", "dailyRate", "ratePerDay"]
		: ["unitCost", "estimatedCost", "rate"];
	for (const key of fields) {
		const n = Number(item[key]);
		if (Number.isFinite(n) && n > 0) return n;
	}
	return 0;
}

/** Quote price is used only when the database has no price. */
export function lineFromQuote({ quoteLine, dbItem, id, category = "BOCM" }) {
	const cat = CATS.includes(category) ? category : "BOCM";
	const dbPrice = dbPriceOf(dbItem, cat);
	const quotePrice = Number(quoteLine?.unitCost ?? quoteLine?.price) || 0;
	const useQuote = !(dbPrice > 0);
	const price = useQuote ? quotePrice : dbPrice;
	const name = String(quoteLine?.description || dbItem?.description || dbItem?.item || dbItem?.role || dbItem?.name || "").trim();
	const base = {
		id,
		masterlistId: dbItem?.id || quoteLine?.masterlistId || "",
		quotationLineId: quoteLine?.id || "",
		qty: Number(quoteLine?.qty) || 1,
		unit: String(quoteLine?.unit || dbItem?.unit || ""),
		priceSource: useQuote ? "quote" : "db",
		dbPrice,
		quotePrice
	};
	if (cat === "BOL") {
		return { ...base, role: name, dayType: "Regular", shift: "Day", days: Number(quoteLine?.days) || 1, rate: price, otHrs: 0, perDiem: 0, allowance: 0 };
	}
	if (cat === "BOTE") {
		return { ...base, description: name, days: Number(quoteLine?.days) || 1, rate: price, powerKw: 0 };
	}
	if (cat === "BOCM") return { ...base, description: name, unitCost: price };
	return { ...base, item: name, unitCost: price };
}

export function annexesForExport(library, refs, unticked) {
	const byId = new Map((library || []).map((row) => [row.id, row]));
	return (refs || []).map((ref) => {
		const row = byId.get(ref?.quotationId);
		if (!row || !row.dataUrl) return null;
		const off = unticked && unticked[ref.quotationId];
		return {
			include: off ? false : ref.includeAnnex !== false,
			dataUrl: row.dataUrl,
			fileName: row.fileName || ""
		};
	}).filter(Boolean);
}

/** No keys are seeded. An empty list stays empty. */
export function availabilityKeysFrom(list) {
	const out = [];
	const seen = new Set();
	(list || []).forEach((raw) => {
		const label = String(raw?.label || raw || "").trim();
		if (!label) return;
		const id = String(raw?.id || label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "key";
		if (seen.has(id)) return;
		seen.add(id);
		out.push({ id, label });
	});
	return out;
}

export function normalizeLocation(raw) {
	const label = String(raw?.label || "").trim();
	const address = String(raw?.address || "").trim();
	if (!label && !address) return null;
	return {
		id: String(raw?.id || `loc-${Math.random().toString(16).slice(2, 10)}`),
		label,
		address,
		city: String(raw?.city || "").trim(),
		notes: String(raw?.notes || "").trim()
	};
}

export function withClientLocation(client, raw) {
	const loc = normalizeLocation(raw);
	if (!loc || !client) return client;
	const locations = Array.isArray(client.locations) ? client.locations : [];
	return { ...client, locations: [...locations, loc] };
}

export function locationMirrorRow(clientId, loc) {
	return {
		id: loc.id,
		client_id: String(clientId || ""),
		label: loc.label || "",
		address: loc.address || "",
		city: loc.city || "",
		notes: loc.notes || ""
	};
}

export function submitPending({ kind, payload, actor, now, replacesId, id }) {
	return {
		id: id || `pr-${Math.random().toString(16).slice(2, 10)}`,
		kind: kind === "client" ? "client" : "item",
		payload: payload && typeof payload === "object" ? payload : {},
		status: "submitted",
		submittedAt: now || "",
		submittedBy: actor || "",
		replacesId: String(replacesId || ""),
		targetId: String(payload?.id || ""),
		lastNotifiedAt: "",
		escalatedAt: ""
	};
}

export function recommendPending({ record, actor, level, now, note }) {
	if (!record) return { ok: false, message: "That record is missing." };
	if (!isReviewerLevel(level)) return { ok: false, message: "A reviewer recommends. An admin finalises." };
	if (record.status !== "submitted") return { ok: false, message: "Only a submitted record can be recommended." };
	return {
		ok: true,
		record: {
			...record,
			status: "recommended",
			recommendedBy: actor || "",
			recommendedAt: now || "",
			recommendNote: String(note || "").trim()
		}
	};
}

export function finalizePending({ record, actor, level, now }) {
	if (!record) return { ok: false, message: "That record is missing." };
	if (!isAdminLevel(level)) return { ok: false, message: "Only an admin can finalise." };
	if (record.status !== "recommended") return { ok: false, message: "A reviewer must recommend it first." };
	return {
		ok: true,
		record: {
			...record,
			status: "final",
			finalizedBy: actor || "",
			finalizedAt: now || ""
		}
	};
}

export function ceIsUnlocked(status) {
	const key = String(status || "").trim().toLowerCase();
	return !key || key === "draft" || key === "ongoing" || key === "for revision";
}

function repointValue(value, from, to) {
	return String(value || "") === from ? to : value;
}

function repointTasks(tasks, from, to) {
	const walk = (list) => (list || []).map((sub) => {
		const items = { ...(sub.items || {}) };
		CATS.forEach((cat) => {
			if (!Array.isArray(items[cat])) return;
			items[cat] = items[cat].map((line) => (
				String(line?.masterlistId || "") === from ? { ...line, masterlistId: to } : line
			));
		});
		return { ...sub, items, children: walk(sub.children) };
	});
	return (tasks || []).map((task) => ({ ...task, subtasks: walk(task.subtasks) }));
}

/** Merge re-points unlocked cost estimates from the old id to the new id. Locked ones are skipped. */
export function mergePending({ record, ces, now }) {
	if (!record || record.status !== "final") return { ok: false, message: "Finalise the record before merging." };
	const from = String(record.replacesId || "");
	const to = String(record.targetId || record.payload?.id || "");
	if (!from || !to) return { ok: false, message: "A merge needs the old id and the new id." };
	const next = [];
	const skipped = [];
	(ces || []).forEach((ce) => {
		const status = ce?.status || ce?.ceStatus || "";
		if (!ceIsUnlocked(status)) {
			skipped.push(ce?.id || "");
			return;
		}
		next.push({
			id: ce?.id || "",
			doc: {
				...ce,
				clientId: repointValue(ce?.clientId, from, to),
				tasks: repointTasks(ce?.tasks, from, to)
			}
		});
	});
	return {
		ok: true,
		ces: next,
		skipped,
		record: { ...record, status: "merged", mergedAt: now || "", targetId: to }
	};
}

export function pendingReminderPlan({ record, now = new Date(), holidays, escalateAfter = 3 } = {}) {
	const status = record?.status;
	if (!record || status === "final" || status === "merged" || status === "declined") {
		return { slots: [], escalate: false, days: 0 };
	}
	const slots = dueReminderSlots({ now, lastNotifiedAt: record.lastNotifiedAt || "" });
	const start = String(record.submittedAt || "").slice(0, 10);
	const days = workingDaysBetween(start, phDate(now), holidays);
	const limit = Number(escalateAfter) > 0 ? Number(escalateAfter) : 3;
	const escalate = days >= limit && !record.escalatedAt;
	return { slots, escalate, days };
}

export function stampReminder(record, plan, now) {
	if (!plan || (!plan.slots.length && !plan.escalate)) return record;
	const next = { ...record };
	if (plan.slots.length) next.lastNotifiedAt = plan.slots[plan.slots.length - 1].at;
	if (plan.escalate) next.escalatedAt = typeof now === "string" ? now : (now || new Date()).toISOString();
	return next;
}

export function listMasterlistItems(masterlist) {
	const rows = [];
	["manpower", "equipment", "consumables", "ppe", "misc"].forEach((key) => {
		(masterlist?.[key] || []).forEach((item) => rows.push({ ...item, categoryKey: key }));
	});
	(masterlist?.customCategories || []).forEach((cat) => {
		(cat?.items || []).forEach((item) => rows.push({ ...item, categoryKey: cat.categoryKey }));
	});
	return rows;
}

function lineLabel(item) {
	return String(item?.description || item?.item || item?.role || item?.name || "Line").trim() || "Line";
}

export function phase8Findings(opts) {
	const src = opts || {};
	const features = src.features || {};
	const out = [];
	const tasks = src.tasks || [];
	if (features.quotations === true) {
		const known = new Set((src.quotations || []).map((row) => row?.id));
		(src.quotationRefs || []).forEach((ref) => {
			if (ref?.quotationId && !known.has(ref.quotationId)) {
				out.push({
					id: "quote-missing",
					severity: "warning",
					message: `Quotation “${ref.quotationId}” is not in the library.`
				});
			}
		});
		tasks.forEach((task) => flattenSubs(task).forEach((sub) => {
			CATS.forEach((cat) => {
				(sub.items?.[cat] || []).forEach((item) => {
					if (!item?.quotationLineId || item.priceSource !== "quote") return;
					if (!(Number(item.dbPrice) > 0)) return;
					out.push({
						id: "quote-over-db",
						severity: "error",
						message: `Quote price used on “${lineLabel(item)}” while a database price exists.`,
						extra: { itemId: item.id, category: cat }
					});
				});
			});
		}));
	}
	if (features.availability === true) {
		const index = new Map((src.items || []).map((item) => [String(item?.id || ""), item]));
		tasks.forEach((task) => flattenSubs(task).forEach((sub) => {
			CATS.forEach((cat) => {
				(sub.items?.[cat] || []).forEach((item) => {
					const hit = index.get(String(item?.masterlistId || ""));
					if (!hit || hit.availabilityKey) return;
					out.push({
						id: "availability",
						severity: "info",
						message: `“${lineLabel(item)}” has no availability key.`,
						extra: { itemId: item.id }
					});
				});
			});
		}));
	}
	if (features.clientLocations === true) {
		const name = String(src.clientName || "").trim().toLowerCase();
		if (name) {
			const client = (src.clients || []).find((row) => {
				const full = String(row?.fullName || "").trim().toLowerCase();
				const code = String(row?.clientCode || "").trim().toLowerCase();
				return full === name || code === name;
			});
			if (client && !(Array.isArray(client.locations) && client.locations.length)) {
				out.push({
					id: "client-location",
					severity: "info",
					message: `Client “${client.fullName || client.clientCode}” has no location.`
				});
			}
		}
	}
	if (features.pendingRecords === true) {
		const open = new Set();
		(src.pendingRecords || []).forEach((record) => {
			if (record?.status !== "submitted" && record?.status !== "recommended") return;
			if (record.payload?.id) open.add(String(record.payload.id));
			if (record.replacesId) open.add(String(record.replacesId));
		});
		tasks.forEach((task) => flattenSubs(task).forEach((sub) => {
			CATS.forEach((cat) => {
				(sub.items?.[cat] || []).forEach((item) => {
					if (!open.has(String(item?.masterlistId || ""))) return;
					out.push({
						id: "pending-open",
						severity: "warning",
						message: `“${lineLabel(item)}” is still a pending record.`,
						extra: { itemId: item.id }
					});
				});
			});
		}));
	}
	return out;
}
