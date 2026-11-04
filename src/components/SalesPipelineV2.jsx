import { useState } from "react";
import * as XLSX from "xlsx";
import { previewDocs } from "../lib/estimator/libraryTemplates";
import { stageActions } from "../lib/estimator/salesStage";
import { salesChipMatch, trackerSteps } from "../lib/estimator/stageBui";

const CHIPS = ["New for me", "All", "For approval", "Waiting for CE", "CE in progress", "For markup", "For proposal", "Proposal sent", "Awarded/Lost"];

/**
 * @param {unknown} value
 */
function money(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return "—";
	return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * @param {{ monitor: any }} props
 */
export function SalesPipelineV2({ monitor }) {
	const [chip, setChip] = useState("All");
	const [priority, setPriority] = useState("");
	const [company, setCompany] = useState("");
	const [openId, setOpenId] = useState("");
	const rows = /** @type {any[]} */ (monitor.pipeline || []);
	const actor = { userId: monitor.actorId, now: monitor.now, config: monitor.dayConfig };
	const filtered = rows.filter((row) => salesChipMatch(row, chip, actor) && (!priority || row.priority === priority) && (!company || row.company === company));
	const open = filtered.find((row) => row.id === openId) || null;
	const priorities = [...new Set(rows.map((row) => row.priority).filter(Boolean))];
	const companies = [...new Set(rows.map((row) => row.company).filter(Boolean))];
	function download() {
		const sheet = [["Stage", "RCE", "CE", "Markup", "Proposal", "Project", "Selling", "Sales owner"], ...filtered.map((row) => [row.stage, row.rceNo, row.ceNo, row.ceNo ? `${row.ceNo}-MK` : "", row.proposalNo, row.project, row.selling, row.salesOwner])];
		const book = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet), "Pipeline");
		XLSX.writeFile(book, "sales-pipeline.xlsx");
	}
	return (
		<div className="sales-v2" aria-label="Sales pipeline">
			<div className="sales-v2-cards-summary">
				{CHIPS.map((name) => {
					const count = rows.filter((row) => salesChipMatch(row, name, actor)).length;
					return (
						<button key={name} type="button" className={"ce-pill" + (chip === name ? " ce-pill-active" : "")} onClick={() => setChip(name)}>
							{name} {count}
						</button>
					);
				})}
			</div>
			<div className="sales-v2-filters">
				<label>Priority <select aria-label="Priority" className="ce-input" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All</option>{priorities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
				<label>Company <select aria-label="Company" className="ce-input" value={company} onChange={(event) => setCompany(event.target.value)}><option value="">All</option>{companies.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
			</div>
			<table className="ce-table sales-v2-table">
				<thead>
					<tr>
						<th>Stage</th>
						<th>Tracker</th>
						<th>Numbers</th>
						<th>Project</th>
						<th>Amount</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					{filtered.map((row) => {
						const actions = stageActions(row.stage, { sales: true, owner: monitor.actorIsOwner !== false, manager: !!monitor.isManager, head: !!monitor.canReassign });
						const steps = trackerSteps(row.stage);
						return (
							<tr key={row.id} onClick={() => setOpenId(row.id)}>
								<td>{row.stage}</td>
								<td><ol className="sales-tracker">{steps.map((step) => <li key={step.label} className={step.done ? "is-done" : step.current ? "is-current" : ""}>{step.label}</li>)}</ol></td>
								<td>{[row.rceNo, row.ceNo, row.ceNo ? `${row.ceNo}-MK` : "", row.proposalNo].filter(Boolean).join(" · ") || "—"}</td>
								<td>{row.project}</td>
								<td>{row.selling === "" ? "—" : money(row.selling)}</td>
								<td>{actions[0] ? <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={(event) => { event.stopPropagation(); monitor.onAction?.(row, actions[0]); }}>{actions[0]}</button> : "—"}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<div className="sales-v2-mobile">
				{filtered.map((row) => (
					<button key={`card-${row.id}`} type="button" className="sales-v2-card" onClick={() => setOpenId(row.id)}>
						<b>{row.stage}</b>
						<span>{row.project}</span>
						<span>{row.rceNo || row.ceNo}</span>
					</button>
				))}
			</div>
			<button type="button" className="ce-btn-primary ce-btn-sm" onClick={download}>Excel</button>
			{open ? (
				<div className="ce-drawer-overlay" onClick={() => setOpenId("")}>
					<aside className="ce-drawer sales-v2-drawer" onClick={(event) => event.stopPropagation()}>
						<div className="ce-drawer-header">
							<b>{open.project || open.id}</b>
							<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => setOpenId("")}>Close</button>
						</div>
						<div className="ce-drawer-body">
							<p>{open.rceNo} · {open.ceNo} · {open.ceNo ? `${open.ceNo}-MK` : "—"} · {open.proposalNo || "—"}</p>
							<ol className="sales-tracker">{trackerSteps(open.stage).map((step) => <li key={step.label} className={step.done ? "is-done" : ""}>{step.label}</li>)}</ol>
							<p>Next: {stageActions(open.stage, { sales: true, owner: monitor.actorIsOwner !== false, manager: !!monitor.isManager })[0] || "View"}</p>
							{monitor.previewOn ? (
								<div>
									<p>Preview</p>
									{previewDocs({ rce: open.rceNo ? { rceNo: open.rceNo, status: open.stage } : null, ce: open.ceNo ? { ceNo: open.ceNo, status: open.stage } : null, markup: open.markup || null, proposal: open.proposal || null }).map((doc) => (
										<button key={doc.kind} type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => monitor.onPreviewDoc?.(open, doc)}>{doc.kind} · {doc.status || "—"}</button>
									))}
								</div>
							) : null}
							<p>RCE compiled PDF stays on the row action.</p>
						</div>
					</aside>
				</div>
			) : null}
		</div>
	);
}
