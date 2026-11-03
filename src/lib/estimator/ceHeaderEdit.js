import { sealedStatus } from "./viewOnlySave.js";

/** Fields the header drawer may edit. RCE No. is shown and never written. */
export const HEADER_EDIT_FIELDS = [
	{ key: "clientName", label: "Client name" },
	{ key: "clientAddress", label: "Client address / location" },
	{ key: "attention", label: "Attention / contact person" },
	{ key: "projectDescription", label: "Project description" },
	{ key: "rceNo", label: "RCE No.", readOnly: true },
	{ key: "jobType", label: "Project type / Job type" },
	{ key: "date", label: "Date" },
	{ key: "targetDeadline", label: "Target deadline" },
];

export const HEADER_JOB_TYPES = ["Onsite", "Shop", "Trading", "Hybrid"];

/** @param {any} status */
export function headerEditLocked(status) {
	return sealedStatus(status);
}

/**
 * @param {any} [source]
 */
export function headerEditDraft(source = {}) {
	const info = source.projectInfo || {};
	const meta = source.meta || {};
	const ce = source.ce || {};
	const rce = source.rce || {};
	return {
		clientName: String(meta.client || info.client || ce.client || ""),
		clientAddress: String(info.location || info.clientAddress || meta.location || rce.address || ""),
		attention: String(info.attention || ""),
		projectDescription: String(info.description || meta.title || ce.project || ""),
		rceNo: String(rce.rceNo || rce.id || ce.rceId || ce.rceNo || ""),
		jobType: String(info.jobType || ""),
		date: String(info.date || meta.date || ""),
		targetDeadline: String(info.targetDeadline || ce.targetDeadline || ""),
		locked: headerEditLocked(source.status || source.ceStatus || ce.status),
	};
}

/**
 * Writes the drawer into the CE JSON (projectInfo + meta). No new columns.
 * @param {any} current
 * @param {any} draft
 */
export function applyHeaderEdit(current, draft) {
	const status = current?.status || current?.ceStatus || "";
	if (headerEditLocked(status)) return { ok: false, reason: "locked" };
	const next = draft || {};
	const address = String(next.clientAddress ?? "");
	const projectInfo = {
		...(current?.projectInfo || {}),
		client: String(next.clientName ?? ""),
		location: address,
		clientAddress: address,
		attention: String(next.attention ?? ""),
		description: String(next.projectDescription ?? ""),
		jobType: String(next.jobType ?? ""),
		date: String(next.date ?? ""),
		targetDeadline: String(next.targetDeadline ?? ""),
	};
	const meta = {
		...(current?.meta || {}),
		client: projectInfo.client,
		location: address,
		title: projectInfo.description,
		date: projectInfo.date,
	};
	return {
		ok: true,
		projectInfo,
		meta,
		list: {
			client: projectInfo.client,
			project: projectInfo.description,
			deadline: projectInfo.targetDeadline,
			jobType: projectInfo.jobType,
			address,
			attention: projectInfo.attention,
			date: projectInfo.date,
		},
	};
}

/**
 * What monitoring lists show after a header save. Empty deadline falls back to the RCE.
 * @param {any} ce
 * @param {any} doc
 * @param {any} rce
 */
export function listHeaderValues(ce, doc, rce) {
	const info = doc?.projectInfo || {};
	const meta = doc?.meta || {};
	const savedDeadline = String(info.targetDeadline || ce?.targetDeadline || "").trim();
	return {
		client: String(meta.client || info.client || ce?.client || ""),
		project: String(meta.title || info.description || ce?.project || ""),
		deadline: savedDeadline || rce?.ceDeadline || rce?.submissionDeadline || "",
		address: String(info.location || info.clientAddress || meta.location || ""),
		attention: String(info.attention || ""),
		jobType: String(info.jobType || ""),
		date: String(info.date || meta.date || ""),
	};
}
