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
		}
	}
	return { markups, proposals, jobOrders, schema, roster };
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {typeof fetch} [fetchImpl]
 */
export async function loadRelease1Store(env = process.env, fetchImpl = fetch) {
	const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/$/, "");
	const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
	if (!url || !key) return { ok: false, message: "The document store is not configured." };
	const response = await fetchImpl(`${url}/rest/v1/workspace_docs?kind=in.(proposal,markup,schema,admin)&deleted_at=is.null&select=kind,doc_id,payload,version`, {
		headers: { apikey: key, Authorization: `Bearer ${key}` },
	});
	if (!response.ok) return { ok: false, message: "The document store could not be read." };
	const rows = await response.json();
	const documents = documentsFromRows(Array.isArray(rows) ? rows : []);
	return { ok: true, documents, rows: Array.isArray(rows) ? rows : [], url, key };
}

/**
 * @param {{ rows?: any[], url?: string, key?: string }} loaded
 * @param {{ markups?: any[], proposals?: any[], jobOrders?: any[] }} documents
 * @param {typeof fetch} [fetchImpl]
 */
export async function saveRelease1Store(loaded, documents, fetchImpl = fetch) {
	const rows = Array.isArray(loaded?.rows) ? loaded.rows : [];
	const url = String(loaded?.url || "");
	const key = String(loaded?.key || "");
	if (!url || !key) return { ok: false, message: "The document store is not configured." };
	const headers = {
		apikey: key,
		Authorization: `Bearer ${key}`,
		"Content-Type": "application/json",
		Prefer: "return=minimal",
	};
	const write = async (/** @type {string} */ kind, /** @type {string} */ id, /** @type {any} */ payload, /** @type {number} */ version) => {
		await fetchImpl(`${url}/rest/v1/workspace_docs?kind=eq.${encodeURIComponent(kind)}&doc_id=eq.${encodeURIComponent(id)}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify({ payload, version: version + 1 }),
		});
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
			await write("schema", String(schema.doc_id || "company"), payload, Number(schema.version) || 0);
		}
	}
	return { ok: true };
}
