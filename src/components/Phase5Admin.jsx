// @ts-nocheck
import { useState } from "react";

const FLAGS = [
	["monitoringFamilies", "One monitoring row per CE family"],
	["docSuffixes", "Alternates, addendums, update copies, and urgent tag"],
	["scopeLibraryV2", "Scope library owner, Official tag, usage, and resources"],
	["priceCheck", "Price check on clones"],
	["branding", "Holiday list and branding colors"]
];

function linesOf(value) {
	return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function LineList({ label, value, onCommit }) {
	const [text, setText] = useState((value || []).join("\n"));
	return (
		<label className="wiz-field">
			<span className="ce-field-label">{label}</span>
			<textarea
				className="ce-input"
				rows={4}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onBlur={() => onCommit(linesOf(text))}
			/>
		</label>
	);
}

export function Phase5Admin({ cfg, patch }) {
	const features = cfg.features || {};
	const branding = cfg.branding || {};
	function setFlag(key, checked) {
		patch({ features: { ...features, [key]: checked === true } });
	}
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Phase 5</h3>
			<p className="wiz-hint">Each switch is off until it is checked. Off keeps today's monitoring, numbers, scope templates, clone, and colors.</p>
			{FLAGS.map(([key, label]) => (
				<label key={key} className="ce-picker-row">
					<input type="checkbox" checked={features[key] === true} onChange={(e) => setFlag(key, e.target.checked)} />
					<span>{label}</span>
				</label>
			))}
			{features.docSuffixes === true ? (
				<LineList
					label="Alternate reasons, one per line"
					value={cfg.suffixReasons}
					onCommit={(suffixReasons) => patch({ suffixReasons })}
				/>
			) : null}
			{features.docSuffixes === true ? (
				<label className="wiz-field">
					<span className="ce-field-label">Authorised to approve a take-over</span>
					<input
						className="ce-input"
						value={(cfg.authorisations?.takeover || []).join(", ")}
						onChange={(e) => patch({
							authorisations: {
								...cfg.authorisations,
								takeover: e.target.value.split(",").map((name) => name.trim()).filter(Boolean)
							}
						})}
					/>
				</label>
			) : null}
			{features.branding === true ? (
				<LineList
					label="Philippine holidays (YYYY-MM-DD, one per line). Sundays are already off. Saturday counts unless listed."
					value={cfg.phHolidays}
					onCommit={(phHolidays) => patch({ phHolidays })}
				/>
			) : null}
			{features.branding === true ? (
				<div className="wiz-grid">
					{["bg", "card", "ink", "ledger", "brass"].map((key) => (
						<label key={key} className="wiz-field">
							<span className="ce-field-label">{key}</span>
							<input
								className="ce-input"
								value={branding[key] || ""}
								placeholder="#112233"
								onChange={(e) => patch({ branding: { ...branding, [key]: e.target.value } })}
							/>
						</label>
					))}
				</div>
			) : null}
		</div>
	);
}

export function PriceCheckPanel({ report, onApply }) {
	const [picked, setPicked] = useState({});
	const drifts = report?.drifts || [];
	const constants = report?.constants || [];
	const selectedIds = drifts.filter((row) => picked[row.lineId]).map((row) => row.lineId);
	return (
		<div className="ce-card" style={{ margin: "0.6rem 0" }}>
			<h3 className="ce-serif">Price check</h3>
			<p className="wiz-hint">Cloned lines that no longer match the source or the masterlist. Resync uses the masterlist rate when there is one.</p>
			{drifts.map((row) => (
				<label key={row.lineId} className="ce-picker-row">
					<input
						type="checkbox"
						checked={!!picked[row.lineId]}
						onChange={() => setPicked((prev) => ({ ...prev, [row.lineId]: !prev[row.lineId] }))}
					/>
					<span>{row.label || row.lineId}: {row.cloneRate} → {row.masterRate != null ? row.masterRate : row.sourceRate}</span>
				</label>
			))}
			{constants.length ? (
				<p className="wiz-hint">Constants changed: {constants.map((row) => row.key).join(", ")}. This is recorded only.</p>
			) : null}
			<div className="ce-confirm-actions">
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onApply("all", [])}>Resync all</button>
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onApply("selected", selectedIds)}>Resync selected</button>
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onApply("keep", [])}>Keep</button>
			</div>
		</div>
	);
}
