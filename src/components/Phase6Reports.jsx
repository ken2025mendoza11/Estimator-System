// @ts-nocheck
import { useState } from "react";
import * as XLSX from "xlsx";
import { buildReport, reportSheet } from "../lib/estimator/reports";
import { categoryOnTask } from "../lib/estimator/ceTotals";
import { StickyTable } from "./StickyTable";
import { SALES_STAGES, pipelineKpis, stageActions } from "../lib/estimator/salesStage";

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

function SalesPipeline({ monitor }) {
	const [stage, setStage] = useState("All");
	const [owner, setOwner] = useState("");
	const [showOld, setShowOld] = useState(false);
	const rows = monitor.pipeline || [];
	const owners = [...new Set(rows.map((row) => row.salesOwner).filter(Boolean))];
	const owned = rows.filter((row) => !owner || row.salesOwner === owner || row.ownerId === owner);
	const filtered = owned.filter((row) => stage === "All" || row.stage === stage);
	const kpis = pipelineKpis(owned, monitor.now);
	const win = kpis.win == null ? "—" : `${Math.round(kpis.win * 1000) / 10}%`;
	function download() {
		const sheet = [["Stage", "RCE", "CE", "Project", "Markup %", "Selling", "Proposal", "Validity", "Sales owner"], ...filtered.map((row) => [row.stage, row.rceNo, row.ceNo, row.project, row.markupPct, row.selling, row.proposalNo, row.validity, row.salesOwner])];
		const book = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet), "Pipeline");
		XLSX.writeFile(book, "sales-pipeline.xlsx");
	}
	return (
		<div className="sales-pipeline" aria-label="Sales pipeline">
			<div className="wiz-grid">
				<p>Win rate: {win}</p>
				<p>CE turnaround (days): {monitor.dashboard?.ceTurnaroundDays == null ? "—" : Math.round(monitor.dashboard.ceTurnaroundDays * 10) / 10}</p>
				<p>Open pipeline: {money(kpis.openValue)}</p>
				<p>Expiring ≤ 7 days: {kpis.expiring}</p>
			</div>
			<div className="mon-chip-row">
				<button type="button" className={"ce-pill" + (stage === "All" ? " ce-pill-active" : "")} onClick={() => setStage("All")}>All {rows.length}</button>
				{SALES_STAGES.map((name) => (
					<button key={name} type="button" className={"ce-pill" + (stage === name ? " ce-pill-active" : "")} onClick={() => setStage(name)}>{name} {kpis.counts[name] || 0}</button>
				))}
			</div>
			<label>Owner <select aria-label="Owner" className="ce-input" value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">All</option>{owners.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
			<label className="ce-checkbox-row"><input type="checkbox" checked={showOld} onChange={() => setShowOld((value) => !value)} /> Old columns</label>
			<StickyTable className="mon-table-container" enabled>
				<table className="ce-table mon-table">
					<thead>
						<tr>
							<th>RCE No.</th>
							<th>Project</th>
							<th>Stage</th>
							<th>Markup %</th>
							<th>Selling price</th>
							<th>Proposal no.</th>
							<th>Validity</th>
							<th>Sales owner</th>
							{showOld ? <th>Direct</th> : null}
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map((row) => {
							const actions = stageActions(row.stage, { sales: true, owner: monitor.actorIsOwner !== false, manager: !!monitor.isManager, head: !!monitor.canReassign });
							return (
								<tr key={row.id}>
									<td>{row.rceNo || row.id}</td>
									<td>{row.project}</td>
									<td>{row.stage}</td>
									<td>{row.markupPct === "" ? "—" : row.markupPct}</td>
									<td>{row.selling === "" ? "—" : money(row.selling)}</td>
									<td>{row.proposalNo || "—"}</td>
									<td>{row.validity || "—"}</td>
									<td>{row.salesOwner || "—"}</td>
									{showOld ? <td>{row.direct === "" ? "—" : money(row.direct)}</td> : null}
									<td>{actions[0] ? <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => monitor.onAction?.(row, actions[0])}>{actions[0]}</button> : "—"}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</StickyTable>
			<button type="button" className="ce-btn-primary ce-btn-sm" onClick={download}>Excel</button>
		</div>
	);
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
						<p>Win rate: {Array.isArray(monitor.pipeline) ? pct(pipelineKpis(monitor.pipeline, monitor.now).win) : pct(monitor.dashboard?.winRate)}</p>
						<p>CE turnaround (days): {monitor.dashboard?.ceTurnaroundDays == null ? "—" : Math.round(monitor.dashboard.ceTurnaroundDays * 10) / 10}</p>
					</div>
					<h3 className="ce-serif">Sales list</h3>
					{Array.isArray(monitor.pipeline) ? <SalesPipeline monitor={monitor} /> : sales.length ? sales.map((row) => (
						<div key={`${row.kind}-${row.id}`}>
							<p>{row.kind} {row.id} · {row.status} · {row.ageDays}d · {row.holderName || row.ownerName || "Unnamed"}</p>
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
					)) : <p className="wiz-hint">No proposals, markups, or job orders.</p>}
					<h3 className="ce-serif">Pending approvals</h3>
					{pending.length ? pending.map((row) => (
						<p key={`pending-${row.kind}-${row.id}`} style={row.overdue ? { color: "#b45309" } : undefined}>
							{row.kind} {row.id} · {row.holderName || "Unnamed"} · {row.hours} h
						</p>
					)) : <p className="wiz-hint">Nothing is waiting.</p>}
					<h3 className="ce-serif">Proposal aging</h3>
					{aging.length ? aging.map((row) => (
						<p key={row.salesRepName || "unassigned"}>{row.salesRepName || "Unnamed"}: {row.count} · oldest {row.oldestDays}d</p>
					)) : <p className="wiz-hint">No proposals.</p>}
					<h3 className="ce-serif">By sales rep</h3>
					{(monitor.dashboard?.bySalesRep || []).length ? (monitor.dashboard.bySalesRep || []).map((row) => (
						<p key={`rep-${row.salesRepName || "unassigned"}`}>{row.salesRepName || "Unnamed"} · win {pct(row.winRate)} · turnaround {row.ceTurnaroundDays == null ? "—" : Math.round(row.ceTurnaroundDays * 10) / 10}d · proposals {row.proposalCount} · oldest {row.oldestDays}d</p>
					)) : <p className="wiz-hint">No sales rep figures.</p>}
				</>
			) : null}
		</div>
	);
}
