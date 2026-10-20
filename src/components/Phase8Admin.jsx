// @ts-nocheck
import { availabilityKeysFrom } from "../lib/estimator/phase8";

const FLAGS = [
	["quotations", "Quotations"],
	["availability", "Availability"],
	["clientLocations", "Client locations"],
	["pendingRecords", "Pending records"]
];

export function Phase8Admin({ cfg, patch }) {
	const features = cfg.features || {};
	const keys = cfg.availabilityKeys || [];
	function setFlag(id, checked) {
		patch({ features: { ...features, [id]: checked === true } });
	}
	function addKey(event) {
		event.preventDefault();
		const label = String(new FormData(event.currentTarget).get("label") || "");
		const next = availabilityKeysFrom([...keys, { label }]);
		if (next.length === keys.length) return;
		patch({ availabilityKeys: next });
		event.currentTarget.reset();
	}
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Phase 8</h3>
			<p className="wiz-hint">Off leaves quotations, availability, locations, and pending records out of the estimate.</p>
			{FLAGS.map(([id, label]) => (
				<label key={id} className="ce-picker-row">
					<input type="checkbox" checked={features[id] === true} onChange={(e) => setFlag(id, e.target.checked)} />
					<span>{label}</span>
				</label>
			))}
			{features.availability === true ? (
				<div>
					<p className="wiz-hint">No availability keys are seeded.</p>
					{keys.length ? keys.map((key) => <p key={key.id} className="wiz-hint">{key.label}</p>) : <p className="wiz-hint">None yet.</p>}
					<form onSubmit={addKey}>
						<label className="wiz-field">
							<span className="ce-field-label">Availability key</span>
							<input className="ce-input" name="label" />
						</label>
						<button type="submit" className="ce-btn-ghost ce-btn-sm">Add</button>
					</form>
				</div>
			) : null}
			{features.pendingRecords === true ? (
				<label className="wiz-field">
					<span className="ce-field-label">Escalate after working days</span>
					<input
						className="ce-input"
						type="number"
						min="1"
						value={cfg.pendingEscalateDays ?? 3}
						onChange={(e) => patch({ pendingEscalateDays: e.target.value })}
					/>
				</label>
			) : null}
		</div>
	);
}
