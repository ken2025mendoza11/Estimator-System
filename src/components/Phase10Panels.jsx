// @ts-nocheck
import { useState } from "react";
import { ganttModel, normalizeSow, phase10Findings, proposeSowSplit } from "../lib/estimator/phase10";

export function Phase10Sow({ sow = [], tasks = [], sowText = "", onChange }) {
	const [pending, setPending] = useState(null);
	const findings = phase10Findings({ features: { sowTagging: true }, sow, tasks });
	function askSplit() {
		setPending(proposeSowSplit(sowText));
	}
	function confirm() {
		if (!pending || !onChange) return;
		onChange(normalizeSow(pending));
		setPending(null);
	}
	function tag(index, activityId) {
		if (!onChange) return;
		onChange(sow.map((row, i) => i === index ? { ...row, activity_id: activityId } : row));
	}
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Scope headings</h3>
			<p className="wiz-hint">The scope text stays. Split into headings only after you confirm. Each heading has one activity.</p>
			<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={askSplit}>Split into headings</button>
			{pending ? (
				<div>
					<p className="wiz-hint">Confirm these headings. The scope text is not replaced.</p>
					{pending.length ? pending.map((row) => <p key={row.id} className="wiz-hint">{row.heading}</p>) : <p className="wiz-hint">No headings in the scope text.</p>}
					<button type="button" className="ce-btn-primary ce-btn-sm" onClick={confirm}>Confirm split</button>
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => setPending(null)}>Cancel</button>
				</div>
			) : null}
			{(sow || []).map((row, index) => (
				<label key={row.id || index} className="wiz-field">
					<span className="ce-field-label">{row.heading}</span>
					<select className="ce-input" value={row.activity_id || ""} onChange={(e) => tag(index, e.target.value)}>
						<option value="">Choose one activity</option>
						{(tasks || []).map((task) => <option key={task.id} value={task.id}>{task.title || task.id}</option>)}
					</select>
				</label>
			))}
			{findings.map((row) => <p key={row.message} className="wiz-hint">{row.message}</p>)}
		</div>
	);
}

export function GanttChart({ schedule }) {
	const model = ganttModel(schedule);
	const width = 180 + model.days * 16;
	const height = Math.max(1, model.bars.length) * 24 + 8;
	return (
		<svg width={width} height={height} role="img" aria-label="Project schedule">
			{model.bars.map((bar) => (
				<g key={bar.taskId}>
					<text x="0" y={bar.y + 16} fontSize="12">{String(bar.title || "").slice(0, 22)}</text>
					<rect x={180 + bar.x} y={bar.y + 4} width={bar.width} height="14" fill="#8a5a2b" />
				</g>
			))}
		</svg>
	);
}

export function Phase10Schedule({ plans = [] }) {
	const [id, setId] = useState(plans[0]?.id || "");
	const plan = plans.find((row) => row.id === id) || plans[0] || null;
	return (
		<div className="dash-container">
			<div className="dash-header">
				<h2 className="ce-serif">Project schedule</h2>
				<p className="wiz-hint">Working days skip Sunday and listed holidays. One bar per task. Finish to start only.</p>
			</div>
			{plans.length ? (
				<label className="wiz-field">
					<span className="ce-field-label">Cost estimate</span>
					<select className="ce-input" value={plan?.id || ""} onChange={(e) => setId(e.target.value)}>
						{plans.map((row) => <option key={row.id} value={row.id}>{row.title || row.id}</option>)}
					</select>
				</label>
			) : <p className="wiz-hint">No cost estimate yet.</p>}
			{plan?.schedule?.locked ? <p className="wiz-hint">Baseline. This estimate is locked.</p> : null}
			{plan ? <GanttChart schedule={plan.schedule} /> : null}
		</div>
	);
}
