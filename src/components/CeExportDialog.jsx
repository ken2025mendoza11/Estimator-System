import { useState } from "react";
import { EXPORT_PARTS, defaultExportPlan } from "../lib/estimator/csvImport";

/**
 * The Part 5 export dialog. It does not open the cost estimate.
 * @param {{
 *   request: { ceId: string, salesSafe?: boolean } | null,
 *   onClose: () => void,
 *   onExport: (request: { ceId: string, salesSafe?: boolean }, plan: any) => void,
 * }} props
 */
export function CeExportDialog({ request, onClose, onExport }) {
	const [plan, setPlan] = useState(() => defaultExportPlan());
	if (!request) return null;
	return (
		<div className="ce-modal-overlay" onClick={onClose}>
			<div className="ce-modal-card" role="dialog" aria-label="Export" onClick={(event) => event.stopPropagation()}>
				<h3 className="ce-serif" style={{ marginTop: 0 }}>Export {request.ceId}</h3>
				{request.salesSafe ? <p className="wiz-hint">Sales-safe output. Contingency stays off the cover.</p> : null}
				<div className="ce-summary-toggle">
					{["pdf", "excel", "both"].map((format) => (
						<button key={format} type="button" className={"ce-pill" + (plan.format === format ? " ce-pill-active" : "")} onClick={() => setPlan({ ...plan, format })}>{format === "pdf" ? "PDF" : format === "excel" ? "Excel" : "Both"}</button>
					))}
				</div>
				<div className="ce-summary-toggle">
					<button type="button" className={"ce-pill" + (plan.whole ? " ce-pill-active" : "")} onClick={() => setPlan({ ...plan, whole: true })}>Whole CE</button>
					<button type="button" className={"ce-pill" + (!plan.whole ? " ce-pill-active" : "")} onClick={() => setPlan({ ...plan, whole: false })}>Selected parts</button>
				</div>
				{!plan.whole ? (
					<div className="ce-form-grid">
						{EXPORT_PARTS.map((part) => (
							<label key={part.id} className="ce-checkbox-row">
								<input type="checkbox" checked={plan.parts.includes(part.id)} onChange={() => setPlan({ ...plan, parts: plan.parts.includes(part.id) ? plan.parts.filter((id) => id !== part.id) : [...plan.parts, part.id] })} />
								{part.label}
							</label>
						))}
					</div>
				) : null}
				<label className="ce-checkbox-row"><input type="checkbox" checked={plan.hidePrices === true} onChange={() => setPlan({ ...plan, hidePrices: !plan.hidePrices })} /> Hide prices</label>
				<label className="ce-checkbox-row"><input type="checkbox" checked={plan.includeSignatures !== false} onChange={() => setPlan({ ...plan, includeSignatures: !plan.includeSignatures })} /> Include signatures</label>
				<div className="ce-confirm-actions">
					<button type="button" className="ce-btn-ghost" onClick={onClose}>Cancel</button>
					<button type="button" className="ce-btn-primary" onClick={() => onExport(request, plan)}>Export</button>
				</div>
			</div>
		</div>
	);
}
