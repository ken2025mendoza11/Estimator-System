// @ts-nocheck
/**
 * TEST seed only: the cost_estimates and ce_documents rows that
 * save_workspace_doc writes as its mirror (same mapping as ceMirror in
 * src/lib/estimator/supabase-workspace.ts). With these rows present, the
 * ce_documents approval trigger compares a later save against the seeded
 * approval instead of treating every seeded signature as new.
 */

function text(value) {
	const out = String(value ?? "").trim();
	return out ? out : null;
}

function day(value) {
	const out = String(value ?? "").trim();
	return /^\d{4}-\d{2}-\d{2}/.test(out) ? out.slice(0, 10) : null;
}

export function ceMirrorRows(id, payload, rceIds) {
	const body = payload && typeof payload === "object" ? payload : {};
	const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
	const document = body.document && typeof body.document === "object" ? body.document : null;
	if (!summary.id) return null;
	const rceId = String(summary.rceId || "");
	const estimate = {
		id,
		rce_id: rceId && rceIds.has(rceId) ? rceId : null,
		client: text(summary.client),
		location: text(summary.location),
		project: text(summary.project),
		status: String(summary.status || "Draft"),
		last_edited: day(summary.lastEdited),
		last_edited_by: text(summary.lastEditedBy),
	};
	if (!document) return { estimate, document: null };
	return {
		estimate,
		document: {
			ce_id: id,
			meta: document.meta ?? {},
			sow_text: String(document.sowText || ""),
			ce_status: text(document.ceStatus || document.status),
			view_type: text(document.viewType),
			doc_no: text(document.docNo),
			rev_no: text(document.revNo),
			rev_date: day(document.revDate),
			file_attachments: document.fileAttachments ?? {},
			summary_task_filters: document.summaryTaskFilters ?? {},
			document,
		},
	};
}
