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
 * @param {any[]} templates
 */
export function templateChoices(templates) {
	return (templates || []).filter(Boolean).map((row) => ({
		id: String(row.id || ""),
		name: String(row.name || "Template"),
		type: String(row.type || row.kind || row.jobType || ""),
		date: String(row.date || row.updatedAt || row.createdAt || "").slice(0, 10),
	}));
}

/**
 * The template the user picked, never the newest one by default.
 * @param {any[]} templates
 * @param {unknown} id
 */
export function chosenTemplate(templates, id) {
	const key = String(id || "");
	if (!key) return null;
	return (templates || []).find((row) => row && String(row.id || "") === key) || null;
}

/**
 * In-app PDF preview for one existing document. CE and Markup stay sales-safe.
 * @param {{ kind?: unknown, id?: unknown, status?: unknown }} doc
 */
export function docPreviewUrl(doc) {
	const id = String(doc?.id || "").trim();
	const kind = String(doc?.kind || "").trim();
	if (!id || !kind) return null;
	const label = `${kind} ${id}`.replace(/[()\\]/g, "");
	const stream = `BT 40 120 Td (${label}) Tj ET`;
	const pdf = `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 240]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
	const bytes = encodeURIComponent(pdf);
	return {
		kind,
		id,
		status: String(doc?.status || ""),
		salesSafe: kind === "CE" || kind === "Markup",
		downloadName: `${id}.pdf`,
		url: `data:application/pdf,${bytes}`,
	};
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
	/** @param {unknown} value */
	const esc = (value) => String(value || "").replace(/&/g, amp).replace(/</g, lt).replace(/>/g, gt);
	const paras = (blocks || []).map((/** @type {any} */ block) => {
		if (block?.type === "table") {
			const rows = (block.rows || []).map((/** @type {any} */ row) => `<w:tr>${(row || []).map((/** @type {any} */ cell) => `<w:tc><w:p><w:r><w:t>${esc(cell)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("");
			return `<w:tbl>${rows}</w:tbl>`;
		}
		const text = esc(block?.text);
		const style = block?.type === "heading" ? "<w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr>" : block?.type === "list" ? "<w:pPr><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr></w:pPr>" : "";
		const mark = `${block?.bold ? "<w:b/>" : ""}${block?.italic ? "<w:i/>" : ""}${block?.underline ? "<w:u w:val=\"single\"/>" : ""}`;
		return `<w:p>${style}<w:r><w:rPr>${mark}</w:rPr><w:t>${text}</w:t></w:r></w:p>`;
	}).join("");
	return `<w:document><w:body>${paras}</w:body></w:document>`;
}

/**
 * @param {Uint8Array} bytes
 */
function crc32(bytes) {
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i += 1) {
		crc ^= bytes[i];
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return (~crc) >>> 0;
}

/**
 * @param {number} value
 * @param {number} size
 */
function le(value, size) {
	const out = [];
	for (let i = 0; i < size; i += 1) out.push((value >>> (8 * i)) & 255);
	return out;
}

/**
 * Stored zip of a Word document so mammoth can read the same blocks.
 * @param {string} xml
 * @returns {Uint8Array}
 */
export function xmlToDocxBytes(xml) {
	const source = String(xml || "");
	const document = source.includes("xmlns:w") ? source : source.replace("<w:document>", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">");
	const files = [
		["[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"xml\" ContentType=\"application/xml\"/><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/word/numbering.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml\"/></Types>"],
		["_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"],
		["word/_rels/document.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering\" Target=\"numbering.xml\"/></Relationships>"],
		["word/numbering.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><w:numbering xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:abstractNum w:abstractNumId=\"0\"><w:lvl w:ilvl=\"0\"><w:start w:val=\"1\"/><w:numFmt w:val=\"bullet\"/><w:lvlText w:val=\"*\"/></w:lvl></w:abstractNum><w:num w:numId=\"1\"><w:abstractNumId w:val=\"0\"/></w:num></w:numbering>"],
		["word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${document}`],
	];
	/** @type {number[]} */
	const local = [];
	/** @type {number[]} */
	const central = [];
	files.forEach(([name, text]) => {
		const nameBytes = Array.from(new TextEncoder().encode(name));
		const data = Array.from(new TextEncoder().encode(text));
		const crc = crc32(Uint8Array.from(data));
		const offset = local.length;
		local.push(...le(0x04034b50, 4), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameBytes.length, 2), ...le(0, 2), ...nameBytes, ...data);
		central.push(...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameBytes.length, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(offset, 4), ...nameBytes);
	});
	const start = local.length;
	const all = [...local, ...central, ...le(0x06054b50, 4), ...le(0, 2), ...le(0, 2), ...le(files.length, 2), ...le(files.length, 2), ...le(central.length, 4), ...le(start, 4), ...le(0, 2)];
	return Uint8Array.from(all);
}

/**
 * @param {string} html
 */
export function htmlToBlocks(html) {
	const source = String(html || "");
	/** @type {any[]} */
	const blocks = [];
	/** @param {unknown} value */
	const plain = (value) => String(value || "").replace(/<[^>]+>/g, "").trim();
	const tables = source.match(/<table[\s\S]*?<\/table>/gi) || [];
	tables.forEach((table) => {
		const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) => [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => plain(cell[1])));
		blocks.push({ type: "table", rows });
	});
	const rest = source.replace(/<table[\s\S]*?<\/table>/gi, "");
	[...rest.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)].forEach((match) => {
		blocks.push({ type: "heading", text: plain(match[1]), bold: /<(strong|b)[\s>]/i.test(match[1]) || true, italic: /<(em|i)[\s>]/i.test(match[1]) });
	});
	[...rest.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].forEach((match) => {
		blocks.push({ type: "list", text: plain(match[1]), bold: /<(strong|b)[\s>]/i.test(match[1]), italic: /<(em|i)[\s>]/i.test(match[1]) });
	});
	[...rest.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].forEach((match) => {
		const text = plain(match[1]);
		if (!text) return;
		blocks.push({ type: "p", text, bold: /<(strong|b)[\s>]/i.test(match[1]), italic: /<(em|i)[\s>]/i.test(match[1]) });
	});
	return blocks;
}

/**
 * @param {Uint8Array | ArrayBuffer} bytes
 */
export async function importDocxBlocks(bytes) {
	const mammoth = await import("mammoth");
	const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
	return htmlToBlocks(result.value);
}
