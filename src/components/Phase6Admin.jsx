// @ts-nocheck
import { useState } from "react";
import { equipmentRateCard, formulaVersionAfterEdit, RATE_KINDS } from "../lib/estimator/equipmentRates";

const FLAGS = [
	["equipmentRates", "Equipment rates on new BOTE lines"],
	["reports", "Pipeline, win rate, speed, workload, cost mix, accuracy"],
	["mobileViewer", "Mobile read-only viewer and Approve"]
];

const FIELDS = [
	["cost", "Cost"],
	["life", "Life"],
	["salvage", "Salvage"],
	["hours", "Hours"],
	["days", "Days"],
	["maintenance", "Maintenance %"],
	["rental", "Rental %"]
];

export function Phase6Admin({ cfg, patch }) {
	const features = cfg.features || {};
	const formula = cfg.equipmentFormula || {};
	const items = cfg.equipmentItems || [];
	const [draft, setDraft] = useState({ description: "", cost: "", life: "", salvage: "", hours: "", days: "", maintenance: "", rental: "" });
	function setFlag(key, checked) {
		patch({ features: { ...features, [key]: checked === true } });
	}
	function setFormula(kind, text) {
		const next = { ...formula, [kind]: text };
		next.version = formulaVersionAfterEdit(formula, next);
		patch({ equipmentFormula: next });
	}
	function addItem() {
		const description = draft.description.trim();
		if (!description) return;
		const row = { id: `eq-${Date.now()}`, description };
		FIELDS.forEach(([key]) => {
			row[key] = draft[key];
		});
		patch({ equipmentItems: [...items, row] });
		setDraft({ description: "", cost: "", life: "", salvage: "", hours: "", days: "", maintenance: "", rental: "" });
	}
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Phase 6</h3>
			<p className="wiz-hint">Each switch is off until it is checked. Off leaves BOTE lines, the sidebar, and the home screen as they are.</p>
			{FLAGS.map(([key, label]) => (
				<label key={key} className="ce-picker-row">
					<input type="checkbox" checked={features[key] === true} onChange={(e) => setFlag(key, e.target.checked)} />
					<span>{label}</span>
				</label>
			))}
			{features.equipmentRates === true ? (
				<div>
					<p className="wiz-hint">Formula version {formula.version || 1}. Names: cost, life, salvage, hours, days, maintenance, rental. A line already saved keeps its snapshot.</p>
					{RATE_KINDS.map((kind) => (
						<label key={kind} className="wiz-field">
							<span className="ce-field-label">{kind}</span>
							<input className="ce-input" value={formula[kind] || ""} onChange={(e) => setFormula(kind, e.target.value)} />
						</label>
					))}
					<div className="wiz-grid">
						<label className="wiz-field">
							<span className="ce-field-label">Item</span>
							<input className="ce-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
						</label>
						{FIELDS.map(([key, label]) => (
							<label key={key} className="wiz-field">
								<span className="ce-field-label">{label}</span>
								<input className="ce-input" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
							</label>
						))}
					</div>
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={addItem}>Add equipment rate</button>
					{items.map((item) => {
						const card = equipmentRateCard(item, formula);
						return (
							<div key={item.id || item.description} className="wiz-hint">
								<b>{item.description}</b>
								{" — "}
								{RATE_KINDS.map((kind) => `${kind} ${card[kind].amount == null ? "—" : card[kind].amount}${card[kind].source === "manual" ? " manual" : ""}`).join(" · ")}
								{" "}
								<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => patch({ equipmentItems: items.filter((row) => row !== item && row.id !== item.id) })}>Remove</button>
							</div>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
