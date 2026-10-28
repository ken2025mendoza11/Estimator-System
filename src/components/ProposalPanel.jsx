import { useState } from "react";
import { actorMayDecideProposal, newerCeBanner, proposalEditable } from "../lib/estimator/proposal";
import { proposalDocxBytes, proposalPdfBytes } from "../lib/estimator/proposalDocx";

/** @param {unknown} value */
function money(value) {
	return Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * @param {Uint8Array} bytes
 * @param {string} name
 * @param {string} type
 */
function saveBytes(bytes, name, type) {
	const blob = new Blob([/** @type {BlobPart} */ (bytes)], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	URL.revokeObjectURL(url);
}

/**
 * @param {{ proposal: any, sales: boolean, actorId: string, liveRev?: string, onProposal?: (action: string, payload?: any) => void }} props
 */
export function ProposalPanel({ proposal, sales, actorId, liveRev, onProposal }) {
	const [prNo, setPrNo] = useState("");
	if (!proposal) return null;
	const open = proposalEditable(proposal);
	const banner = newerCeBanner(proposal, liveRev);
	const mayDecide = actorMayDecideProposal(proposal, actorId);
	const holder = proposal.status === "Submitted" ? proposal.steps?.[proposal.currentIndex] : null;
	const rev = Number(proposal.rev) > 0 ? ` Rev ${proposal.rev}` : "";

	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Proposal {proposal.controlNo}{rev}</h3>
			{banner ? <p className="scope-edit-banner">{banner}</p> : null}
			<p>Status {proposal.status} · Total {money(proposal.total)} · Valid until {proposal.validUntil || "—"}</p>
			{open ? (
				<div className="wiz-grid">
					<label className="wiz-field">
						<span className="ce-field-label">Client PR no.</span>
						<input className="ce-input" value={prNo || proposal.prNo || ""} onChange={(event) => setPrNo(event.target.value)} />
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">Validity (days)</span>
						<input className="ce-input" type="number" defaultValue={proposal.validityDays ?? 30} onBlur={(event) => onProposal?.("patch", { validityDays: event.target.value })} />
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">Client conforme</span>
						<input className="ce-input" defaultValue={proposal.clientConforme || ""} onBlur={(event) => onProposal?.("patch", { clientConforme: event.target.value })} />
					</label>
				</div>
			) : <p>PR no. {proposal.prNo || "—"}</p>}
			{open ? (
				<label className="wiz-field">
					<span className="ce-field-label">Clauses</span>
					<textarea className="ce-input" rows={4} defaultValue={proposal.clauses || ""} onBlur={(event) => onProposal?.("patch", { clauses: event.target.value })} />
				</label>
			) : <p className="wiz-hint">{proposal.clauses}</p>}
			<ul>
				{(proposal.groups || []).map((/** @type {any} */ group) => (
					<li key={group.key || group.label}>{group.label}: {money(group.selling)}</li>
				))}
			</ul>
			<p className="wiz-hint">Sales Rep {proposal.salesRepId || "—"} · Approver {proposal.approverId || "—"} · Client conforme {proposal.clientConforme || "—"}</p>
			{holder ? <p className="wiz-hint">Waiting for {holder.userId}{holder.backupUserId ? ` (backup ${holder.backupUserId})` : ""}</p> : null}
			<div className="wiz-grid">
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { void proposalDocxBytes(proposal).then((bytes) => saveBytes(bytes, `proposal-${proposal.controlNo}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")); }}>Word</button>
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => saveBytes(proposalPdfBytes(proposal), `proposal-${proposal.controlNo}.pdf`, "application/pdf")}>PDF</button>
				{open && sales && actorId === proposal.ownerId ? (
					<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onProposal?.("submit", { prNo: prNo || proposal.prNo })}>Submit proposal</button>
				) : null}
				{mayDecide ? (
					<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onProposal?.("approve")}>Approve proposal</button>
				) : null}
				{mayDecide ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { const why = window.prompt("Return remark (required)"); if (why && String(why).trim()) onProposal?.("return", { remarks: String(why).trim() }); }}>Return proposal</button>
				) : null}
				{proposal.status === "Approved" && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onProposal?.("sent")}>Mark sent</button>
				) : null}
				{(proposal.status === "Approved" || proposal.status === "Sent") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { const why = window.prompt("Remark (required)"); if (why && String(why).trim()) onProposal?.("lost", { remarks: String(why).trim() }); }}>Lost</button>
				) : null}
				{(proposal.status === "Approved" || proposal.status === "Sent") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { const why = window.prompt("Remark (required)"); if (why && String(why).trim()) onProposal?.("expired", { remarks: String(why).trim() }); }}>Expired</button>
				) : null}
				{(proposal.status === "Approved" || proposal.status === "Expired") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { const why = proposal.status === "Expired" ? window.prompt("Revision remark (required)") : ""; if (proposal.status === "Expired" && (!why || !String(why).trim())) return; onProposal?.("revise", { remarks: String(why || "").trim() }); }}>Generate revision</button>
				) : null}
				{proposal.status === "Expired" && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { const why = window.prompt("Remark (required)"); if (why && String(why).trim()) onProposal?.("no-revision", { remarks: String(why).trim() }); }}>No revision needed</button>
				) : null}
				{(proposal.status === "Draft" || proposal.status === "Submitted") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onProposal?.("cancel")}>Cancel</button>
				) : null}
			</div>
			{(proposal.timeline || []).length ? (
				<ul>
					{(proposal.timeline || []).map((/** @type {any} */ row) => (
						<li key={row.id}>{row.action} · {row.who}{row.remarks ? ` · ${row.remarks}` : ""}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
