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
		}
	}
	return { markups, proposals, jobOrders, schema, roster, notifications, notifyMatrix };
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
 * The label is taken from the stored document. Free text from the client is not used.
 * @param {{ proposals?: any[], markups?: any[], jobOrders?: any[] } | null | undefined} documents
 * @param {unknown} docId
 * @returns {string}
 */
export function storedDocumentLabel(documents, docId) {
	const id = String(docId || "").trim();
	if (!id) return "";
	const rows = [
		...(documents?.jobOrders || []),
		...(documents?.proposals || []),
		...(documents?.markups || []),
	];
	const hit = rows.find((doc) => doc && [doc.id, doc.controlNo, doc.joNo, doc.ceId].some((/** @type {unknown} */ value) => String(value || "") === id));
	if (!hit) return "";
	return String(hit.joNo || hit.controlNo || hit.ceId || hit.id || "");
}
