import { actorMayDecideMarkup, markupPercentsOpen } from "../lib/estimator/markup";

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
 * @param {{ markup: any, sales: boolean, actorId: string, onMarkup?: (action: string, payload?: any) => void }} props
 */
export function MarkupPanel({ markup, sales, actorId, onMarkup }) {
	if (!markup) return null;
	const open = markupPercentsOpen(markup);
	const parts = markup.parts || { profit: 0, contingency: 0, markup: 0 };
	const mayDecide = actorMayDecideMarkup(markup, actorId);
	const holder = markup.status === "For approval" ? markup.steps?.[markup.currentIndex] : null;

	/** @param {string} key @param {string} value */
	function setPart(key, value) {
		if (!open) return;
		onMarkup?.("parts", { parts: { ...parts, [key]: value } });
	}

	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Markup</h3>
			<p className="wiz-hint">Direct cost only. Selling = direct cost × (1 + profit + contingency + mark up).</p>
			<p>Direct cost {money(markup.directCost)}</p>
			<p>Selling {money(markup.selling)} · {markup.status}</p>
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
			{holder ? <p className="wiz-hint">Waiting for {holder.userId}{holder.backupUserId ? ` (backup ${holder.backupUserId})` : ""}</p> : null}
			{open && sales && actorId === markup.ownerId ? (
				<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onMarkup?.("submit")}>Submit markup</button>
			) : null}
			{mayDecide ? (
				<span>
					<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onMarkup?.("approve")}>Approve markup</button>
					{" "}
					<button
						type="button"
						className="ce-btn-ghost ce-btn-sm"
						onClick={() => {
							const remarks = window.prompt("Return remark (required)");
							if (!remarks || !String(remarks).trim()) return;
							onMarkup?.("return", { remarks: String(remarks).trim() });
						}}
					>
						Return markup
					</button>
				</span>
			) : null}
			{(markup.timeline || []).length ? (
				<ul>
					{(markup.timeline || []).map((/** @type {any} */ row) => (
						<li key={row.id}>{row.action} · {row.who}{row.remarks ? ` · ${row.remarks}` : ""}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
