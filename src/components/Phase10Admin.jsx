// @ts-nocheck

const FLAGS = [
	["sowTagging", "SOW tagging"],
	["schedule", "Project schedule"]
];

export function Phase10Admin({ cfg, patch }) {
	const features = cfg.features || {};
	function setFlag(id, checked) {
		patch({ features: { ...features, [id]: checked === true } });
	}
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Phase 10</h3>
			<p className="wiz-hint">Off leaves the scope text and the export order as they are. Nothing is split until someone confirms it.</p>
			{FLAGS.map(([id, label]) => (
				<label key={id} className="ce-picker-row">
					<input type="checkbox" checked={features[id] === true} onChange={(e) => setFlag(id, e.target.checked)} />
					<span>{label}</span>
				</label>
			))}
		</div>
	);
}
