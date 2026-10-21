/** Fixed TEST sample rows. No network, no secrets, no random ids. */
import { beginEngineApproval } from "../src/lib/estimator/approvalEngine.js";

/** Labels from CostEstimatorApp.jsx defaultBoardColors(). */
export const RCE_STATUSES = [
	"Pending",
	"In Review",
	"For approval",
	"Waiting for information",
	"Accepted",
	"Rejected",
	"For revision",
	"Cancelled",
];

export const CE_JOB_TYPES = ["Shop", "Onsite", "Trading", "Hybrid"];

export const CE_STATUSES = [
	"Draft",
	"Pending",
	"Ongoing",
	"On Park",
	"Waiting for information",
	"Sourcing",
	"For approval",
	"For revision",
	"Done",
	"No quote",
	"Cancelled",
	"Close bid",
];

export const INSPECTION_STATUSES = ["Filed", "For review", "Noted", "For revision", "Cancelled"];

export const SAMPLE_ROLES = ["staff", "lead", "head", "admin"];
export const QUEUE_LEVELS = ["staff", "lead", "head"];

const CLIENT = "Sample Client";
const WHEN = "2026-10-21";
const APPROVAL_AT = "2026-10-21T00:00:00.000Z";
const QUEUE_OWNER = "Sample admin";

function slug(value) {
	return String(value || "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function dbRole(role) {
	const key = String(role || "").trim().toLowerCase();
	if (key === "reviewer") return "lead";
	if (key === "final approver") return "head";
	if (key === "staff" || key === "lead" || key === "head" || key === "admin") return key;
	return "staff";
}

function workFlags(jobType) {
	const key = String(jobType || "").toLowerCase();
	return {
		shopwork: key === "shop" || key === "hybrid",
		onsite: key === "onsite" || key === "hybrid",
		trading: key === "trading" || key === "hybrid",
	};
}

function userFor(role) {
	const id = `SAMPLE-USER-${slug(role)}`;
	return {
		id,
		sample: true,
		role,
		dbRole: dbRole(role),
		accountStatus: "active",
		name: `Sample ${role}`,
		email: `sample-${slug(role).toLowerCase()}@estimator-test.invalid`,
		declineReason: "",
	};
}

function rceDoc(status, extra = {}) {
	const id = extra.id || `SAMPLE-RCE-${slug(status)}`;
	const flags = workFlags(extra.jobType || "Onsite");
	return {
		kind: "rce",
		id,
		ord: extra.ord,
		sample: true,
		status,
		rev: extra.rev || "0",
		superseded: extra.superseded === true,
		payload: {
			id,
			sample: true,
			client: CLIENT,
			customer: CLIENT,
			projectTitle: extra.projectTitle || `Sample RCE ${status}`,
			location: "Manila",
			description: "Sample data",
			category: extra.jobType || "Onsite",
			status,
			...flags,
			dateReceived: WHEN,
			attachments: [],
			rev: extra.rev || "0",
			superseded: extra.superseded === true,
			supersededBy: extra.supersededBy || "",
			revises: extra.revises || "",
		},
	};
}

function ceDoc({ id, status, jobType, ord, extra = {} }) {
	const flags = workFlags(jobType);
	const project = extra.project || `Sample ${jobType} ${status}`;
	return {
		kind: "ce",
		id,
		ord,
		sample: true,
		status,
		jobType,
		suffix: extra.suffix || "",
		reason: extra.reason || "",
		leadApproval: extra.leadApproval || null,
		owner: extra.owner || "",
		assignedTo: extra.assignedTo || "",
		takeover: extra.takeover || null,
		locked: extra.locked === true,
		approval: extra.approval || null,
		payload: {
			summary: {
				id,
				sample: true,
				client: CLIENT,
				status,
				project,
				lastEdited: WHEN,
				lastEditedBy: extra.assignedTo || extra.owner || "Sample staff",
				location: "Manila",
				rceId: extra.rceId || "SAMPLE-RCE-PENDING",
				jobType,
			},
			document: {
				sample: true,
				id,
				jobType,
				...flags,
				ceStatus: status,
				status,
				locked: extra.locked === true,
				suffix: extra.suffix || "",
				alternateReason: extra.reason || "",
				leadApproval: extra.leadApproval || null,
				owner: extra.owner || "",
				assignedTo: extra.assignedTo || "",
				takeover: extra.takeover || null,
				approval: extra.approval || null,
				meta: {
					client: CLIENT,
					location: "Manila",
					date: WHEN,
					title: project,
					subtitle: "Sample data",
				},
				tasks: [],
				projectInfo: { revNo: extra.rev || "0", docNo: id, quantity: 1 },
			},
		},
	};
}

function inspectionDoc(status, rceId, ceId, ord) {
	const id = `SAMPLE-OIF-${slug(status)}`;
	return {
		kind: "inspection",
		id,
		ord,
		sample: true,
		status,
		basedOnRce: rceId,
		usedByCe: ceId,
		payload: {
			id,
			sample: true,
			oifNo: id,
			status,
			rceNo: rceId,
			rceId,
			basedOnRce: rceId,
			ceId,
			ceNo: ceId,
			usedByCe: ceId,
			date: WHEN,
			customerName: CLIENT,
			projectDescription: "Sample inspection",
			activity: { onsite: true, shopwork: false, supplyOnly: false },
			photos: [],
		},
	};
}

function startedApproval(docNo, flow) {
	const result = beginEngineApproval({
		owner: QUEUE_OWNER,
		actor: QUEUE_OWNER,
		userId: "SAMPLE-USER-ADMIN",
		now: APPROVAL_AT,
		docType: "ce",
		docNo,
		flow,
	});
	if (!result.ok) throw new Error(result.message || `Sample approval failed for ${docNo}`);
	return result.approval;
}

function queueApproval(level, docNo) {
	if (level === "staff") {
		return startedApproval(docNo, {
			mode: "sequential",
			steps: [
				{ id: "sample-staff", title: "Estimate check", role: "staff", assigneeName: "Sample staff" },
				{ id: "sample-staff-final", title: "Approved by Head", role: "head", isFinal: true },
			],
		});
	}
	if (level === "lead") {
		return startedApproval(docNo, {
			mode: "sequential",
			steps: [
				{ id: "sample-lead-prep", title: "Prepared by Estimator", role: "staff" },
				{ id: "sample-lead-review", title: "Reviewed by Lead", role: "lead" },
				{ id: "sample-lead-final", title: "Approved by Head", role: "head", isFinal: true },
			],
		});
	}
	return startedApproval(docNo, {
		mode: "sequential",
		steps: [
			{ id: "sample-head-final", title: "Approved by Head", role: "head", isFinal: true },
		],
	});
}

export function pendingAccounts(users) {
	return (users || []).filter((user) => user.accountStatus === "pending");
}

/** Same rows on every call. Existing legacy and direct-v1 ids are not included. */
export function buildSampleSet() {
	const users = SAMPLE_ROLES.map(userFor);
	users.push({
		...userFor("pending"),
		id: "SAMPLE-USER-PENDING",
		role: "staff",
		dbRole: "staff",
		accountStatus: "pending",
		name: "Sample Pending",
		email: "sample-pending@estimator-test.invalid",
	});
	users.push({
		...userFor("declined"),
		id: "SAMPLE-USER-DECLINED",
		role: "staff",
		dbRole: "staff",
		accountStatus: "declined",
		name: "Sample Declined",
		email: "sample-declined@estimator-test.invalid",
		declineReason: "Sample declined account",
	});

	const docs = [];
	let ord = 100;
	for (const status of RCE_STATUSES) {
		docs.push(rceDoc(status, { ord: ord++ }));
	}
	docs.push(rceDoc("Accepted", {
		id: "SAMPLE-RCE-SUPERSEDED",
		ord: ord++,
		superseded: true,
		supersededBy: "SAMPLE-RCE-ACCEPTED-REV1",
		rev: "0",
		projectTitle: "Sample RCE original",
	}));
	docs.push(rceDoc("Accepted", {
		id: "SAMPLE-RCE-ACCEPTED-REV1",
		ord: ord++,
		rev: "Rev 1",
		revises: "SAMPLE-RCE-SUPERSEDED",
		projectTitle: "Sample RCE Rev 1",
	}));

	for (const jobType of CE_JOB_TYPES) {
		for (const status of CE_STATUSES) {
			docs.push(ceDoc({
				id: `SAMPLE-CE-${slug(jobType)}-${slug(status)}`,
				status,
				jobType,
				ord: ord++,
			}));
		}
	}

	docs.push(ceDoc({
		id: "SAMPLE-CE-ALT-A",
		status: "For approval",
		jobType: "Shop",
		ord: ord++,
		extra: {
			suffix: "-A",
			reason: "Sample alternate",
			project: "Sample alternate CE",
			leadApproval: {
				role: "lead",
				by: "Sample lead",
				decision: "approved",
				at: WHEN,
			},
		},
	}));

	docs.push(ceDoc({
		id: "SAMPLE-CE-TAKEOVER",
		status: "Ongoing",
		jobType: "Onsite",
		ord: ord++,
		extra: {
			project: "Sample taken-over CE",
			owner: "Sample staff",
			assignedTo: "Sample lead",
			takeover: {
				status: "approved",
				owner: "Sample staff",
				by: "Sample lead",
				reason: "Sample take-over",
				decidedBy: "Sample head",
			},
		},
	}));

	docs.push(ceDoc({
		id: "SAMPLE-CE-LOCKED",
		status: "Done",
		jobType: "Hybrid",
		ord: ord++,
		extra: {
			project: "Sample locked CE",
			locked: true,
			approval: { status: "accepted" },
		},
	}));

	for (const level of QUEUE_LEVELS) {
		const id = `SAMPLE-CE-QUEUE-${slug(level)}`;
		docs.push(ceDoc({
			id,
			status: "For approval",
			jobType: "Shop",
			ord: ord++,
			extra: {
				project: `Sample queue for ${level}`,
				owner: QUEUE_OWNER,
				approval: queueApproval(level, id),
			},
		}));
	}

	INSPECTION_STATUSES.forEach((status, index) => {
		const rce = docs.find((doc) => doc.kind === "rce" && doc.status === "Pending" && !doc.superseded);
		const ce = docs.find((doc) => doc.kind === "ce" && doc.jobType === CE_JOB_TYPES[index % CE_JOB_TYPES.length] && doc.status === "Draft");
		docs.push(inspectionDoc(status, rce.id, ce.id, ord++));
	});

	return { users, docs };
}
