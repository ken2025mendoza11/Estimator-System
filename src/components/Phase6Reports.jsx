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

export function Phase6Reports({ ceList, documents, monitor = null, reportOn = true }) {
	const report = reportOn ? buildReport(rowsOf(ceList, documents), mixOf(ceList, documents)) : null;
	function download() {
		if (!report) return;
		const book = XLSX.utils.book_new();
		const sheet = XLSX.utils.aoa_to_sheet(reportSheet(report));
		XLSX.utils.book_append_sheet(book, sheet, "Reports");
		XLSX.writeFile(book, "estimator-reports.xlsx");
	}
	const pipeline = report ? Object.entries(report.pipeline) : [];
	const workload = report ? Object.entries(report.workload) : [];
	const sales = monitor?.sales || [];
	const pending = monitor?.pending || [];
	const aging = monitor?.dashboard?.proposalAging || [];
	return (
		<div className="ce-shell">
			{report ? (
				<>
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
				</>
			) : null}
			{monitor ? (
				<>
					<h2 className="ce-serif">Sales monitor</h2>
					<p className="wiz-sub">Win rate and CE turnaround use the same report figures. They do not recompute a cost estimate.</p>
					<div className="wiz-grid">
						<p>Win rate: {pct(monitor.dashboard?.winRate)}</p>
						<p>CE turnaround (days): {monitor.dashboard?.ceTurnaroundDays == null ? "—" : Math.round(monitor.dashboard.ceTurnaroundDays * 10) / 10}</p>
					</div>
					<h3 className="ce-serif">Sales list</h3>
					{sales.length ? sales.map((row) => (
						<div key={`${row.kind}-${row.id}`}>
							<p>{row.kind} {row.id} · {row.status} · {row.ageDays}d · {row.holderId || row.ownerId || "unassigned"}</p>
							{monitor.canTakeOver && (row.status === "Approved" || row.status === "Sent") && row.ownerId && row.ownerId !== monitor.actorId ? (
								<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => monitor.onTakeOver(row)}>Take over</button>
							) : null}
							{monitor.canReassign ? (
								<form onSubmit={(event) => {
									event.preventDefault();
									const picked = String(new FormData(event.currentTarget).get("to") || "");
									monitor.onReassign(row, picked);
								}}>
									<select name="to" className="ce-input" aria-label={`Reassign ${row.id}`}>
										<option value="">Account</option>
										{(monitor.accounts || []).map((account) => (
											<option key={account.id} value={account.id}>{account.label}</option>
										))}
									</select>
									<button type="submit" className="ce-btn-ghost ce-btn-sm">Reassign</button>
								</form>
							) : null}
						</div>
					)) : <p className="wiz-hint">No proposals or job orders.</p>}
					<h3 className="ce-serif">Pending approvals</h3>
					{pending.length ? pending.map((row) => (
						<p key={`pending-${row.kind}-${row.id}`} style={row.overdue ? { color: "#b45309" } : undefined}>
							{row.kind} {row.id} · {row.holderId || "unassigned"} · {row.hours} h
						</p>
					)) : <p className="wiz-hint">Nothing is waiting.</p>}
					<h3 className="ce-serif">Proposal aging</h3>
					{aging.length ? aging.map((row) => (
						<p key={row.salesRepId || "unassigned"}>{row.salesRepId || "unassigned"}: {row.count} · oldest {row.oldestDays}d</p>
					)) : <p className="wiz-hint">No proposals.</p>}
				</>
			) : null}
		</div>
	);
}
