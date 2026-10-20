// @ts-nocheck
/**
 * Read-only mobile summary. Approve goes through decideApproval (the Step 8 engine).
 * The viewer does nothing unless features.mobileViewer is exactly true.
 */

import { actorCanDecide, decideApproval } from "./approvalEngine.js";

function text(value) {
	const raw = String(value ?? "").trim();
	return raw || "—";
}

export function mobileSummary({ kind, id, ceList, rceList, documents, inspections }) {
	const key = String(kind || "").toLowerCase();
	const docId = String(id || "");
	if (key === "ce") {
		const ce = (ceList || []).find((row) => row.id === docId) || null;
		const doc = documents?.[docId] || {};
		return {
			kind: "ce",
			id: docId,
			found: !!ce || !!doc.projectInfo,
			title: text(ce?.project || doc?.meta?.title),
			lines: [
				["CE", text(doc?.projectInfo?.docNo || ce?.id)],
				["Client", text(ce?.client || doc?.meta?.client)],
				["Status", text(ce?.status || doc?.ceStatus)],
				["Award", text(doc?.awardStatus || ce?.awardStatus)],
				["Assigned", text(ce?.assignedTo)]
			],
			approval: doc.approval || null
		};
	}
	if (key === "rce") {
		const rce = (rceList || []).find((row) => (row.id || row.rceNo) === docId) || null;
		return {
			kind: "rce",
			id: docId,
			found: !!rce,
			title: text(rce?.projectTitle || rce?.description),
			lines: [
				["RCE", text(rce?.rceNo || rce?.id)],
				["Client", text(rce?.client || rce?.customer)],
				["Status", text(rce?.status)],
				["Company", text(rce?.company)]
			],
			approval: rce?.approval || null
		};
	}
	if (key === "oif") {
		const report = (inspections || []).find((row) => (row.id || row.oifNo) === docId) || null;
		return {
			kind: "oif",
			id: docId,
			found: !!report,
			title: text(report?.projectDescription || report?.project),
			lines: [
				["OIF", text(report?.oifNo || report?.id)],
				["Status", text(report?.status)],
				["CE", text(report?.ceId)]
			],
			approval: report?.approval || null
		};
	}
	return { kind: key, id: docId, found: false, title: "—", lines: [], approval: null };
}

export function mobileCanApprove(summary, actor, level) {
	const approval = summary?.approval;
	if (!approval || approval.engine !== "v2") return false;
	return actorCanDecide(approval, { actor, level });
}

/** Approve only. The engine refuses reject. Returns the decideApproval result, or a closed result. */
export function mobileApprove(summary, actor, level, now) {
	if (!mobileCanApprove(summary, actor, level)) {
		return { ok: false, reason: "Approve is not available on this document." };
	}
	return decideApproval(summary.approval, {
		decision: "approve",
		actor,
		level,
		now
	});
}
