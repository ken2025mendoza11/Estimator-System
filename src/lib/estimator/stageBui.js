/** Screen rules for the sales pipeline, team NEW banner, and follow-up labels. */

import { showNewForUser } from "./personalNew.js";

export const TRACKER_STEPS = [
	"RCE approved",
	"CE in progress",
	"CE done",
	"Markup for approval",
	"Proposal for approval",
	"Proposal sent/approved",
];

const DONE_THROUGH = {
	"RCE pending": 0,
	"CE in progress": 1,
	"For markup": 3,
	"Markup approval": 3,
	"For proposal": 4,
	"Proposal approval": 4,
	"Sent/awaiting": 6,
	Won: 6,
	Lost: 6,
	Expired: 6,
};

/**
 * @param {unknown} stage
 * @returns {{ label: string, done: boolean, current: boolean }[]}
 */
export function trackerSteps(stage) {
	const done = /** @type {Record<string, number>} */ (DONE_THROUGH)[String(stage || "")] ?? 0;
	return TRACKER_STEPS.map((label, index) => ({
		label,
		done: index < done,
		current: index === done && done < TRACKER_STEPS.length,
	}));
}

/**
 * @param {any} row
 * @param {string} chip
 * @param {{ userId?: unknown, now?: unknown, config?: { weekendDays?: number[], holidays?: string[] } }} [actor]
 */
export function salesChipMatch(row, chip, actor) {
	const name = String(chip || "All");
	if (name === "All") return true;
	const stage = String(row?.stage || "");
	if (name === "New for me") {
		return showNewForUser({
			userId: actor?.userId,
			targetedIds: row?.targetedIds || [],
			seenBy: row?.seenBy || {},
			createdAt: row?.createdAt,
			now: actor?.now,
			config: actor?.config,
		});
	}
	if (name === "For approval") return stage === "Markup approval" || stage === "Proposal approval";
	if (name === "Waiting for CE") return stage === "RCE pending";
	if (name === "CE in progress") return stage === "CE in progress";
	if (name === "For markup") return stage === "For markup";
	if (name === "For proposal") return stage === "For proposal";
	if (name === "Proposal sent") return stage === "Sent/awaiting";
	if (name === "Awarded/Lost") return stage === "Won" || stage === "Lost";
	return true;
}

/**
 * @param {any} row
 * @param {{ estimator?: boolean, sales?: boolean, owner?: boolean }} actor
 * @returns {string}
 */
export function followLabel(row, actor) {
	const stage = String(row?.stage || row?.status || "");
	const waiting = row?.waitingInfo === true || /waiting for info/i.test(stage);
	if (waiting && actor?.estimator === true) return "Follow up";
	if (waiting && (actor?.sales === true || actor?.owner === true)) return "Respond";
	if (stage === "Sent/awaiting" && (actor?.sales === true || actor?.owner === true)) return "Follow up";
	if ((stage === "CE in progress" || stage === "Ongoing") && actor?.estimator === true && actor?.sales !== true) return "Follow up";
	return "";
}

/**
 * @param {any[]} rows
 * @param {{ userId?: unknown, now?: unknown, config?: { weekendDays?: number[], holidays?: string[] } }} actor
 */
export function teamNewRows(rows, actor) {
	return (rows || []).filter((row) => showNewForUser({
		userId: actor?.userId,
		targetedIds: row?.targetedIds || [],
		seenBy: row?.seenBy || {},
		createdAt: row?.createdAt,
		now: actor?.now,
		config: actor?.config,
	}));
}
