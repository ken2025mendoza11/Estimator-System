/** Proposal from an approved markup. Prices are the markup selling split by cost group. CE lines are not recomputed. */

import { backupSignatureLabel, normalizeApproverLists } from "./departments.js";
import { totalPercent, sellingFromDirect } from "./markup.js";
import { roundMoney, sumRounded } from "./money.js";

export const RELEASE1_PROPOSAL_FLAG = "release1Proposal";

export const DEFAULT_PROPOSAL_CLAUSES = [
	"This proposal is valid for the number of days stated below.",
	"The prices are the marked-up selling prices for the groups listed. They do not change the cost estimate.",
	"Work starts after the client accepts and issues a purchase order or a notice to proceed.",
].join("\n");

const EDITABLE = new Set(["Draft", "Submitted"]);

/**
 * @param {unknown} features
 * @returns {boolean}
 */
export function proposalFlagOn(features) {
	if (!features || typeof features !== "object") return false;
	return /** @type {{ release1Proposal?: unknown }} */ (features).release1Proposal === true;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatControlNo(value) {
	const text = String(value ?? "").trim();
	if (!/^\d{1,4}$/.test(text)) return "";
	return text.padStart(4, "0");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePrNo(value) {
	return String(value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * @param {unknown} list
 * @param {unknown} prNo
 * @param {unknown} exceptControl
 * @returns {boolean}
 */
export function prNoTaken(list, prNo, exceptControl) {
	const wanted = normalizePrNo(prNo).toLowerCase();
	if (!wanted) return false;
	const skip = formatControlNo(exceptControl) || String(exceptControl || "");
	return (Array.isArray(list) ? list : []).some((row) => {
		if (!row || typeof row !== "object") return false;
		const item = /** @type {Record<string, unknown>} */ (row);
		if (String(item.controlNo || "") === skip) return false;
		if (String(item.status || "") === "Cancelled") return false;
		return normalizePrNo(item.prNo).toLowerCase() === wanted;
	});
}

/**
 * @param {string} who
 * @param {string} action
 * @param {string} remarks
 * @param {unknown} now
 */
function entry(who, action, remarks, now) {
	return {
		id: crypto.randomUUID(),
		at: now ? String(now) : new Date().toISOString(),
		who,
		action,
		remarks: remarks || "",
	};
}

/**
 * @param {unknown} start
 * @param {unknown} days
 * @returns {string}
 */
export function validityEnd(start, days) {
	const text = String(start || "").slice(0, 10);
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
	if (!match) return "";
	const count = Number(days);
	const n = Number.isFinite(count) ? Math.trunc(count) : 30;
	const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + n));
	const yy = dt.getUTCFullYear();
	const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(dt.getUTCDate()).padStart(2, "0");
	return `${yy}-${mm}-${dd}`;
}

/**
 * @param {unknown} groups
 * @param {{ profit: number, contingency: number, markup: number }} parts
 */
export function markedUpGroups(groups, parts) {
	const rows = (Array.isArray(groups) ? groups : []).map((group) => {
		const item = group && typeof group === "object" ? /** @type {Record<string, unknown>} */ (group) : {};
		const direct = roundMoney(Number(item.direct) || 0);
		return {
			key: String(item.key || ""),
			label: String(item.label || ""),
			direct,
			selling: sellingFromDirect(direct, parts),
		};
	});
	const direct = sumRounded(rows.map((row) => row.direct));
	return { rows, direct, selling: sellingFromDirect(direct, parts), percent: totalPercent(parts) };
}

/**
 * @param {any} proposal
 * @returns {boolean}
 */
export function proposalEditable(proposal) {
	return !!proposal && EDITABLE.has(String(proposal.status || "")) && proposal.finalApproved !== true;
}

/**
 * @param {unknown} proposal
 * @param {unknown} liveRev
 * @returns {string}
 */
export function newerCeBanner(proposal, liveRev) {
	const row = proposal && typeof proposal === "object" ? /** @type {Record<string, unknown>} */ (proposal) : {};
	const stored = String(row.ceRev ?? "").trim();
	const live = String(liveRev ?? "").trim();
	if (!live || live === stored) return "";
	const storedN = Number(stored.replace(/\D/g, ""));
	const liveN = Number(live.replace(/\D/g, ""));
	if (Number.isFinite(storedN) && Number.isFinite(liveN) && liveN <= storedN) return "";
	return `A newer cost estimate revision exists (${live}).`;
}

/**
 * Lines for the Word file and the PDF. Same text in both.
 * @param {any} proposal
 * @returns {string[]}
 */
export function proposalLines(proposal) {
	const row = proposal || {};
	const rev = Number(row.rev) > 0 ? ` Rev ${row.rev}` : "";
	const groups = Array.isArray(row.groups) ? row.groups : [];
	return [
		String(row.header || "Proposal"),
		`PR no. ${row.prNo || "—"}`,
		`PR date ${row.prDate || "—"}`,
		`Control no. ${row.controlNo || "—"}${rev}`,
		`Client ${row.client || "—"}`,
		`Project ${row.project || "—"}`,
		`CE no. ${row.ceNo || row.ceId || "—"} Rev ${row.ceRev || "—"}`,
		"Scope",
		String(row.scope || ""),
		"Price breakdown",
		...groups.map((/** @type {any} */ group) => `${group.label || group.key}: ${Number(group.selling || 0).toFixed(2)}`),
		`Total ${Number(row.total || 0).toFixed(2)}`,
		"Clauses",
		String(row.clauses || ""),
		`Valid until ${row.validUntil || "—"} (${row.validityDays ?? 30} days)`,
		`Sales Rep ${row.salesRepId || ""}`,
		`Approver ${row.approverId || ""}`,
		`Client conforme ${row.clientConforme || ""}`,
	];
}

/**
 * @param {any} input
 * @returns {{ ok: true, proposal: any } | { ok: false, message: string, proposal?: undefined }}
 */
export function createProposal(input) {
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	const controlNo = formatControlNo(input?.controlNo);
	if (!controlNo) return { ok: false, message: "A 4-digit control number from the database is required." };
	const parts = input?.parts;
	if (!parts || typeof parts !== "object") return { ok: false, message: "An approved markup is required." };
	const priced = markedUpGroups(input?.groups, parts);
	if (!(priced.direct > 0)) return { ok: false, message: "The markup has no direct cost to price." };
	const prDate = String(input?.prDate || input?.now || "").slice(0, 10);
	const validityDays = input?.validityDays == null || input.validityDays === "" ? 30 : Number(input.validityDays);
	if (!Number.isFinite(validityDays) || validityDays < 0) return { ok: false, message: "Validity must be a number of days." };
	const proposal = {
		id: controlNo,
		controlNo,
		rev: 0,
		prNo: normalizePrNo(input?.prNo),
		prDate,
		header: String(input?.header || "Proposal"),
		client: String(input?.client || ""),
		project: String(input?.project || ""),
		ceId: String(input?.ceId || ""),
		ceNo: String(input?.ceNo || input?.ceId || ""),
		ceRev: String(input?.ceRev ?? ""),
		scope: String(input?.scope || ""),
		groups: priced.rows,
		direct: priced.direct,
		total: priced.selling,
		percent: priced.percent,
		clauses: String(input?.clauses || DEFAULT_PROPOSAL_CLAUSES),
		validityDays,
		validUntil: validityEnd(prDate, validityDays),
		salesRepId: byUserId,
		approverId: "",
		clientConforme: "",
		status: "Draft",
		finalApproved: false,
		ownerId: byUserId,
		steps: [],
		currentIndex: -1,
		timeline: [entry(byUserId, "Proposal created", "", input?.now)],
	};
	return { ok: true, proposal };
}

/**
 * @param {any} proposal
 * @param {any} patch
 * @param {unknown} [others]
 * @returns {{ ok: true, proposal: any } | { ok: false, message: string, proposal?: undefined }}
 */
export function patchProposal(proposal, patch, others) {
	if (!proposalEditable(proposal)) return { ok: false, message: "This proposal is locked. Revise it to make a new rev." };
	const next = { ...proposal };
	const src = patch && typeof patch === "object" ? patch : {};
	if (src.prNo != null) {
		const prNo = normalizePrNo(src.prNo);
		if (prNoTaken(others, prNo, proposal.controlNo)) return { ok: false, message: "That PR number is already used." };
		next.prNo = prNo;
	}
	if (src.prDate != null) next.prDate = String(src.prDate).slice(0, 10);
	if (src.client != null) next.client = String(src.client);
	if (src.project != null) next.project = String(src.project);
	if (src.scope != null) next.scope = String(src.scope);
	if (src.clauses != null) next.clauses = String(src.clauses);
	if (src.clientConforme != null) next.clientConforme = String(src.clientConforme);
	if (src.header != null) next.header = String(src.header);
	if (src.validityDays != null) {
		const days = Number(src.validityDays);
		if (!Number.isFinite(days) || days < 0) return { ok: false, message: "Validity must be a number of days." };
		next.validityDays = days;
	}
	next.controlNo = proposal.controlNo;
	next.rev = proposal.rev;
	next.id = proposal.id;
	next.validUntil = validityEnd(next.prDate, next.validityDays);
	next.direct = proposal.direct;
	next.total = proposal.total;
	next.groups = proposal.groups;
	return { ok: true, proposal: next };
}

/**
 * @param {any} proposal
 * @param {{ byUserId?: unknown, approverLists?: unknown, others?: unknown, now?: unknown }} input
 * @returns {{ ok: true, proposal: any, toUserId: string } | { ok: false, message: string, proposal?: undefined, toUserId?: undefined }}
 */
export function submitProposal(proposal, input) {
	if (!proposal || proposal.status !== "Draft") return { ok: false, message: "Only a draft can be submitted." };
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId || byUserId !== proposal.ownerId) return { ok: false, message: "Only the Sales owner can submit this proposal." };
	if (!normalizePrNo(proposal.prNo)) return { ok: false, message: "Enter the client's PR number." };
	if (prNoTaken(input?.others, proposal.prNo, proposal.controlNo)) return { ok: false, message: "That PR number is already used." };
	const rows = normalizeApproverLists(input?.approverLists).proposal;
	if (!rows.length) return { ok: false, message: "Add a Proposal approver in Admin." };
	const steps = rows.map((row, index) => ({
		userId: row.userId,
		backupUserId: row.backupUserId,
		isFinal: index === rows.length - 1,
		decision: "",
		byUserId: "",
		at: "",
		remarks: "",
		forUserId: "",
	}));
	return {
		ok: true,
		toUserId: steps[0].userId,
		proposal: {
			...proposal,
			status: "Submitted",
			steps,
			currentIndex: 0,
			timeline: [...(proposal.timeline || []), entry(byUserId, "Proposal submitted", "", input?.now)],
		},
	};
}

/**
 * @param {any} proposal
 * @param {unknown} actorId
 * @returns {boolean}
 */
export function actorMayDecideProposal(proposal, actorId) {
	if (!proposal || proposal.status !== "Submitted") return false;
	const step = (proposal.steps || [])[proposal.currentIndex];
	if (!step) return false;
	const actor = String(actorId || "").trim();
	return actor === step.userId || (!!step.backupUserId && actor === step.backupUserId);
}

/**
 * @param {any} proposal
 * @param {{ actorId?: unknown, decision?: unknown, remarks?: unknown, now?: unknown }} input
 * @returns {{ ok: true, proposal: any, final?: boolean, toUserId?: string } | { ok: false, message: string, proposal?: undefined }}
 */
export function decideProposal(proposal, input) {
	if (!proposal || proposal.status !== "Submitted") return { ok: false, message: "This proposal is not waiting for approval." };
	const actorId = String(input?.actorId || "").trim();
	const steps = (proposal.steps || []).map((/** @type {any} */ step) => ({ ...step }));
	const index = Number(proposal.currentIndex);
	const step = steps[index];
	if (!step) return { ok: false, message: "No approver is assigned." };
	const asPrimary = actorId === step.userId;
	const asBackup = !!step.backupUserId && actorId === step.backupUserId && !asPrimary;
	if (!asPrimary && !asBackup) return { ok: false, message: "This step is for another approver." };
	const decision = input?.decision === "return" ? "return" : input?.decision === "approve" ? "approve" : "";
	if (!decision) return { ok: false, message: "Choose approve or return." };
	const remarks = String(input?.remarks || "").trim();
	if (decision === "return" && !remarks) return { ok: false, message: "A remark is required." };
	const at = input?.now ? String(input.now) : new Date().toISOString();
	const forUserId = asBackup ? step.userId : "";
	const note = forUserId ? [backupSignatureLabel(forUserId), remarks].filter(Boolean).join(" ") : remarks;
	steps[index] = { ...step, decision, byUserId: actorId, at, remarks: note, forUserId };
	const timeline = [...(proposal.timeline || []), entry(actorId, decision === "return" ? "Proposal returned" : "Proposal approved", note, at)];
	if (decision === "return") {
		return { ok: true, proposal: { ...proposal, status: "Draft", finalApproved: false, steps, timeline } };
	}
	if (index >= steps.length - 1) {
		return {
			ok: true,
			final: true,
			proposal: { ...proposal, status: "Approved", finalApproved: true, approverId: actorId, steps, timeline },
		};
	}
	return {
		ok: true,
		final: false,
		toUserId: steps[index + 1].userId,
		proposal: { ...proposal, status: "Submitted", steps, currentIndex: index + 1, timeline },
	};
}

/**
 * @param {any} proposal
 * @param {string} status
 * @param {{ byUserId?: unknown, remarks?: unknown, now?: unknown, requireRemarks?: boolean }} input
 */
function moveStatus(proposal, status, input) {
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	const remarks = String(input?.remarks || "").trim();
	if (input?.requireRemarks && !remarks) return { ok: false, message: "A remark is required." };
	return {
		ok: true,
		proposal: {
			...proposal,
			status,
			timeline: [...(proposal.timeline || []), entry(byUserId, `Proposal ${status.toLowerCase()}`, remarks, input?.now)],
		},
	};
}

/** @param {any} proposal @param {any} input */
export function markProposalSent(proposal, input) {
	if (!proposal || proposal.status !== "Approved") return { ok: false, message: "Only an approved proposal can be sent." };
	return moveStatus(proposal, "Sent", input);
}

/** @param {any} proposal @param {any} input */
export function markProposalLost(proposal, input) {
	if (!proposal || (proposal.status !== "Approved" && proposal.status !== "Sent")) return { ok: false, message: "Only an approved or sent proposal can be lost." };
	return moveStatus(proposal, "Lost", { ...input, requireRemarks: true });
}

/** @param {any} proposal @param {any} input */
export function markProposalExpired(proposal, input) {
	if (!proposal || (proposal.status !== "Approved" && proposal.status !== "Sent")) return { ok: false, message: "Only an approved or sent proposal can expire." };
	return moveStatus(proposal, "Expired", { ...input, requireRemarks: true });
}

/** @param {any} proposal @param {any} input */
export function cancelProposal(proposal, input) {
	if (!proposal || (proposal.status !== "Draft" && proposal.status !== "Submitted")) return { ok: false, message: "This proposal can no longer be cancelled." };
	return moveStatus(proposal, "Cancelled", input);
}

/**
 * Won is set by the job order, not by this screen.
 * @param {any} proposal
 * @param {{ byUserId?: unknown, now?: unknown, remarks?: unknown }} input
 */
export function markProposalWon(proposal, input) {
	if (!proposal || (proposal.status !== "Approved" && proposal.status !== "Sent")) return { ok: false, message: "Only an approved or sent proposal can be won." };
	return moveStatus(proposal, "Won", input);
}

/**
 * @param {any} proposal
 * @param {{ byUserId?: unknown, remarks?: unknown, now?: unknown }} input
 * @returns {{ ok: true, proposal: any } | { ok: false, message: string, proposal?: undefined }}
 */
export function reviseProposal(proposal, input) {
	if (!proposal || (proposal.status !== "Approved" && proposal.status !== "Expired")) return { ok: false, message: "Revise an approved or expired proposal." };
	const byUserId = String(input?.byUserId || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	const remarks = String(input?.remarks || "").trim();
	if (proposal.status === "Expired" && !remarks) return { ok: false, message: "A remark is required." };
	const rev = Number(proposal.rev) || 0;
	return {
		ok: true,
		proposal: {
			...proposal,
			rev: rev + 1,
			controlNo: proposal.controlNo,
			id: proposal.id,
			status: "Draft",
			finalApproved: false,
			approverId: "",
			steps: [],
			currentIndex: -1,
			timeline: [...(proposal.timeline || []), entry(byUserId, "Proposal revised", remarks, input?.now)],
		},
	};
}

/**
 * @param {any} proposal
 * @param {{ byUserId?: unknown, remarks?: unknown, now?: unknown }} input
 */
export function noRevisionNeeded(proposal, input) {
	if (!proposal || proposal.status !== "Expired") return { ok: false, message: "That choice is for an expired proposal." };
	const byUserId = String(input?.byUserId || "").trim();
	const remarks = String(input?.remarks || "").trim();
	if (!byUserId) return { ok: false, message: "An account id is required." };
	if (!remarks) return { ok: false, message: "A remark is required." };
	return {
		ok: true,
		proposal: {
			...proposal,
			status: "Expired",
			timeline: [...(proposal.timeline || []), entry(byUserId, "No revision needed", remarks, input?.now)],
		},
	};
}

/**
 * @param {{ flagOn?: boolean, sales?: boolean, markupStatus?: unknown, existing?: unknown }} input
 * @returns {boolean}
 */
export function canGenerateProposal(input) {
	if (input?.flagOn !== true || input?.sales !== true) return false;
	if (String(input?.markupStatus || "") !== "Approved") return false;
	return !input.existing;
}
