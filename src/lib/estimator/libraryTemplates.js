/** Library labels, template strips, and sales preview. Revise keeps the number. */

/**
 * @param {boolean} flagOn
 * @param {"nav" | "ce" | "task"} kind
 */
export function libraryTabLabel(flagOn, kind) {
	if (flagOn !== true) {
		if (kind === "ce") return "Templates";
		if (kind === "task") return "Per Task Template";
		return "Scope Library";
	}
	if (kind === "ce") return "Cost Estimate";
	if (kind === "task") return "Per Task";
	return "Library";
}

/**
 * @param {any} doc
 * @param {{ removeClient?: boolean }} [opts]
 */
export function stripCeTemplate(doc, opts = {}) {
	const next = JSON.parse(JSON.stringify(doc || {}));
	if (opts.removeClient !== false) {
		if (next.projectInfo) {
			next.projectInfo.client = "";
			next.projectInfo.project = "";
			next.projectInfo.location = "";
		}
		next.client = "";
		next.project = "";
	}
	next.notes = "";
	next.attachments = [];
	next.attachmentFiles = [];
	next.approval = null;
	next.numberMode = "new";
	return next;
}

/**
 * @param {any} rce
 */
export function stripRceTemplate(rce) {
	const next = JSON.parse(JSON.stringify(rce || {}));
	next.customer = "";
	next.client = "";
	next.rceDate = "";
	next.inquiryDate = "";
	next.ceDeadline = "";
	next.submissionDeadline = "";
	next.attachments = [];
	next.attachmentFiles = [];
	next.preparedStamp = "";
	next.reviewedStamp = "";
	next.approvedStamp = "";
	next.approval = null;
	next.numberMode = "new";
	return next;
}

/**
 * @param {any} report
 */
export function stripOifTemplate(report) {
	const next = JSON.parse(JSON.stringify(report || {}));
	next.oifNo = "";
	next.date = "";
	next.signatures = [];
	next.inspectorSignature = "";
	next.approval = null;
	next.numberMode = "new";
	return next;
}

/**
 * @param {"revise" | "duplicate" | "use-as-new" | "start-from-template"} mode
 * @param {{ number?: unknown, rev?: unknown }} doc
 */
export function numberPlan(mode, doc) {
	const number = String(doc?.number || "");
	const rev = Math.max(0, Math.trunc(Number(doc?.rev) || 0));
	if (mode === "revise") return { number, rev: rev + 1, freshApproval: true, sameNumber: true };
	return { number: "", rev: 0, freshApproval: true, sameNumber: false };
}

/**
 * @param {{ rce?: any, ce?: any, markup?: any, proposal?: any }} docs
 */
export function previewDocs(docs) {
	/** @type {{ kind: string, id: string, status: string }[]} */
	const list = [];
	if (docs?.rce) list.push({ kind: "RCE", id: String(docs.rce.rceNo || docs.rce.id || ""), status: String(docs.rce.status || "") });
	if (docs?.ce) list.push({ kind: "CE", id: String(docs.ce.ceNo || docs.ce.id || ""), status: String(docs.ce.status || "") });
	if (docs?.markup) list.push({ kind: "Markup", id: String(docs.markup.markupNo || docs.markup.id || ""), status: String(docs.markup.status || "") });
	if (docs?.proposal) list.push({ kind: "Proposal", id: String(docs.proposal.prNo || docs.proposal.controlNo || docs.proposal.id || ""), status: String(docs.proposal.status || "") });
	return list;
}

/**
 * @param {any} data
 * @param {boolean} sales
 */
export function salesSafeExport(data, sales) {
	if (sales !== true) return data;
	const next = JSON.parse(JSON.stringify(data || {}));
	if (next.cover) {
		next.cover.omitContingency = true;
		next.cover.contingencyPct = 0;
		next.cover.hidePrices = next.cover.hidePrices === true;
	}
	next.salesSafe = true;
	return next;
}

/**
 * Tiny WordprocessingML reader for headings, bold, italic, lists, and tables.
 * PDF import is text only and is not parsed here.
 * @param {string} xml
 */
export function docxXmlToBlocks(xml) {
	const source = String(xml || "");
	/** @type {any[]} */
	const blocks = [];
	const tables = source.split(/<w:tbl[\s>]/).slice(1);
	tables.forEach((table) => {
		const rows = table.split(/<w:tr[\s>]/).slice(1).map((row) => row.split(/<w:tc[\s>]/).slice(1).map((cell) => cell.replace(/<[^>]+>/g, "").trim()));
		blocks.push({ type: "table", rows });
	});
	const body = source.split(/<w:tbl[\s>]/)[0] || "";
	body.split(/<w:p[\s>]/).slice(1).forEach((para) => {
		const text = [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]).join("");
		if (!text) return;
		const bold = /<w:b[\s/>]/.test(para);
		const italic = /<w:i[\s/>]/.test(para);
		const heading = /<w:pStyle[^>]*w:val="Heading/.test(para);
		const list = /<w:numPr[\s>]/.test(para);
		blocks.push({ type: heading ? "heading" : list ? "list" : "p", text, bold, italic });
	});
	return blocks;
}

export const PDF_IMPORT_NOTE = "PDF import brings text only; Word keeps formatting.";

/**
 * @param {any[]} list
 * @param {any} doc
 */
export function saveMethodology(list, doc) {
	const next = {
		...doc,
		versions: [{ at: String(doc?.updatedAt || ""), body: String(doc?.body || "") }, ...(doc?.versions || [])].slice(0, 20),
	};
	return [next, ...(list || []).filter((row) => row && row.id !== next.id)];
}

/**
 * @param {any[]} blocks
 * @returns {string}
 */
export function blocksToDocxXml(blocks) {
	const amp = "&" + "amp;";
	const lt = "&" + "lt;";
	const gt = "&" + "gt;";
	const paras = (blocks || []).map((block) => {
		const text = String(block?.text || "").replace(/&/g, amp).replace(/</g, lt).replace(/>/g, gt);
		const style = block?.type === "heading" ? "<w:pStyle w:val=\"Heading1\"/>" : "";
		const mark = `${block?.bold ? "<w:b/>" : ""}${block?.italic ? "<w:i/>" : ""}`;
		return `<w:p>${style}<w:r><w:rPr>${mark}</w:rPr><w:t>${text}</w:t></w:r></w:p>`;
	}).join("");
	return `<w:document><w:body>${paras}</w:body></w:document>`;
}
