// @ts-nocheck
import { canSubmit } from "../lib/estimator/checker";

function rowActions(finding, props) {
	if (finding.action === "merge" && props.onMerge) {
		return <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => props.onMerge(finding)}>Merge</button>;
	}
	if (finding.action === "use-db" && props.onUseDb) {
		return <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => props.onUseDb(finding)}>Use DB item</button>;
	}
	if (finding.action === "spell") {
		return (
			<span>
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => props.onIgnoreOnce?.(finding.word)}>Ignore once</button>
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => props.onIgnoreCe?.(finding.word)}>Ignore in this CE</button>
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => props.onAddWord?.(finding.word)}>Add</button>
			</span>
		);
	}
	return null;
}

export function CheckerReportList({ report }) {
	const findings = report?.findings || [];
	if (!findings.length) return null;
	return (
		<div className="wiz-hint">
			<b>Checker on this version.</b>
			{report.ackReason ? <span> Reason: {report.ackReason}</span> : null}
			{findings.map((finding, index) => <p key={`${finding.rule}-${index}`}>{finding.severity}: {finding.message}</p>)}
		</div>
	);
}

export function CheckerPanel({ report, ackChecked, reason, onAck, onReason, onClose, onSubmit, readOnly, ...actions }) {
	const gate = canSubmit(report, { checked: ackChecked, reason });
	const errors = report?.errors || [];
	const warnings = report?.warnings || [];
	const info = report?.info || [];
	return (
		<div className="ce-confirm-backdrop" role="dialog" aria-modal="true">
			<div className="ce-confirm ce-picker-modal ce-checker">
				<h3 className="ce-serif">Pre-submit checker</h3>
				<p className="ce-empty" style={{ padding: 0, textAlign: "left" }}>Errors block Submit and final approval. Warnings need an acknowledgement and a reason. Info is only a list.</p>
				{!errors.length && !warnings.length && !info.length ? <p>No checker findings.</p> : null}
				{errors.map((finding, index) => (
					<p key={`e-${index}`} className="ce-checker-fail">{finding.message} {rowActions(finding, actions)}</p>
				))}
				{warnings.map((finding, index) => (
					<p key={`w-${index}`} className="ce-checker-warn">{finding.message} {rowActions(finding, actions)}</p>
				))}
				{info.length ? <h4 className="ce-serif">Info</h4> : null}
				{info.map((finding, index) => <p key={`i-${index}`}>{finding.message}</p>)}
				{warnings.length ? (
					<div>
						<label className="ce-picker-row">
							<input type="checkbox" checked={!!ackChecked} onChange={(e) => onAck?.(e.target.checked)} />
							<span>I acknowledge the warnings and still want to submit.</span>
						</label>
						<label className="wiz-field">
							<span className="ce-field-label">Reason</span>
							<textarea className="ce-input ce-notes-box" rows={2} value={reason || ""} onChange={(e) => onReason?.(e.target.value)} />
						</label>
					</div>
				) : null}
				<div className="ce-confirm-actions">
					<button type="button" className="ce-btn-ghost" onClick={onClose}>Back to editor</button>
					<button type="button" className="ce-btn-primary" disabled={!gate.ok || readOnly} onClick={onSubmit}>Submit for approval</button>
				</div>
			</div>
		</div>
	);
}
