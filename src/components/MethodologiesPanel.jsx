import { useState } from "react";
import { PDF_IMPORT_NOTE, blocksToDocxXml, bodyToHtml, decideMethodology, docxXmlToBlocks, htmlToBlocks, importDocxBlocks, saveMethodology, submitMethodology, xmlToDocxBytes } from "../lib/estimator/libraryTemplates";
import { MethodologyEditor } from "./MethodologyEditor";
import jsPDFDefault, { jsPDF as jsPDFNamed } from "jspdf";

const TAGS = ["On-site", "Shopwork", "Trading", "Electrical", "Mechanical"];

/**
 * @param {unknown} html
 */
function plainBody(html) {
	const amp = "&" + "amp;";
	const lt = "&" + "lt;";
	const gt = "&" + "gt;";
	return String(html || "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.split(amp).join("&")
		.split(lt).join("<")
		.split(gt).join(">")
		.trim();
}

/**
 * @param {{ items?: any[], onChange?: (items: any[]) => void, onInsert?: (text: string) => void, rich?: boolean, actor?: string, level?: string }} props
 */
export function MethodologiesPanel({ items = [], onChange, onInsert, rich = false, actor = "", level = "" }) {
	const [query, setQuery] = useState("");
	const [currentId, setCurrentId] = useState(items[0]?.id || "");
	const [note, setNote] = useState("");
	const current = items.find((row) => row.id === currentId) || null;
	const shown = items.filter((/** @type {any} */ row) => !query || String(row.name || "").toLowerCase().includes(query.toLowerCase()) || (row.tags || []).some((/** @type {any} */ tag) => String(tag).toLowerCase().includes(query.toLowerCase())));
	function write(/** @type {any} */ next) {
		onChange?.(saveMethodology(items, { ...next, updatedAt: new Date().toISOString() }));
		setNote("Saved");
	}
	function add() {
		const doc = { id: `method-${Date.now()}`, name: "New methodology", tags: [], body: "", html: "<p></p>", versions: [], page: { margin: "2.54cm", pageNumbers: false } };
		onChange?.(saveMethodology(items, doc));
		setCurrentId(doc.id);
	}
	function exportDocx() {
		if (!current) return;
		const blocks = current.blocks?.length ? current.blocks : htmlToBlocks(current.html || bodyToHtml(current.body || ""));
		const bytes = xmlToDocxBytes(blocksToDocxXml(blocks.length ? blocks : [{ type: "p", text: current.body || "", bold: true }]));
		const part = /** @type {BlobPart} */ (/** @type {unknown} */ (bytes));
		const blob = new Blob([part], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${current.name || "methodology"}.docx`;
		link.click();
		URL.revokeObjectURL(url);
	}
	function exportPdf() {
		if (!current) return;
		const Pdf = typeof jsPDFNamed === "function" ? jsPDFNamed : jsPDFDefault;
		const pdf = new Pdf();
		const lines = plainBody(current.html || current.body).split("\n");
		lines.forEach((line, index) => pdf.text(line || " ", 14, 20 + index * 8));
		if (current.page?.pageNumbers) pdf.text(String(pdf.getNumberOfPages()), 180, 280);
		pdf.save(`${current.name || "methodology"}.pdf`);
	}
	return (
		<div className="method-wrap">
			<div className="method-list">
				<input className="ce-input" aria-label="Search methodologies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
				<button type="button" className="ce-btn-primary ce-btn-sm" onClick={add}>+ New methodology</button>
				{shown.map((row) => (
					<button key={row.id} type="button" className={"ce-navitem" + (row.id === currentId ? " ce-navitem-active" : "")} onClick={() => setCurrentId(row.id)}>{row.name}</button>
				))}
			</div>
			{current ? (
				<div className="ce-card method-editor">
					<input className="ce-input" aria-label="Methodology name" value={current.name || ""} onChange={(event) => write({ ...current, name: event.target.value })} />
					<div className="method-tags">
						{TAGS.map((tag) => (
							<button key={tag} type="button" className={"ce-pill" + ((current.tags || []).includes(tag) ? " ce-pill-active" : "")} onClick={() => {
								const tags = new Set(current.tags || []);
								if (tags.has(tag)) tags.delete(tag);
								else tags.add(tag);
								write({ ...current, tags: [...tags] });
							}}>{tag}</button>
						))}
					</div>
					{rich ? (
						<MethodologyEditor
							html={current.html || current.body || ""}
							page={current.page}
							onChange={(html) => write({ ...current, html, body: plainBody(html), blocks: htmlToBlocks(html) })}
							onPage={(page) => write({ ...current, page })}
						/>
					) : (
						<textarea className="ce-input method-body" aria-label="Methodology" value={current.body || ""} onChange={(event) => write({ ...current, body: event.target.value })} />
					)}
					<p className="wiz-hint">{note || "Edits save on this account."} {PDF_IMPORT_NOTE}</p>
					<p className="wiz-hint">Approval: {current.approval?.status || "Draft"}{current.approval?.decidedBy ? ` · ${current.approval.decidedBy}` : ""}</p>
					{(current.versions || []).length ? (
						<ul aria-label="Version history">
							{(current.versions || []).slice(0, 8).map((/** @type {any} */ row) => (
								<li key={`${row.at}-${row.status || ""}`}>{row.status || "Saved"} · {row.at}</li>
							))}
						</ul>
					) : null}
					<div className="ce-header-actions">
						<label className="ce-btn-ghost ce-btn-sm">Import
							<input type="file" accept=".xml,.docx,.pdf,text/xml,application/pdf" hidden onChange={(event) => {
								const file = event.target.files?.[0];
								if (!file) return;
								const reader = new FileReader();
								reader.onload = () => {
									const run = async () => {
										if (file.name.toLowerCase().endsWith(".docx")) {
											const blocks = await importDocxBlocks(/** @type {ArrayBuffer} */ (reader.result));
											const body = blocks.map((/** @type {any} */ block) => block.type === "table" ? (block.rows || []).map((/** @type {any} */ row) => row.join(" | ")).join("\n") : block.text || "").filter(Boolean).join("\n");
											write({ ...current, body: `${current.body || ""}\n${body}`.trim(), html: bodyToHtml(body), blocks });
											return;
										}
										const text = String(reader.result || "");
										if (file.name.toLowerCase().endsWith(".pdf") || text.indexOf("%PDF") === 0) {
											let plain = "";
											for (const ch of text) {
												const code = ch.charCodeAt(0);
												plain += code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) ? ch : " ";
											}
											write({ ...current, body: `${current.body || ""}\n${plain.slice(0, 4000)}` });
											setNote(PDF_IMPORT_NOTE);
											return;
										}
										const blocks = docxXmlToBlocks(text);
										write({ ...current, body: blocks.map((block) => block.text || "").filter(Boolean).join("\n") || current.body, blocks });
									};
									void run();
								};
								if (file.name.toLowerCase().endsWith(".docx")) reader.readAsArrayBuffer(file);
								else reader.readAsText(file);
							}} />
						</label>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={exportDocx}>Export .docx</button>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={exportPdf}>Export PDF</button>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => {
							const result = submitMethodology(current, { by: actor || "sales" });
							if (!result.ok || !result.doc) { setNote(result.message || "Not submitted"); return; }
							write(result.doc);
							setNote("Submitted for approval");
						}}>Submit for approval</button>
						<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => {
							const result = decideMethodology(current, { actor: actor || "approver", level, decision: "approve" });
							if (!result.ok || !result.doc) { setNote(result.message || "Not approved"); return; }
							write(result.doc);
						}}>Approve</button>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => {
							const result = decideMethodology(current, { actor: actor || "approver", level, decision: "reject" });
							if (!result.ok || !result.doc) { setNote(result.message || "Not rejected"); return; }
							write(result.doc);
						}}>Reject</button>
						<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onInsert?.(current.body || plainBody(current.html))}>Insert into CE / proposal</button>
					</div>
				</div>
			) : <p className="ce-empty">No methodologies yet.</p>}
		</div>
	);
}
