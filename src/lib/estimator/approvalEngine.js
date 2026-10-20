// @ts-nocheck
/** Approval engine v2. Flag off never calls this. In-flight legacy approvals stay on workflow.js. */

const SIGNED = new Set(["prepared", "approve", "approve-comment"]);
const OWNER_BLOCK = "The owner cannot approve this document, and no backup is set.";

export function approvalEngineOn(adminConfig) {
	return adminConfig?.features?.approvalEngineV2 === true;
}

export function validateFlowSteps(steps) {
	const list = Array.isArray(steps) ? steps : [];
	for (const step of list) {
		if (!String(step?.role || "").trim()) return { ok: false, message: "A step needs a role." };
	}
	return { ok: true };
}

function personKey(value) {
	return String(value || "").trim().toLowerCase();
}

function samePerson(a, b) {
	const left = personKey(a);
	const right = personKey(b);
	return !!left && left === right;
}

function assigneeOf(step) {
	return step?.assigneeName || step?.userName || step?.assignee || "";
}

export function normalizeApprovalMode(mode) {
	const value = String(mode || "").trim().toLowerCase();
	if (value === "sequential" || value === "parallel" || value === "mixed") return value;
	return "mixed";
}

function at(now) {
	return now || new Date().toISOString();
}

function roleMatches(stepRole, level) {
	const role = String(stepRole || "").trim().toLowerCase();
	const lvl = String(level || "").trim().toLowerCase();
	if (!role || lvl === "admin") return false;
	if (role === "staff") return lvl === "staff" || lvl === "lead" || lvl === "head";
	if (role === "lead") return lvl === "lead" || lvl === "head";
	if (role === "head") return lvl === "head";
	return lvl === role;
}

function actorMatchesStep(step, actor, level) {
	const named = assigneeOf(step);
	if (String(named).trim()) return samePerson(named, actor);
	return roleMatches(step?.role, level);
}

function isSigned(step) {
	return SIGNED.has(String(step?.decision || ""));
}

export function commentOpen(approval) {
	return (approval?.comments || []).some((item) => item && item.status !== "Fixed");
}

function copyConfigured(steps) {
	return (Array.isArray(steps) ? steps : []).map((step) => ({ ...step }));
}

function runningStep(step, extra) {
	return {
		id: step.id || "",
		title: step.title || "",
		role: step.role || "",
		isFinal: !!extra?.isFinal || !!step.isFinal,
		assigneeName: assigneeOf(step),
		decision: "",
		by: "",
		at: "",
		remarks: "",
		...extra
	};
}

function partyOf(party, fallbackTitle) {
	if (!party || !String(party.role || "").trim()) return null;
	return {
		id: party.id || "",
		title: party.title || fallbackTitle,
		role: String(party.role).trim(),
		assigneeName: assigneeOf(party)
	};
}

/** Blank, 0, and dotted rates stay at 01. Same rule as nextCeRevision. */
export function nextEngineRevision(current) {
	const s = String(current || "").trim();
	if (!s || s === "0" || s === "00" || /^\d+\.\d+$/.test(s)) return "01";
	const match = s.match(/(\d+)\s*$/);
	const n = match ? parseInt(match[1], 10) : 0;
	return String((n || 0) + 1).padStart(2, "0");
}

function resolveChain(flow, owner) {
	const configured = copyConfigured(flow?.steps);
	const check = validateFlowSteps(configured);
	if (!check.ok) return check;
	if (!configured.length) return { ok: false, message: "A step needs a role." };
	const explicit = partyOf(flow?.final, "Final approver");
	let finalStep;
	let reviewers;
	if (explicit) {
		finalStep = { ...explicit, isFinal: true };
		reviewers = configured.filter((step) => !step.isFinal);
	} else {
		const marked = configured.findIndex((step) => step.isFinal);
		const use = marked >= 0 ? marked : configured.length - 1;
		finalStep = { ...configured[use], isFinal: true, assigneeName: assigneeOf(configured[use]) };
		reviewers = configured.filter((_, index) => index !== use);
	}
	if (samePerson(assigneeOf(finalStep), owner)) {
		const backup = partyOf(flow?.backup, "Final approver");
		if (!backup || samePerson(assigneeOf(backup), owner)) return { ok: false, message: OWNER_BLOCK };
		finalStep = { ...backup, isFinal: true, id: backup.id || "final-backup" };
	}
	if (!String(finalStep.role || "").trim()) return { ok: false, message: OWNER_BLOCK };
	reviewers = reviewers.filter((step) => {
		const named = assigneeOf(step);
		return !(named && samePerson(named, owner));
	});
	return { ok: true, configured, reviewers, finalStep };
}

function buildRunning(chain, actor, userId, now) {
	const steps = [];
	chain.reviewers.forEach((step, index) => {
		const named = assigneeOf(step);
		const preparer = index === 0 && !named && (/prepared by/i.test(String(step.title || "")) || String(step.role || "").toLowerCase() === "staff");
		if (preparer) {
			steps.push(runningStep(step, {
				isFinal: false,
				decision: "prepared",
				by: actor || "",
				at: at(now),
				...(userId ? { byUserId: userId } : {})
			}));
		} else steps.push(runningStep(step, { isFinal: false }));
	});
	steps.push(runningStep(chain.finalStep, { isFinal: true }));
	const currentIndex = Math.max(0, steps.findIndex((step) => !isSigned(step)));
	return { steps, currentIndex };
}

export function beginEngineApproval(input = {}) {
	const owner = input.owner || input.actor || "";
	const chain = resolveChain(input.flow || {}, owner);
	if (!chain.ok) return { ok: false, message: chain.message };
	const mode = normalizeApprovalMode(input.flow?.mode);
	const built = buildRunning(chain, input.actor || owner, input.userId || "", input.now);
	const backup = partyOf(input.flow?.backup, "Final approver");
	const approval = {
		engine: "v2",
		status: "in-progress",
		mode,
		docType: input.docType || "",
		docNo: input.docNo || "",
		rev: input.rev == null ? "" : String(input.rev),
		changeKind: input.changeKind || "submit",
		issued: input.changeKind !== "update",
		label: "",
		owner,
		flowSnapshot: {
			mode,
			steps: chain.configured.map((step) => ({ ...step })),
			final: {
				role: chain.finalStep.role,
				title: chain.finalStep.title || "",
				assigneeName: assigneeOf(chain.finalStep)
			},
			backup: backup ? { ...backup } : null
		},
		currentIndex: built.currentIndex,
		steps: built.steps,
		comments: [],
		startedAt: at(input.now),
		startedBy: input.actor || owner || "",
		...(input.userId ? { startedByUserId: input.userId } : {})
	};
	return { ok: true, approval, final: false, rejected: false };
}

export function openStepIndexes(approval) {
	if (!approval || approval.engine !== "v2" || approval.status !== "in-progress") return [];
	const steps = approval.steps || [];
	const mode = normalizeApprovalMode(approval.mode);
	const blockedFinal = commentOpen(approval);
	if (mode === "sequential") {
		const idx = steps.findIndex((step) => !isSigned(step));
		if (idx < 0) return [];
		if (steps[idx].isFinal && blockedFinal) return [];
		return [idx];
	}
	if (mode === "parallel") return steps.map((step, index) => isSigned(step) ? -1 : index).filter((index) => index >= 0);
	const open = [];
	let finalIndex = -1;
	steps.forEach((step, index) => {
		if (step.isFinal) finalIndex = index;
		else if (!isSigned(step)) open.push(index);
	});
	if (open.length) return open;
	if (finalIndex >= 0 && !isSigned(steps[finalIndex]) && !blockedFinal) return [finalIndex];
	return [];
}

function signedElsewhere(approval, actor, index) {
	return (approval.steps || []).some((step, i) => i !== index && step?.by && step?.decision && samePerson(step.by, actor));
}

function ownerBlocked(approval, actor) {
	return samePerson(actor, approval?.owner) || samePerson(actor, approval?.startedBy);
}

export function actorCanDecide(approval, input = {}) {
	if (!approval || approval.engine !== "v2") return false;
	const actor = input.actor || "";
	const level = input.level || "";
	if (ownerBlocked(approval, actor)) return false;
	return openStepIndexes(approval).some((index) => {
		const step = approval.steps[index];
		if (!step || signedElsewhere(approval, actor, index)) return false;
		if (step.isFinal && commentOpen(approval)) return false;
		return actorMatchesStep(step, actor, level);
	});
}

function mapDecision(decision) {
	const value = String(decision || "").trim().toLowerCase();
	if (value === "accept" || value === "approved" || value === "approve") return "approve";
	if (value === "approve-comment" || value === "approve_comment" || value === "approve with comment") return "approve-comment";
	if (value === "request-edit" || value === "request_edit" || value === "request edit") return "request-edit";
	if (value === "reject" || value === "rejected") return "reject";
	return value;
}

function newComment(approval, step, actor, text, now) {
	return {
		id: crypto.randomUUID(),
		status: "Open",
		text: text || "",
		by: actor || "",
		at: at(now),
		stepId: step?.id || ""
	};
}

function finishIfReady(approval) {
	const ready = (approval.steps || []).every(isSigned) && !commentOpen(approval);
	if (!ready) return { approval, final: false, bumpRev: false, revNo: approval.rev || "" };
	const next = { ...approval, status: "accepted" };
	let bumpRev = false;
	if (next.changeKind === "revise") {
		next.inForce = { ...next.inForce || {}, status: "Superseded" };
		bumpRev = true;
	}
	return { approval: next, final: true, bumpRev, revNo: next.rev || "" };
}

export function decideApproval(approval, input = {}) {
	if (!approval || approval.engine !== "v2") return null;
	if (approval.status !== "in-progress") return { ok: false, reason: "No in-progress approval." };
	const decision = mapDecision(input.decision);
	if (decision === "reject") return { ok: false, reason: "Reject is not available." };
	if (decision !== "approve" && decision !== "approve-comment" && decision !== "request-edit") {
		return { ok: false, reason: "This action is not available." };
	}
	const actor = input.actor || "";
	const level = input.level || "";
	if (ownerBlocked(approval, actor)) {
		return { ok: false, reason: "You cannot approve, sign, or return a document you created or submitted." };
	}
	const steps = approval.steps || [];
	const finalIndex = steps.findIndex((step) => step.isFinal && !isSigned(step));
	if (finalIndex >= 0 && actorMatchesStep(steps[finalIndex], actor, level) && commentOpen(approval) && (decision === "approve" || decision === "approve-comment")) {
		return { ok: false, reason: "Fix open comments before the final approver signs." };
	}
	const open = openStepIndexes(approval);
	const index = open.find((i) => actorMatchesStep(steps[i], actor, level) && !signedElsewhere(approval, actor, i) && !(steps[i].isFinal && commentOpen(approval)));
	if (index == null) {
		const waiting = steps[open[0]] || steps[finalIndex] || null;
		if (signedElsewhere(approval, actor, -1)) return { ok: false, reason: "You already signed a step on this document." };
		return { ok: false, reason: `This step is for ${waiting?.role || "an approver"}.` };
	}
	if (signedElsewhere(approval, actor, index)) return { ok: false, reason: "You already signed a step on this document." };
	const step = steps[index];
	if (step.isFinal && decision === "approve-comment") {
		return { ok: false, reason: "Fix open comments before the final approver signs." };
	}
	if (decision === "request-edit") {
		return {
			ok: true,
			approval: {
				...approval,
				status: "edit-requested",
				comments: [...approval.comments || [], newComment(approval, step, actor, input.remarks, input.now)]
			},
			step,
			editRequested: true,
			final: false,
			rejected: false,
			bumpRev: false,
			ceStatus: "For revision"
		};
	}
	const signedSteps = steps.map((item, i) => {
		if (i !== index) return item;
		const next = {
			...item,
			decision,
			by: actor,
			at: at(input.now),
			remarks: input.remarks || ""
		};
		if (input.byUserId) next.byUserId = input.byUserId;
		return next;
	});
	let comments = approval.comments || [];
	if (decision === "approve-comment") comments = [...comments, newComment(approval, step, actor, input.remarks, input.now)];
	const currentIndex = Math.max(0, signedSteps.findIndex((item) => !isSigned(item)));
	const drafted = { ...approval, steps: signedSteps, comments, currentIndex: currentIndex < 0 ? signedSteps.length - 1 : currentIndex };
	const done = finishIfReady(drafted);
	return {
		ok: true,
		approval: done.approval,
		step,
		editRequested: false,
		final: done.final,
		rejected: false,
		bumpRev: done.bumpRev,
		revNo: done.revNo
	};
}

export function fixComment(approval, input = {}) {
	if (!approval || approval.engine !== "v2") return null;
	const comments = (approval.comments || []).map((item) => item?.id === input.commentId ? {
		...item,
		status: "Fixed",
		fixedBy: input.actor || "",
		fixedAt: at(input.now)
	} : item);
	const drafted = { ...approval, comments };
	if (drafted.status !== "in-progress") return { ok: true, approval: drafted, final: false, editRequested: false, rejected: false, bumpRev: false };
	const done = finishIfReady(drafted);
	return {
		ok: true,
		approval: done.approval,
		final: done.final,
		editRequested: false,
		rejected: false,
		bumpRev: done.bumpRev,
		revNo: done.revNo
	};
}

export function planEdit(approval, input = {}) {
	if (!approval || approval.engine !== "v2") return { ok: false, message: "This document is not on the approval engine." };
	const snap = approval.flowSnapshot || {};
	const begun = beginEngineApproval({
		docType: approval.docType,
		docNo: approval.docNo,
		rev: approval.rev,
		owner: approval.owner,
		actor: input.actor || approval.startedBy || "",
		userId: input.userId || "",
		now: input.now,
		changeKind: "edit",
		flow: { mode: snap.mode, steps: snap.steps, final: snap.final, backup: snap.backup }
	});
	if (!begun.ok) return begun;
	begun.approval.commentLog = [...approval.commentLog || [], ...approval.comments || []];
	if (approval.changeKind === "revise") {
		begun.approval.changeKind = "revise";
		begun.approval.inForce = approval.inForce || null;
	}
	return begun;
}

export function planRevise(input = {}) {
	const approval = input.approval || null;
	const issuedRev = input.rev != null ? String(input.rev) : String(approval?.rev || "");
	const pendingRev = nextEngineRevision(issuedRev);
	const flow = input.flow || approval?.flowSnapshot || {};
	const begun = beginEngineApproval({
		docType: input.docType || approval?.docType || "",
		docNo: input.docNo || approval?.docNo || "",
		rev: pendingRev,
		owner: input.owner || approval?.owner || "",
		actor: input.actor || "",
		userId: input.userId || "",
		now: input.now,
		changeKind: "revise",
		flow
	});
	if (!begun.ok) return begun;
	begun.approval.inForce = { rev: issuedRev, status: "in-force", approval };
	return { ok: true, approval: begun.approval, issuedRev, pendingRev, bumpRev: false };
}

export function planUpdate(input = {}) {
	const revText = String(input.rev ?? "0").trim();
	const rev = revText.replace(/^rev\s*/i, "") || "0";
	const n = Number(input.updateCount || 0) + 1;
	const label = `Rev ${rev} - Update ${n}`;
	return {
		ok: true,
		issued: false,
		status: "Internal",
		label,
		approval: {
			engine: "v2",
			changeKind: "update",
			status: "internal",
			issued: false,
			label,
			rev,
			updateNo: n,
			docNo: input.docNo || "",
			docType: input.docType || ""
		}
	};
}
