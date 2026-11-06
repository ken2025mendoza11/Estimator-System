import { useState } from "react";
import { personName } from "../lib/estimator/departments";
import { actorMayDecideProposal, newerCeBanner, proposalEditable } from "../lib/estimator/proposal";
import { proposalDocxBytes, proposalPdfBytes } from "../lib/estimator/proposalDocx";
import { askReason } from "../lib/estimator/reasonBox";

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
 * @param {{ title: string, label: string, required?: boolean, action: string, onProposal?: (action: string, payload?: any) => void }} props
 */
function ask(props) {
	void askReason({ title: props.title, label: props.label, required: props.required !== false }).then((result) => {
		if (!result.ok) return;
		props.onProposal?.(props.action, { remarks: result.text });
	});
}

/**
 * @param {{ proposal: any, sales: boolean, actorId: string, users?: unknown[], liveRev?: string, onProposal?: (action: string, payload?: any) => void }} props
 */
export function ProposalPanel({ proposal, sales, actorId, users, liveRev, onProposal }) {
	const [prNo, setPrNo] = useState("");
	if (!proposal) return null;
	const open = proposalEditable(proposal);
	const banner = newerCeBanner(proposal, liveRev);
	const mayDecide = actorMayDecideProposal(proposal, actorId);
	const holder = proposal.status === "Submitted" ? proposal.steps?.[proposal.currentIndex] : null;
	const rev = Number(proposal.rev) > 0 ? ` Rev ${proposal.rev}` : "";
	const name = (/** @type {unknown} */ id) => personName(id, users) || "Unnamed";
	const neverSubmitted = proposal.status === "Draft" && !(proposal.steps || []).length && !(proposal.timeline || []).some((/** @type {any} */ row) => /submitted/i.test(String(row?.action || "")));

	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Proposal {proposal.controlNo}{rev}</h3>
			{banner ? <p className="scope-edit-banner">{banner}</p> : null}
			<p>Status {proposal.status} · Total {money(proposal.total)} · Valid until {proposal.validUntil || "—"}</p>
			{proposal.approverFor ? <p className="wiz-hint">Signature {proposal.approverFor}</p> : null}
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
			<p className="wiz-hint">Sales Rep {name(proposal.salesRepId)} · Approver {name(proposal.approverId)} · Client conforme {proposal.clientConforme || "—"}</p>
			{holder ? <p className="wiz-hint">Waiting for {name(holder.userId)}{holder.backupUserId ? ` (backup ${name(holder.backupUserId)})` : ""}</p> : null}
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
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => ask({ title: "Return proposal", label: "Return remark", action: "return", onProposal })}>Return proposal</button>
				) : null}
				{proposal.status === "Approved" && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onProposal?.("sent")}>Mark sent</button>
				) : null}
				{(proposal.status === "Approved" || proposal.status === "Sent") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => ask({ title: "Lost", label: "Remark", action: "lost", onProposal })}>Lost</button>
				) : null}
				{(proposal.status === "Approved" || proposal.status === "Sent") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => ask({ title: "Expired", label: "Remark", action: "expired", onProposal })}>Expired</button>
				) : null}
				{(proposal.status === "Approved" || proposal.status === "Sent" || proposal.status === "Expired") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => {
						if (proposal.status !== "Expired") {
							onProposal?.("revise", { remarks: "" });
							return;
						}
						ask({ title: "Revise proposal", label: "Revision remark", action: "revise", onProposal });
					}}>Generate revision</button>
				) : null}
				{proposal.status === "Expired" && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => ask({ title: "No revision", label: "Remark", action: "no-revision", onProposal })}>No revision needed</button>
				) : null}
				{(proposal.status === "Draft" || proposal.status === "Submitted") && sales ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onProposal?.("cancel")}>Cancel</button>
				) : null}
				{neverSubmitted && sales && actorId === proposal.ownerId ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onProposal?.("delete-draft")}>Delete draft</button>
				) : null}
			</div>
			{(proposal.timeline || []).length ? (
				<ul>
					{(proposal.timeline || []).map((/** @type {any} */ row) => (
						<li key={row.id}>{row.action} · {name(row.who)}{row.remarks ? ` · ${row.remarks}` : ""}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
