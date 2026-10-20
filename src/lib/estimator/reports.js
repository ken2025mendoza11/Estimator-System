// @ts-nocheck
/**
 * Read-only report figures. Win rate is Awarded ÷ (Awarded + Not awarded).
 * Amounts passed in are already computed. This file does not change a total.
 */

function num(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	const text = String(value ?? "").replace(/[^0-9.-]/g, "");
	const n = Number(text);
	return Number.isFinite(n) ? n : null;
}

function awardKey(row) {
	return String(row?.awardStatus || "").trim().toLowerCase();
}

export function isAwardedRow(row) {
	return awardKey(row) === "awarded";
}

export function isNotAwardedRow(row) {
	const key = awardKey(row);
	return key === "lost" || key === "lost bid" || key === "not awarded";
}

export function pipelineCounts(rows) {
	const counts = {};
	(rows || []).forEach((row) => {
		const status = String(row?.status || "Draft").trim() || "Draft";
		counts[status] = (counts[status] || 0) + 1;
	});
	return counts;
}

/** Awarded ÷ (Awarded + Not awarded). Null when neither side has a row. */
export function winRate(rows) {
	let awarded = 0;
	let notAwarded = 0;
	(rows || []).forEach((row) => {
		if (isAwardedRow(row)) awarded += 1;
		else if (isNotAwardedRow(row)) notAwarded += 1;
	});
	const denom = awarded + notAwarded;
	if (!denom) return null;
	return awarded / denom;
}

function daySpan(start, end) {
	const a = String(start || "").slice(0, 10);
	const b = String(end || "").slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
	const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
	if (!Number.isFinite(ms)) return null;
	return ms / 86400000;
}

/** Mean days from received to done, for rows that have both dates. */
export function speedDays(rows) {
	const spans = [];
	(rows || []).forEach((row) => {
		const span = daySpan(row?.received, row?.done);
		if (span == null) return;
		spans.push(span);
	});
	if (!spans.length) return null;
	return spans.reduce((sum, n) => sum + n, 0) / spans.length;
}

export function workloadCounts(rows) {
	const counts = {};
	(rows || []).forEach((row) => {
		const status = String(row?.status || "").trim().toLowerCase();
		if (status === "done" || status === "cancelled" || status === "canceled" || status === "no quote" || status === "close bid") return;
		const name = String(row?.assignedTo || "").trim() || "Unassigned";
		counts[name] = (counts[name] || 0) + 1;
	});
	return counts;
}

export function costMix(parts) {
	const src = parts && typeof parts === "object" ? parts : {};
	const keys = ["bol", "bote", "bocm", "ppe", "misc"];
	const amounts = {};
	let total = 0;
	keys.forEach((key) => {
		const n = Number(src[key]);
		amounts[key] = Number.isFinite(n) ? n : 0;
		total += amounts[key];
	});
	const shares = {};
	keys.forEach((key) => {
		shares[key] = total ? amounts[key] / total : 0;
	});
	return { total, amounts, shares };
}

/**
 * 1 − mean(|estimate − award| / estimate) for Awarded rows that have both amounts.
 * Null when no such row exists.
 */
export function accuracy(rows) {
	const gaps = [];
	(rows || []).forEach((row) => {
		if (!isAwardedRow(row)) return;
		const estimate = num(row?.amount);
		const award = num(row?.awardAmount);
		if (estimate == null || !(estimate > 0) || award == null) return;
		gaps.push(Math.abs(estimate - award) / estimate);
	});
	if (!gaps.length) return null;
	const mean = gaps.reduce((sum, n) => sum + n, 0) / gaps.length;
	return Math.max(0, 1 - mean);
}

export function buildReport(rows, mixParts) {
	const win = winRate(rows);
	return {
		pipeline: pipelineCounts(rows),
		awarded: (rows || []).filter(isAwardedRow).length,
		notAwarded: (rows || []).filter(isNotAwardedRow).length,
		winRate: win,
		speedDays: speedDays(rows),
		workload: workloadCounts(rows),
		costMix: costMix(mixParts),
		accuracy: accuracy(rows)
	};
}

function pct(value) {
	if (value == null || !Number.isFinite(value)) return "";
	return `${Math.round(value * 1000) / 10}%`;
}

export function reportSheet(report) {
	const rows = [
		["Report", "Value"],
		["Awarded", report?.awarded ?? 0],
		["Not awarded", report?.notAwarded ?? 0],
		["Win rate", pct(report?.winRate)],
		["Speed (days)", report?.speedDays == null ? "" : Math.round(report.speedDays * 10) / 10],
		["Accuracy", pct(report?.accuracy)]
	];
	Object.entries(report?.pipeline || {}).forEach(([status, count]) => {
		rows.push([`Pipeline: ${status}`, count]);
	});
	Object.entries(report?.workload || {}).forEach(([name, count]) => {
		rows.push([`Workload: ${name}`, count]);
	});
	const mix = report?.costMix?.shares || {};
	["bol", "bote", "bocm", "ppe", "misc"].forEach((key) => {
		rows.push([`Cost mix: ${key}`, pct(mix[key])]);
	});
	return rows;
}
