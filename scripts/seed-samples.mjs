// @ts-nocheck
/** Fixed TEST sample rows. No network, no secrets, no random ids. */
import { beginEngineApproval } from "../src/lib/estimator/approvalEngine.js";
import { formatJobOrderNo } from "../src/lib/estimator/docNumbers.js";

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
/** One fixed sample at each Release 1 stage, for every login role. */
export const RELEASE1_STAGES = ["rce", "ce", "markup", "proposal", "jobOrder", "awarded"];

const CLIENT = "Sample Client";
const WHEN = "2026-10-21";
const APPROVAL_AT = "2026-10-21T00:00:00.000Z";
/** Real test-login names. Acting as these is the same person as signing in. */
export const LOGIN_NAMES = {
	staff: "Test Staff",
	lead: "Test Lead",
	head: "Test Head",
	admin: "Test Admin",
};
/** Real test-login ids (src/lib/auth/test-login.ts). A seeded signer id is a real account id, never SAMPLE-USER-*. */
export const LOGIN_IDS = {
	staff: "11111111-1111-4111-8111-111111111111",
	lead: "22222222-2222-4222-8222-222222222222",
	head: "33333333-3333-4333-8333-333333333333",
	admin: "44444444-4444-4444-8444-444444444444",
};
const QUEUE_OWNER = LOGIN_NAMES.admin;
export const ACCEPTED_RCE_ID = "SAMPLE-RCE-ACCEPTED";
export const PENDING_RCE_ID = "SAMPLE-RCE-PENDING";

const ASSIGNEE = {
	Shop: LOGIN_NAMES.staff,
	Onsite: LOGIN_NAMES.lead,
	Trading: LOGIN_NAMES.head,
	Hybrid: LOGIN_NAMES.staff,
};

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

function sampleTasks(jobType) {
	const key = String(jobType || "").toLowerCase();
	const workType = key === "shop" ? "shop" : key === "trading" ? "trading" : "onsite";
	return [
		{
			id: "task-sample-1",
			title: "Sample work",
			expanded: true,
			notes: "",
			files: [],
			duration: 1,
			predecessor: null,
			workType,
			subtasks: [
				{
					id: "sub-sample-1",
					title: "Sample labour",
					expanded: true,
					type: "Sequential",
					predecessor: null,
					notes: "",
					files: [],
					items: {
						BOL: [
							{
								id: "bol-sample-1",
								role: "Rigger",
								qty: 1,
								days: 1,
								rate: 700,
								otHrs: 0,
								dayType: "Regular",
								shift: "Day",
								perDiem: 0,
								allowance: 0,
							},
						],
						BOTE: [],
						BOCM: [],
						PPE: [],
						MISC: [],
					},
					children: [],
				},
			],
		},
	];
}

function signatureInfo(final, submittedBy = "") {
	// A submitted estimate carries the preparer's stamp, the same as the app's submit step.
	if (!final && submittedBy) {
		return { preparedBy: submittedBy, preparedStamp: `${submittedBy} 2026-10-21 08:00`, preparedTitle: "Estimator" };
	}
	if (!final) return {};
	return {
		preparedBy: LOGIN_NAMES.staff,
		preparedStamp: "Test Staff 2026-10-21 08:00",
		reviewedBy: LOGIN_NAMES.lead,
		reviewedStamp: "Test Lead 2026-10-21 09:00",
		approvedBy: LOGIN_NAMES.head,
		approvedStamp: "Test Head 2026-10-21 10:00",
	};
}

function ceDoc({ id, status, jobType, ord, extra = {} }) {
	const flags = workFlags(jobType);
	const project = extra.project || `Sample ${jobType} ${status}`;
	const assignee = extra.assignedTo || ASSIGNEE[jobType] || LOGIN_NAMES.staff;
	const priced = status !== "Draft";
	const approval = extra.approval || (status === "Done" ? { status: "accepted" } : null);
	const rceId = extra.rceId || (status === "Draft" ? PENDING_RCE_ID : ACCEPTED_RCE_ID);
	const signs = signatureInfo(status === "Done" || approval?.status === "accepted", status === "For approval" ? assignee : "");
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
		assignedTo: assignee,
		takeover: extra.takeover || null,
		locked: extra.locked === true,
		approval,
		payload: {
			summary: {
				id,
				sample: true,
				client: CLIENT,
				status,
				project,
				lastEdited: WHEN,
				lastEditedBy: assignee,
				assignedTo: assignee,
				location: "Manila",
				rceId,
				jobType,
				approval,
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
				assignedTo: assignee,
				takeover: extra.takeover || null,
				approval,
				meta: {
					client: CLIENT,
					location: "Manila",
					date: WHEN,
					title: project,
					subtitle: "Sample data",
				},
				tasks: priced ? sampleTasks(jobType) : [],
				projectInfo: { revNo: extra.rev || "0", docNo: id, quantity: 1, ...signs },
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
			createdBy: LOGIN_NAMES.staff,
			onsiteInspector: LOGIN_NAMES.staff,
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
		userId: LOGIN_IDS.admin,
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
				{ id: "sample-staff", title: "Estimate check", role: "staff", assigneeName: LOGIN_NAMES.staff },
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

function release1Markup(ceId, ownerId, role) {
	return {
		ceId,
		directCost: 1000000,
		parts: { profit: 35, contingency: 15, markup: 50 },
		preset: "100",
		selling: 2000000,
		status: "Approved",
		ownerId,
		steps: [],
		currentIndex: -1,
		timeline: [{ id: `sample-markup-${role}`, at: APPROVAL_AT, who: ownerId, action: "Markup approved", remarks: "" }],
	};
}

function release1Proposal({ id, controlNo, status, ceId, ownerId, prNo }) {
	return {
		id,
		sample: true,
		controlNo,
		rev: 0,
		prNo,
		prDate: WHEN,
		header: "Proposal",
		client: CLIENT,
		project: `Sample ${id}`,
		ceId,
		ceNo: ceId,
		ceRev: "0",
		scope: "Sample scope",
		groups: [{ key: "BOL", label: "BOL", direct: 1000000, selling: 2000000 }],
		direct: 1000000,
		total: 2000000,
		percent: 100,
		clauses: "Sample clauses",
		validityDays: 30,
		validUntil: "2026-11-20",
		salesRepId: ownerId,
		ownerId,
		approverId: LOGIN_IDS.head,
		clientConforme: "",
		status,
		finalApproved: true,
		steps: [],
		currentIndex: -1,
		timeline: [{ id: `sample-proposal-${id}`, at: APPROVAL_AT, who: ownerId, action: "Proposal approved", remarks: "" }],
	};
}

function release1JobOrder({ role, seq, controlNo, ceId, ownerId, status }) {
	const joNo = formatJobOrderNo(seq, "SW", "SAM", "2026", controlNo, 0);
	return {
		id: joNo,
		sample: true,
		joNo,
		seq,
		rev: 0,
		type: "SW",
		clientCode: "SAM",
		year: "2026",
		controlNo,
		dateIssued: WHEN,
		client: CLIENT,
		poRef: `PO-${role}`,
		project: `Sample ${role} job order`,
		prNo: `PR R1-${role}-${controlNo}`,
		salesRepId: ownerId,
		salesPosition: "Sales",
		inCharge: "Site lead",
		inChargePosition: "Engineer",
		clientContact: "Client contact",
		clientContactPosition: "Manager",
		duration: "30 days",
		ceIds: [ceId],
		poFileName: `PO-${role}.pdf`,
		poKind: "PO",
		drawingNames: [],
		ceQuantity: [{ id: `sample-qty-${role}`, description: "Welder", role: "Welder", qty: 2, unit: "day" }],
		status,
		finalApproved: status === "Approved",
		ownerId,
		approverId: status === "Approved" ? LOGIN_IDS.lead : "",
		approverFor: "",
		steps: [],
		currentIndex: -1,
		timeline: [{ id: `sample-jo-${role}-${status}`, at: APPROVAL_AT, who: ownerId, action: status === "Approved" ? "Job order approved" : "Job order created", remarks: "" }],
		...(status === "Approved" ? {
			award: {
				joNo,
				ceIds: [ceId],
				proposalControl: controlNo,
				previousCeStatus: { [ceId]: "Done" },
				previousProposalStatus: "Approved",
				at: APPROVAL_AT,
				who: ownerId,
			},
		} : {}),
	};
}

/** Fixed RCE, CE, markup, proposal, job order, and Awarded rows. No network and no random ids. */
export function release1Samples(ordStart = 800) {
	const docs = [];
	const jobOrders = [];
	let ord = ordStart;
	SAMPLE_ROLES.forEach((role, index) => {
		const ownerId = LOGIN_IDS[role];
		const tag = slug(role);
		const rceId = `SAMPLE-R1-${tag}-RCE`;
		const ceId = `SAMPLE-R1-${tag}-CE`;
		const markupId = `SAMPLE-R1-${tag}-MARKUP`;
		const awardedId = `SAMPLE-R1-${tag}-AWARDED`;
		const proposalControl = String(3601 + index);
		const awardedControl = String(3611 + index);
		docs.push(rceDoc("Accepted", { id: rceId, ord: ord++, jobType: "Onsite" }));
		docs.push(ceDoc({
			id: ceId,
			status: "Done",
			jobType: "Onsite",
			ord: ord++,
			extra: { project: `Sample ${role} estimate`, assignedTo: LOGIN_NAMES[role] },
		}));
		const markupDoc = ceDoc({
			id: markupId,
			status: "Done",
			jobType: "Onsite",
			ord: ord++,
			extra: { project: `Sample ${role} markup`, assignedTo: LOGIN_NAMES[role], approval: { status: "accepted" } },
		});
		docs.push(markupDoc);
		const markupRecord = { ...release1Markup(markupId, ownerId, role), id: `SAMPLE-R1-${tag}-MK` };
		docs.push({ kind: "markup", id: markupRecord.id, ord: ord++, sample: true, status: "Approved", payload: markupRecord });
		const proposal = release1Proposal({
			id: `SAMPLE-R1-${tag}-PROPOSAL`,
			controlNo: proposalControl,
			status: "Approved",
			ceId: markupId,
			ownerId,
			prNo: `PR R1-${role}-${proposalControl}`,
		});
		docs.push({ kind: "proposal", id: proposal.id, ord: ord++, sample: true, status: proposal.status, payload: proposal });
		const openJo = release1JobOrder({ role, seq: index + 1, controlNo: proposalControl, ceId: markupId, ownerId, status: "Submitted" });
		jobOrders.push(openJo);
		const awardedJo = release1JobOrder({ role, seq: index + 11, controlNo: awardedControl, ceId: awardedId, ownerId, status: "Approved" });
		jobOrders.push(awardedJo);
		const awarded = ceDoc({
			id: awardedId,
			status: "Awarded",
			jobType: "Onsite",
			ord: ord++,
			extra: { project: `Sample ${role} awarded`, assignedTo: LOGIN_NAMES[role], approval: { status: "accepted" } },
		});
		docs.push(awarded);
		const won = release1Proposal({
			id: `SAMPLE-R1-${tag}-WON`,
			controlNo: awardedControl,
			status: "Won",
			ceId: awardedId,
			ownerId,
			prNo: `PR R1-${role}-${awardedControl}`,
		});
		docs.push({ kind: "proposal", id: won.id, ord: ord++, sample: true, status: won.status, payload: won });
	});
	return { docs, jobOrders, ord };
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
			owner: LOGIN_NAMES.staff,
			assignedTo: LOGIN_NAMES.lead,
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
				assignedTo: LOGIN_NAMES[level],
				approval: queueApproval(level, id),
			},
		}));
	}

	INSPECTION_STATUSES.forEach((status, index) => {
		const jobType = CE_JOB_TYPES[index % CE_JOB_TYPES.length];
		const rce = docs.find((doc) => doc.id === ACCEPTED_RCE_ID);
		const ce = docs.find((doc) => doc.kind === "ce" && doc.jobType === jobType && doc.status === "Done");
		docs.push(inspectionDoc(status, rce.id, ce.id, ord++));
	});

	const release1 = release1Samples(ord);
	docs.push(...release1.docs);

	return { users, docs, jobOrders: release1.jobOrders };
}

/** Role row for the test seed. Active people have a finished profile and have seen the welcome. */
export const ACTIVE_WELCOME_AT = "2026-10-21T00:00:00.000Z";

export function roleRowFor(user) {
	const status = user.accountStatus || "active";
	return {
		user_key: user.userKey || user.userId || user.id,
		email: user.email,
		role: user.dbRole || user.role,
		status,
		display_name: user.name,
		decline_reason: status === "declined" ? user.declineReason || "Sample declined account" : null,
		profile_complete: true,
		welcome_seen_at: status === "active" ? ACTIVE_WELCOME_AT : null,
	};
}

/** Row for public.rce_requests. The cost-estimate foreign key needs this id. */
export function rceRequestRow(doc) {
	const payload = doc?.payload && typeof doc.payload === "object" ? doc.payload : doc || {};
	const id = doc?.id || payload.id;
	return {
		id,
		client: payload.client || "",
		customer: payload.customer || payload.client || "",
		project_title: payload.projectTitle || payload.description || "",
		location: payload.location || "",
		description: payload.description || payload.projectTitle || "",
		category: payload.category || "",
		status: payload.status || doc?.status || "Pending",
		shopwork: Boolean(payload.shopwork),
		onsite: Boolean(payload.onsite),
		trading: Boolean(payload.trading),
		date_received: payload.dateReceived || null,
		rce_no: payload.rceNo || id,
		payload,
	};
}
