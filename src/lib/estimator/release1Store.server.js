/** Server read and save for Release 1 documents. Uses the service role. Never logs the key. */

/**
 * @param {unknown[]} rows
 */
export function documentsFromRows(rows) {
	/** @type {any[]} */
	const markups = [];
	/** @type {any[]} */
	const proposals = [];
	/** @type {any[]} */
	let jobOrders = [];
	/** @type {any} */
	let schema = null;
	/** @type {any[]} */
	let notifications = [];
	/** @type {unknown} */
	let notifyMatrix = null;
	/** @type {any[]} */
	let roster = [];
	/** @type {any[]} */
	const ces = [];
	for (const row of rows || []) {
		if (!row || typeof row !== "object") continue;
		const item = /** @type {{ kind?: string, payload?: any }} */ (row);
		if (item.kind === "markup" && item.payload) markups.push(item.payload);
		else if (item.kind === "proposal" && item.payload) proposals.push(item.payload);
		else if (item.kind === "schema") {
			schema = row;
			const orders = item.payload?.__app?.jobOrders;
			jobOrders = Array.isArray(orders) ? orders : [];
		} else if (item.kind === "admin") {
			const users = item.payload?.users;
			roster = Array.isArray(users) ? users : [];
			notifyMatrix = item.payload?.notifyMatrix ?? null;
		} else if (item.kind === "notifications") {
			notifications = Array.isArray(item.payload) ? item.payload : [];
		} else if (item.kind === "ce") {
			const full = /** @type {{ doc_id?: string, payload?: any }} */ (row);
			const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
			ces.push({ id: String(full.doc_id || ""), ...payload });
		}
	}
	return { markups, proposals, jobOrders, schema, roster, notifications, notifyMatrix, ces };
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {typeof fetch} [fetchImpl]
 */
export async function loadRelease1Store(env = process.env, fetchImpl = fetch) {
	const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
	const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
	if (!url || !key) return { ok: false, message: "The document store is not configured." };
	const response = await fetchImpl(`${url}/rest/v1/workspace_docs?kind=in.(proposal,markup,schema,admin,notifications)&deleted_at=is.null&select=kind,doc_id,payload,version`, {
		headers: { apikey: key, Authorization: `Bearer ${key}` },
	});
	if (!response.ok) return { ok: false, message: "The document store could not be read." };
	const rows = await response.json();
	const documents = documentsFromRows(Array.isArray(rows) ? rows : []);
	return { ok: true, documents, rows: Array.isArray(rows) ? rows : [], url, key };
}

/**
 * One stored cost estimate. The mail route uses this for the CE-approved template.
 * @param {Record<string, string | undefined>} [env]
 * @param {typeof fetch} [fetchImpl]
 * @param {unknown} [docId]
 */
export async function loadStoredCe(env = process.env, fetchImpl = fetch, docId) {
	const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
	const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
	const id = String(docId || "").trim();
	if (!url || !key || !id) return [];
	const response = await fetchImpl(`${url}/rest/v1/workspace_docs?kind=eq.ce&doc_id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=kind,doc_id,payload,version`, {
		headers: { apikey: key, Authorization: `Bearer ${key}` },
	});
	if (!response.ok) return [];
	const rows = await response.json();
	return documentsFromRows(Array.isArray(rows) ? rows : []).ces;
}

/**
 * Write only when the stored version still matches. An empty update is a conflict.
 * @param {{ rows?: any[], url?: string, key?: string }} loaded
 * @param {{ markups?: any[], proposals?: any[], jobOrders?: any[], notifications?: any[] }} documents
 * @param {typeof fetch} [fetchImpl]
 */
export async function saveRelease1Store(loaded, documents, fetchImpl = fetch) {
	const rows = Array.isArray(loaded?.rows) ? loaded.rows : [];
	const url = String(loaded?.url || "");
	const key = String(loaded?.key || "");
	/** @type {{ kind: string, id: string }[]} */
	const saved = [];
	/** @type {{ kind: string, id: string, conflict?: boolean }[]} */
	const failed = [];
	if (!url || !key) return { ok: false, message: "The document store is not configured.", saved, failed };
	const headers = {
		apikey: key,
		Authorization: `Bearer ${key}`,
		"Content-Type": "application/json",
		Prefer: "return=representation",
	};
	const write = async (/** @type {string} */ kind, /** @type {string} */ id, /** @type {any} */ payload, /** @type {number} */ version) => {
		const current = Number(version) || 0;
		/** @type {{ ok?: boolean, json?: () => Promise<unknown> } | null} */
		let response = null;
		try {
			response = await fetchImpl(`${url}/rest/v1/workspace_docs?kind=eq.${encodeURIComponent(kind)}&doc_id=eq.${encodeURIComponent(id)}&version=eq.${current}`, {
				method: "PATCH",
				headers,
				body: JSON.stringify({ payload, version: current + 1 }),
			});
		} catch {
			failed.push({ kind, id });
			return false;
		}
		if (!response || response.ok !== true) {
			failed.push({ kind, id });
			return false;
		}
		const body = typeof response.json === "function" ? await response.json().catch(() => null) : null;
		if (!Array.isArray(body) || body.length === 0) {
			failed.push({ kind, id, conflict: true });
			return false;
		}
		saved.push({ kind, id });
		return true;
	};
	for (const kind of ["markup", "proposal"]) {
		const list = kind === "markup" ? documents?.markups || [] : documents?.proposals || [];
		for (const doc of list) {
			const id = String(doc?.id || doc?.controlNo || doc?.ceId || "");
			if (!id) continue;
			const row = rows.find((item) => item?.kind === kind && item?.doc_id === id);
			if (!row) continue;
			if (JSON.stringify(row.payload) === JSON.stringify(doc)) continue;
			await write(kind, id, doc, Number(row.version) || 0);
		}
	}
	const schema = rows.find((item) => item?.kind === "schema");
	if (schema && documents?.jobOrders) {
		const payload = schema.payload && typeof schema.payload === "object" ? { ...schema.payload } : {};
		const app = payload.__app && typeof payload.__app === "object" ? { ...payload.__app } : {};
		if (JSON.stringify(app.jobOrders || []) !== JSON.stringify(documents.jobOrders)) {
			payload.__app = { ...app, jobOrders: documents.jobOrders };
			const wrote = await write("schema", String(schema.doc_id || "company"), payload, Number(schema.version) || 0);
			for (const jo of documents.jobOrders) {
				const id = String(jo?.id || jo?.joNo || "");
				if (!id) continue;
				if (wrote) saved.push({ kind: "jobOrder", id });
				else failed.push({ kind: "jobOrder", id });
			}
		}
	}
	const notes = rows.find((item) => item?.kind === "notifications");
	if (Array.isArray(documents?.notifications)) {
		if (!notes) {
			if (documents.notifications.length > 0) failed.push({ kind: "notifications", id: "company" });
		} else if (JSON.stringify(notes.payload || []) !== JSON.stringify(documents.notifications)) {
			await write("notifications", String(notes.doc_id || "company"), documents.notifications, Number(notes.version) || 0);
		}
	}
	return { ok: failed.length === 0, saved, failed };
}

/**
 * The label is taken from the stored document of that kind. Free text from the client is not used.
 * A markup is not labelled with a proposal or job order that shares the same estimate.
 * @param {{ proposals?: any[], markups?: any[], jobOrders?: any[], ces?: any[] } | null | undefined} documents
 * @param {unknown} docId
 * @param {unknown} [kind]
 * @returns {string}
 */
export function storedDocumentLabel(documents, docId, kind) {
	const id = String(docId || "").trim();
	if (!id) return "";
	const wanted = String(kind || "").trim().toLowerCase();
	if (wanted === "ce") {
		const hit = (documents?.ces || []).find((/** @type {any} */ row) => ceMatches(row, id));
		return hit ? ceNumber(hit) : "";
	}
	if (wanted === "markup" || wanted === "proposal" || wanted === "joborder" || wanted === "job-order") {
		const list = wanted === "markup" ? documents?.markups : wanted === "proposal" ? documents?.proposals : documents?.jobOrders;
		const hit = (list || []).find((/** @type {any} */ doc) => doc && [doc.id, doc.controlNo, doc.joNo, doc.ceId].some((/** @type {unknown} */ value) => String(value || "") === id));
		if (!hit) return "";
		if (wanted === "markup") return String(hit.ceId || hit.id || "");
		if (wanted === "proposal") return String(hit.controlNo || hit.id || "");
		return String(hit.joNo || hit.id || "");
	}
	const rows = [
		...(documents?.jobOrders || []),
		...(documents?.proposals || []),
		...(documents?.markups || []),
	];
	const hit = rows.find((doc) => doc && [doc.id, doc.controlNo, doc.joNo, doc.ceId].some((/** @type {unknown} */ value) => String(value || "") === id));
	if (!hit) return "";
	return String(hit.joNo || hit.controlNo || hit.ceId || hit.id || "");
}

/**
 * @param {any} row
 * @param {string} id
 */
function ceMatches(row, id) {
	const summary = row?.summary && typeof row.summary === "object" ? row.summary : {};
	const document = row?.document && typeof row.document === "object" ? row.document : {};
	return [row?.id, summary.id, document.id].some((/** @type {unknown} */ value) => String(value || "") === id);
}

/**
 * The CE number shown on the estimate. The account id is not a number.
 * @param {any} row
 */
function ceNumber(row) {
	const summary = row?.summary && typeof row.summary === "object" ? row.summary : {};
	const document = row?.document && typeof row.document === "object" ? row.document : {};
	const info = document.projectInfo && typeof document.projectInfo === "object" ? document.projectInfo : {};
	const number = String(info.docNo || document.docNo || document.ceNumber || summary.docNo || summary.ceNumber || summary.ceDisplay || "").trim();
	return number || String(summary.id || row?.id || "").trim();
}
