import { actorMayDecideJobOrder, jobOrderEditable } from "../lib/estimator/jobOrder";

/**
 * @param {{ jobOrder: any, sales: boolean, actorId: string, onJobOrder?: (action: string, payload?: any) => void }} props
 */
export function JobOrderPanel({ jobOrder, sales, actorId, onJobOrder }) {
	if (!jobOrder) return null;
	const open = jobOrderEditable(jobOrder);
	const mayDecide = actorMayDecideJobOrder(jobOrder, actorId);
	const rev = Number(jobOrder.rev) > 0 ? ` REV${String(jobOrder.rev).padStart(3, "0")}` : "";
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Job order {jobOrder.joNo}{rev}</h3>
			<p>Status {jobOrder.status} · Type {jobOrder.type} · PR {jobOrder.prNo || "—"}</p>
			<p className="wiz-hint">No prices are shown. The linked estimate attachment is quantities only.</p>
			{open ? (
				<div className="wiz-grid">
					<label className="wiz-field">
						<span className="ce-field-label">PO or NTP file</span>
						<input className="ce-input" defaultValue={jobOrder.poFileName || ""} onBlur={(event) => onJobOrder?.("patch", { poFileName: event.target.value })} />
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">Project in charge</span>
						<input className="ce-input" defaultValue={jobOrder.inCharge || ""} onBlur={(event) => onJobOrder?.("patch", { inCharge: event.target.value })} />
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">Duration</span>
						<input className="ce-input" defaultValue={jobOrder.duration || ""} onBlur={(event) => onJobOrder?.("patch", { duration: event.target.value })} />
					</label>
				</div>
			) : <p>PO or NTP {jobOrder.poFileName || "—"} · In charge {jobOrder.inCharge || "—"}</p>}
			<p className="wiz-hint">Prepared by {jobOrder.salesRepId} {jobOrder.salesPosition} · Checked and approved by {jobOrder.approverId || "—"} {jobOrder.approverFor || ""}</p>
			<div className="wiz-grid">
				{open && sales && actorId === jobOrder.ownerId ? (
					<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onJobOrder?.("submit")}>Submit job order</button>
				) : null}
				{mayDecide ? <button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onJobOrder?.("approve")}>Approve job order</button> : null}
				{jobOrder.status === "Approved" && sales ? <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onJobOrder?.("revise")}>Revise</button> : null}
				{jobOrder.status !== "Cancelled" && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { const why = window.prompt("Cancel reason (required)"); if (why && String(why).trim()) onJobOrder?.("cancel", { remarks: String(why).trim() }); }}>Cancel</button>
				) : null}
			</div>
			<ul>
				{(jobOrder.timeline || []).map((/** @type {any} */ row) => (
					<li key={row.id}>{row.action} · {row.who}{row.remarks ? ` · ${row.remarks}` : ""}</li>
				))}
			</ul>
		</div>
	);
}
