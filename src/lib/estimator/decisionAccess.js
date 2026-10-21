// @ts-nocheck
/**
 * Step 25: Approve / Approve with comment / Request edit show only to the
 * person the open step is assigned to. A named step needs that person. A step
 * with only a role needs that exact role (a higher role does not see it).
 * The engine check (actorCanDecide) still runs first and still guards the decision.
 */
import { actorCanDecide, openStepIndexes } from "./approvalEngine.js";

function key(value) {
	return String(value || "")
		.replace(/^(mr|mrs|ms|miss)\.?\s+/i, "")
		.trim()
		.toLowerCase();
}

export function showDecisionButtons(approval, { actor = "", level = "" } = {}) {
	if (!actorCanDecide(approval, { actor, level })) return false;
	const me = key(actor);
	const lvl = key(level);
	return openStepIndexes(approval).some((index) => {
		const step = approval.steps?.[index];
		if (!step) return false;
		const named = key(step.assigneeName || step.userName || step.assignee);
		if (named) return !!me && named === me;
		return !!lvl && key(step.role) === lvl;
	});
}
