// @ts-nocheck
import { CHECKER_RULES } from "../lib/estimator/checker";

const RANGES = [
	["qty", "Qty max"],
	["days", "Days max"],
	["rate", "Rate max"],
	["unitCost", "Unit cost max"],
	["perDiem", "Per diem max"],
	["otHrs", "OT hours max"],
	["powerKw", "kW max"]
];

export function Phase7Admin({ cfg, patch }) {
	const features = cfg.features || {};
	const checker = cfg.checker || {};
	const rules = checker.rules || {};
	const ranges = checker.ranges || {};
	function setFlag(checked) {
		patch({ features: { ...features, checkerV2: checked === true } });
	}
	function setRule(id, next) {
		patch({ checker: { ...checker, rules: { ...rules, [id]: { ...(rules[id] || {}), ...next } } } });
	}
	function setRange(key, value) {
		patch({ checker: { ...checker, ranges: { ...ranges, [key]: value } } });
	}
	function addWord(event) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const word = String(data.get("word") || "").trim();
		if (!word) return;
		const words = [...(checker.words || [])];
		if (!words.some((item) => item.toLowerCase() === word.toLowerCase())) words.push(word);
		patch({ checker: { ...checker, words } });
		event.currentTarget.reset();
	}
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Phase 7</h3>
			<p className="wiz-hint">Off leaves Submit, save version, and approval exactly as they are.</p>
			<label className="ce-picker-row">
				<input type="checkbox" checked={features.checkerV2 === true} onChange={(e) => setFlag(e.target.checked)} />
				<span>Pre-submit checker</span>
			</label>
			{features.checkerV2 === true ? (
				<div>
					{CHECKER_RULES.map((rule) => {
						const row = rules[rule.id] || {};
						return (
							<div key={rule.id} className="ce-picker-row">
								<label>
									<input type="checkbox" checked={row.enabled !== false} onChange={(e) => setRule(rule.id, { enabled: e.target.checked })} />
									<span>{rule.label}</span>
								</label>
								<select className="ce-input" value={row.severity || rule.severity} onChange={(e) => setRule(rule.id, { severity: e.target.value })}>
									<option value="error">Error</option>
									<option value="warning">Warning</option>
									<option value="info">Info</option>
								</select>
							</div>
						);
					})}
					<div className="wiz-grid">
						{RANGES.map(([key, label]) => (
							<label key={key} className="wiz-field">
								<span className="ce-field-label">{label}</span>
								<input className="ce-input" value={ranges[key] ?? ""} onChange={(e) => setRange(key, e.target.value)} />
							</label>
						))}
					</div>
					<form onSubmit={addWord}>
						<label className="wiz-field">
							<span className="ce-field-label">Dictionary word</span>
							<input className="ce-input" name="word" />
						</label>
						<button type="submit" className="ce-btn-ghost ce-btn-sm">Add</button>
					</form>
					{(checker.words || []).map((word) => <p key={word} className="wiz-hint">{word}</p>)}
				</div>
			) : null}
		</div>
	);
}
