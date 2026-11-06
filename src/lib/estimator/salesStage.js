/** Sales stage is derived from the documents. There is no stored stage column. */

import { winRate } from "./reports.js";

export const SALES_STAGES = [
	"RCE pending",
	"CE in progress",
	"For markup",
	"Markup approval",
	"For proposal",
	"Proposal approval",
	"Sent/awaiting",
	"Won",
	"Lost",
	"Expired",
];

/** Flags Ken must turn on for go-live. Live config is not changed here. */
export const GO_LIVE_FLAGS = ["release1Markup", "release1Proposal", "release1Monitor", "release1WithdrawRequest"];

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
	return String(value || "").trim().toLowerCase();
}

/**
 * @param {{ rce?: any, ce?: any, markup?: any, proposal?: any, jobOrder?: any, awardStatus?: unknown }} input
 * @returns {string}
 */
export function deriveSalesStage(input) {
	const ce = input?.ce || {};
	const proposal = input?.proposal || null;
	const markup = input?.markup || null;
	const job = input?.jobOrder || null;
	const award = text(input?.awardStatus || ce.awardStatus);
	const ceStatus = text(ce.status);
	if (text(job?.status) === "approved" || text(proposal?.status) === "won" || award === "awarded" || ceStatus === "awarded") return "Won";
	if (text(proposal?.status) === "lost" || award === "lost" || award === "lost bid") return "Lost";
	if (text(proposal?.status) === "expired") return "Expired";
	if (text(proposal?.status) === "sent") return "Sent/awaiting";
	if (proposal && (text(proposal.status) === "for approval" || text(proposal.status) === "submitted")) return "Proposal approval";
	if (text(markup?.status) === "approved" || (proposal && text(proposal.status) === "draft")) return "For proposal";
	if (markup && (text(markup.status) === "for approval" || text(markup.status) === "submitted")) return "Markup approval";
	if (markup && (text(markup.status) === "draft" || text(markup.status) === "returned")) return "For markup";
	if (ceStatus === "done" || ceStatus === "accepted") return "For markup";
	if (ce && ceStatus && ceStatus !== "cancelled" && ceStatus !== "no quote") return "CE in progress";
	return "RCE pending";
}

/**
 * Awarded ÷ (Awarded + Lost). Null when neither side has a row.
 * @param {any[] | null | undefined} rows
 * @returns {number | null}
 */
export function salesWinRate(rows) {
	return winRate((rows || []).map((row) => {
		const stage = row?.stage || deriveSalesStage(row || {});
		if (stage === "Won") return { awardStatus: "Awarded" };
		if (stage === "Lost") return { awardStatus: "Lost" };
		return {};
	}));
}

/**
 * @param {{ rces?: any[], ces?: any[], markups?: any[], proposals?: any[], jobOrders?: any[], ownerId?: unknown }} input
 * @returns {any[]}
 */
export function salesPipelineRows(input) {
	const markups = input?.markups || [];
	const proposals = input?.proposals || [];
	const jobs = input?.jobOrders || [];
	const ownerFilter = String(input?.ownerId || "");
	/** @type {any[]} */
	const rows = [];
	(input?.ces || []).forEach((ce) => {
		const markup = markups.find((row) => row && (row.ceId === ce.id || row.ceNo === ce.ceNo || row.ceNo === ce.id));
		const proposal = proposals.find((row) => row && (row.ceId === ce.id || row.ceNo === ce.ceNo || row.ceNo === ce.id));
		const jobOrder = jobs.find((row) => row && (row.ceId === ce.id || row.ceNo === ce.ceNo));
		const ownerId = String(ce.salesOwnerId || ce.ownerId || "");
		if (ownerFilter && ownerId !== ownerFilter) return;
		const parts = markup?.parts;
		const markupPct = parts ? Number(parts.profit || 0) + Number(parts.contingency || 0) + Number(parts.markup || 0) : "";
		rows.push({
			id: String(ce.ceNo || ce.id || ""),
			rceNo: String(ce.rceNo || ""),
			ceNo: String(ce.ceNo || ce.id || ""),
			project: String(ce.project || ce.projectTitle || ""),
			ownerId,
			salesOwner: String(ce.salesOwnerName || ownerId),
			stage: deriveSalesStage({ ce, markup, proposal, jobOrder }),
			markup,
			proposal,
			markupPct,
			direct: ce.amount || ce.directCost || "",
			selling: proposal?.total || markup?.selling || "",
			proposalNo: proposal?.prNo || proposal?.controlNo || "",
			validity: proposal?.validUntil || "",
			priority: String(ce.priority || ce.priorityLevel || ""),
			company: String(ce.company || ""),
			createdAt: ce.createdAt || ce.lastEdited || "",
			targetedIds: [ownerId].filter(Boolean),
			seenBy: ce.seenBy || {},
		});
	});
	(input?.rces || []).forEach((rce) => {
		const linked = (input?.ces || []).some((ce) => ce.rceId === rce.id || ce.rceNo === rce.rceNo);
		if (linked) return;
		const ownerId = String(rce.salesOwnerId || rce.ownerId || "");
		if (ownerFilter && ownerId !== ownerFilter) return;
		rows.push({
			id: String(rce.rceNo || rce.id || ""),
			rceNo: String(rce.rceNo || rce.id || ""),
			ceNo: "",
			project: String(rce.projectTitle || rce.project || ""),
			ownerId,
			salesOwner: String(rce.salesOwnerName || ownerId),
			stage: deriveSalesStage({ rce, ce: null }),
			direct: "",
			selling: "",
			markupPct: "",
			proposalNo: "",
			validity: "",
			priority: String(rce.priority || rce.priorityLevel || ""),
			company: String(rce.company || ""),
			createdAt: rce.createdAt || rce.dateReceived || rce.rceDate || "",
			targetedIds: [ownerId].filter(Boolean),
			seenBy: rce.seenBy || {},
		});
	});
	return rows;
}

/**
 * @param {string} stage
 * @param {{ sales?: boolean, manager?: boolean, owner?: boolean, head?: boolean }} role
 * @returns {string[]}
 */
export function stageActions(stage, role) {
	/** @type {string[]} */
	const actions = [];
	if ((role?.owner || role?.manager) && stage === "For markup") actions.push("Generate markup");
	if ((role?.owner || role?.manager) && stage === "For proposal") actions.push("Generate proposal");
	if (role?.sales && stage === "Sent/awaiting") actions.push("Mark sent", "Mark Lost");
	if (stage === "Expired") actions.push("Revise/Close");
	if (role?.head && (stage === "Won" || stage === "Lost" || stage === "Sent/awaiting")) actions.push("Take over");
	if (stage === "RCE pending" || stage === "Markup approval" || stage === "Proposal approval") actions.push("Withdraw");
	return actions;
}

/**
 * @param {any[]} rows
 * @param {unknown} [now]
 */
export function pipelineKpis(rows, now) {
	const list = rows || [];
	const open = list.filter((row) => !["Won", "Lost", "Expired"].includes(row.stage));
	const today = String(now || "").slice(0, 10);
	const expiring = list.filter((row) => {
		const until = String(row.validity || "").slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
		const days = (Date.parse(`${until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
		return days >= 0 && days <= 7;
	}).length;
	/** @type {Record<string, number>} */
	const counts = {};
	SALES_STAGES.forEach((stage) => {
		counts[stage] = list.filter((row) => row.stage === stage).length;
	});
	return {
		win: salesWinRate(list),
		openValue: open.reduce((sum, row) => sum + (Number(row.selling) || 0), 0),
		expiring,
		counts,
	};
}
