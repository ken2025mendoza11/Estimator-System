// @ts-nocheck
import * as XLSX from "xlsx";
import { buildReport, reportSheet } from "../lib/estimator/reports";
import { categoryOnTask } from "../lib/estimator/ceTotals";

function money(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return "—";
	return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value) {
	if (value == null || !Number.isFinite(value)) return "—";
	return `${Math.round(value * 1000) / 10}%`;
}

function mixOf(ceList, documents) {
	const parts = { bol: 0, bote: 0, bocm: 0, ppe: 0, misc: 0 };
	const cats = [["bol", "BOL"], ["bote", "BOTE"], ["bocm", "BOCM"], ["ppe", "PPE"], ["misc", "MISC"]];
	(ceList || []).forEach((ce) => {
		const tasks = documents?.[ce.id]?.tasks || [];
		tasks.forEach((task) => {
			cats.forEach(([key, cat]) => {
				parts[key] += categoryOnTask(task, cat) || 0;
			});
		});
	});
	return parts;
}

function rowsOf(ceList, documents) {
	return (ceList || []).map((ce) => {
		const doc = documents?.[ce.id] || {};
		return {
			status: ce.status || doc.ceStatus || "Draft",
			awardStatus: doc.awardStatus || ce.awardStatus || "",
			assignedTo: ce.assignedTo || "",
			received: ce.rceReceived || ce.dateReceived || doc?.projectInfo?.date || "",
			done: ce.status === "Done" ? (ce.lastEdited || "") : "",
			amount: doc.amount || ce.amount || "",
			awardAmount: doc.awardAmount
		};
	});
}

export function Phase6Reports({ ceList, documents }) {
	const report = buildReport(rowsOf(ceList, documents), mixOf(ceList, documents));
	function download() {
		const book = XLSX.utils.book_new();
		const sheet = XLSX.utils.aoa_to_sheet(reportSheet(report));
		XLSX.utils.book_append_sheet(book, sheet, "Reports");
		XLSX.writeFile(book, "estimator-reports.xlsx");
	}
	const pipeline = Object.entries(report.pipeline);
	const workload = Object.entries(report.workload);
	return (
		<div className="ce-shell">
			<h2 className="ce-serif">Reports</h2>
			<p className="wiz-sub">Win rate is Awarded ÷ (Awarded + Not awarded). Ongoing estimates are not in that ratio.</p>
			<div className="wiz-grid">
				<p>Awarded: {report.awarded}</p>
				<p>Not awarded: {report.notAwarded}</p>
				<p>Win rate: {pct(report.winRate)}</p>
				<p>Speed (days): {report.speedDays == null ? "—" : Math.round(report.speedDays * 10) / 10}</p>
				<p>Accuracy: {pct(report.accuracy)}</p>
				<p>Cost mix total: {money(report.costMix.total)}</p>
			</div>
			<h3 className="ce-serif">Pipeline</h3>
			{pipeline.length ? pipeline.map(([status, count]) => <p key={status}>{status}: {count}</p>) : <p className="wiz-hint">No estimates.</p>}
			<h3 className="ce-serif">Workload</h3>
			{workload.length ? workload.map(([name, count]) => <p key={name}>{name}: {count}</p>) : <p className="wiz-hint">No open estimates.</p>}
			<h3 className="ce-serif">Cost mix</h3>
			{["bol", "bote", "bocm", "ppe", "misc"].map((key) => (
				<p key={key}>{key}: {pct(report.costMix.shares[key])} ({money(report.costMix.amounts[key])})</p>
			))}
			<button type="button" className="ce-btn-primary ce-btn-sm" onClick={download}>Excel</button>
		</div>
	);
}
