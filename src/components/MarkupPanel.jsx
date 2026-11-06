import { actorMayDecideMarkup, markupPercentsOpen, markupSheetRows } from "../lib/estimator/markup";
import { personName } from "../lib/estimator/departments";
import { askReason } from "../lib/estimator/reasonBox";
import * as XLSX from "xlsx";
import jsPDFDefault, { jsPDF as jsPDFNamed } from "jspdf";

/** @param {unknown} value */
function money(value) {
	return Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * @param {{ label: string, value: number, disabled: boolean, onChange: (value: string) => void }} props
 */
function Field({ label, value, disabled, onChange }) {
	return (
		<label className="wiz-field">
			<span className="ce-field-label">{label}</span>
			<input className="ce-input" type="number" step="0.01" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
		</label>
	);
}

/**
 * @param {{ markup: any, sales: boolean, actorId: string, users?: unknown[], onMarkup?: (action: string, payload?: any) => void }} props
 */
export function MarkupPanel({ markup, sales, actorId, users, onMarkup }) {
	if (!markup) return null;
	const open = markupPercentsOpen(markup);
	const parts = markup.parts || { profit: 0, contingency: 0, markup: 0 };
	const mayDecide = actorMayDecideMarkup(markup, actorId);
	const holder = markup.status === "For approval" ? markup.steps?.[markup.currentIndex] : null;
	const name = (/** @type {unknown} */ id) => personName(id, users) || "Unnamed";

	/** @param {string} key @param {string} value */
	function setPart(key, value) {
		if (!open) return;
		onMarkup?.("parts", { parts: { ...parts, [key]: value } });
	}

	function downloadExcel() {
		const book = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(markupSheetRows(markup)), "Markup");
		XLSX.writeFile(book, `${markup.markupNo || "markup"}.xlsx`);
	}

	function downloadPdf() {
		const Pdf = typeof jsPDFNamed === "function" ? jsPDFNamed : jsPDFDefault;
		const pdf = new Pdf();
		markupSheetRows(markup).forEach((row, index) => pdf.text(`${row[0]}: ${row[1]}`, 14, 20 + index * 8));
		pdf.save(`${markup.markupNo || "markup"}.pdf`);
	}

	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Markup</h3>
			<p className="ce-mono">Markup no. {markup.markupNo || ""}</p>
			<p className="wiz-hint">Direct cost only. Selling = direct cost × (1 + profit + contingency + mark up).</p>
			<p>Direct cost {money(markup.directCost)}</p>
			<p>Selling {money(markup.selling)} · {markup.status}</p>
			{markup.approverFor ? <p className="wiz-hint">Signature {markup.approverFor}</p> : null}
			<div className="wiz-grid">
				{["100", "75", "65"].map((preset) => (
					<button key={preset} type="button" className="ce-btn-ghost ce-btn-sm" disabled={!open} onClick={() => onMarkup?.("preset", { preset })}>
						{preset}%
					</button>
				))}
			</div>
			<div className="wiz-grid">
				<Field label="Profit margin %" value={parts.profit} disabled={!open} onChange={(value) => setPart("profit", value)} />
				<Field label="Contingency %" value={parts.contingency} disabled={!open} onChange={(value) => setPart("contingency", value)} />
				<Field label="Mark up %" value={parts.markup} disabled={!open} onChange={(value) => setPart("markup", value)} />
			</div>
			{holder ? <p className="wiz-hint">Waiting for {name(holder.userId)}{holder.backupUserId ? ` (backup ${name(holder.backupUserId)})` : ""}</p> : null}
			{open && sales && actorId === markup.ownerId ? (
				<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onMarkup?.("submit")}>Submit markup</button>
			) : null}
			{sales && actorId === markup.ownerId && (markup.status === "Approved" || markup.status === "Returned") ? (
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onMarkup?.("revise")}>Revise markup</button>
			) : null}
			<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={downloadExcel}>Excel</button>
			<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={downloadPdf}>PDF</button>
			{mayDecide ? (
				<span>
					<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onMarkup?.("approve")}>Approve markup</button>
					{" "}
					<button
						type="button"
						className="ce-btn-ghost ce-btn-sm"
						onClick={() => {
							void askReason({ title: "Return markup", label: "Return remark", required: true }).then((result) => {
								if (!result.ok) return;
								onMarkup?.("return", { remarks: result.text });
							});
						}}
					>
						Return markup
					</button>
				</span>
			) : null}
			{(markup.timeline || []).length ? (
				<ul>
					{(markup.timeline || []).map((/** @type {any} */ row) => (
						<li key={row.id}>{row.action} · {name(row.who)}{row.remarks ? ` · ${row.remarks}` : ""}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
