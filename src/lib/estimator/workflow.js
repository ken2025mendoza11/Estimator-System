// @ts-nocheck
/** Shared RCE/CE workflow: timeline, approval, notices, job status. */

export const PEOPLE_SETTABLE = [
  'On Park',
  'Waiting for information',
  'Sourcing',
  'No quote',
];

export const INFO_GAPS = [
  { id: 'drawing', label: 'Drawing / GA' },
  { id: 'spec', label: 'Material specification' },
  { id: 'photos', label: 'Site photos' },
  { id: 'dimensions', label: 'Dimensions / weights' },
  { id: 'duration', label: 'Duration / schedule' },
  { id: 'other', label: 'Other' },
];

export const NOTICE_EVENTS = {
  RCE_ACCEPTED: 'RCE accepted',
  CE_ASSIGNED: 'CE assigned',
  WAIT_INFO: 'Waiting for information',
  INFO_RETURNED: 'Information returned',
  RCE_REVISED: 'RCE revised',
  CE_REJECTED: 'CE rejected',
  TRANSFERRED: 'Transferred',
  ASSIST: 'Assist opened',
  APPROVAL: 'Needs your approval',
  NO_QUOTE: 'No quote',
  CE_APPROVED: 'CE approved',
};

export function nowIso() {
  return new Date().toISOString();
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Calendar date in Asia/Manila (YYYY-MM-DD). No DST; UTC+8 all year. */
export function todayLocal(timeZone = "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/** Add calendar days to the Manila local date. Does not change stored date format. */
export function addDaysLocal(days, timeZone = "Asia/Manila") {
  const [y, m, d] = todayLocal(timeZone).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function uid(_prefix) {
  return crypto.randomUUID();
}

export function timelineEntry({
  who,
  action,
  remarks = '',
  snapshot = null,
  rev = '',
  whoName = '',
}) {
  return {
    id: uid('tl'),
    at: nowIso(),
    who: who || '',
    ...(whoName ? { whoName } : {}),
    action,
    remarks: remarks || '',
    snapshot,
    rev: rev || '',
  };
}

export function appendTimeline(list, entry) {
  return [...(list || []), entry];
}

export function pushNotice(list, notice) {
  return [
    {
      id: uid('nt'),
      at: nowIso(),
      read: false,
      ...notice,
    },
    ...(list || []),
  ].slice(0, 80);
}

export function noticeVisible(notice, user, level, userId = '') {
  if (!notice) return false;
  const toId = notice.toUserId == null ? '' : String(notice.toUserId).trim();
  if (toId) return toId === String(userId || '').trim();
  const to = notice.to == null || String(notice.to).trim() === '' ? '*' : String(notice.to);
  const role = String(notice.toRole || '').trim().toLowerCase();
  if (to !== '*') return to === user;
  if (role) return noticeRoleMatches(level, role);
  return true;
}

function noticeRoleMatches(level, role) {
  const lvl = String(level || '').toLowerCase();
  if (lvl === 'admin') return true;
  if (role === 'staff') return true;
  if (role === 'lead') return lvl === 'lead' || lvl === 'head';
  if (role === 'head') return lvl === 'head';
  return lvl === role;
}

export function unreadNotices(list, user, level, userId = '') {
  return (list || []).filter((n) => !n.read && noticeVisible(n, user, level, userId));
}

export function markNoticesRead(list, user, level, userId = '') {
  return (list || []).map((n) =>
    noticeVisible(n, user, level, userId) ? { ...n, read: true } : n
  );
}

export function userLevel(adminConfig, name) {
  const users = adminConfig?.users || [];
  const hit = users.find(
    (u) =>
      u.name === name ||
      u.email === name ||
      (u.name && name && u.name.toLowerCase() === String(name).toLowerCase())
  );
  return hit?.level || 'staff';
}

export function usersWithLevel(adminConfig, level) {
  return (adminConfig?.users || []).filter(
    (u) => u.level === level && u.status !== 'inactive'
  );
}

export function normalizeFlow(steps) {
  const list = Array.isArray(steps) ? steps.map((s) => ({ ...s })) : [];
  if (!list.length) return list;
  if (!list.some((s) => s.isFinal)) {
    list[list.length - 1] = { ...list[list.length - 1], isFinal: true };
  }
  return list;
}

export function startApproval(steps, actor, userId = '') {
  const flow = normalizeFlow(steps);
  const startIndex = flow.length > 1 ? 1 : 0;
  const signerId = userId || '';
  return {
    status: 'in-progress',
    currentIndex: startIndex,
    steps: flow.map((s, i) => ({
      ...s,
      decision: i < startIndex ? 'prepared' : '',
      by: i < startIndex ? actor : '',
      at: i < startIndex ? nowIso() : '',
      remarks: '',
      ...(i < startIndex && signerId ? { byUserId: signerId } : {}),
    })),
    startedAt: nowIso(),
    startedBy: actor || '',
    ...(signerId ? { startedByUserId: signerId } : {}),
  };
}

export function rceStepTitle(step) {
  if (!step) return '';
  const title = String(step.title || '').trim();
  if (title && !/^(staff|lead|head)$/i.test(title)) return title;
  if (step.role === 'staff') return 'Prepared by Sales';
  if (step.role === 'lead') return 'Reviewed by Sales Manager';
  if (step.role === 'head') return 'Accepted by Final approver';
  return step.label || step.role || 'Step';
}

export function partiesFromApproval(approval) {
  const steps = approval?.steps || [];
  const byRole = (role) => steps.find((s) => s.role === role && s.by)?.by || '';
  const finalStep = [...steps].reverse().find((s) => s.isFinal && s.by);
  return {
    preparedBy: byRole('staff') || steps[0]?.by || '',
    reviewedBy: byRole('lead') || '',
    approvedBy: finalStep?.by || byRole('head') || '',
  };
}

export function currentApprovalStep(approval) {
  if (!approval || approval.status !== 'in-progress') return null;
  return approval.steps?.[approval.currentIndex] || null;
}

export function canActOnStep(step, level) {
  if (!step) return false;
  if (!step.role) return true;
  if (level === 'admin') return true;
  if (step.role === 'staff') return true;
  if (step.role === 'lead') return level === 'lead' || level === 'head';
  if (step.role === 'head') return level === 'head';
  return level === step.role;
}

function personKey(value) {
  return String(value || '').trim().toLowerCase();
}

function samePerson(a, b) {
  const left = personKey(a);
  const right = personKey(b);
  return !!left && left === right;
}

const SIGN_OFF = new Set(['accept', 'approved', 'reject', 'rejected', 'return', 'returned']);

function approvalSodReason(approval, { actor, decision, createdBy, submittedBy }) {
  if (!SIGN_OFF.has(String(decision || '').toLowerCase())) return '';
  const owners = [createdBy, submittedBy, approval?.startedBy, approval?.createdBy, approval?.submittedBy];
  const first = approval?.steps?.[0];
  if (first && personKey(first.decision) === 'prepared') owners.push(first.by);
  if (owners.some((name) => samePerson(name, actor))) {
    return 'You cannot approve, sign, or return a document you created or submitted.';
  }
  const index = approval.currentIndex;
  const prior = (approval.steps || []).some((step, i) => {
    if (i === index) return false;
    if (!step?.decision || !step?.by) return false;
    return samePerson(step.by, actor);
  });
  if (prior) return 'You already signed a step on this document.';
  return '';
}

export function applyApprovalDecision(approval, input = {}) {
  const {
    actor,
    level,
    decision,
    remarks,
    createdBy,
    submittedBy,
    byUserId,
    actedByUserId,
  } = input || {};
  if (!approval || approval.status !== 'in-progress') {
    return { ok: false, reason: 'No in-progress approval.' };
  }
  const step = currentApprovalStep(approval);
  if (!canActOnStep(step, level)) {
    return { ok: false, reason: `This step is for ${step?.role || 'an approver'}.` };
  }
  const sod = approvalSodReason(approval, { actor, decision, createdBy, submittedBy });
  if (sod) return { ok: false, reason: sod };
  const steps = approval.steps.map((s, i) => {
    if (i !== approval.currentIndex) return s;
    const signed = {
      ...s,
      decision,
      by: actor,
      at: nowIso(),
      remarks: remarks || '',
    };
    if (byUserId) signed.byUserId = byUserId;
    if (actedByUserId) signed.actedByUserId = actedByUserId;
    return signed;
  });
  if (decision === 'reject') {
    return {
      ok: true,
      approval: { ...approval, status: 'rejected', currentIndex: approval.currentIndex, steps },
      rejected: true,
      final: false,
    };
  }
  const isFinal = !!step.isFinal || approval.currentIndex >= steps.length - 1;
  if (isFinal) {
    return {
      ok: true,
      approval: { ...approval, status: 'accepted', currentIndex: approval.currentIndex, steps },
      rejected: false,
      final: true,
    };
  }
  return {
    ok: true,
    approval: {
      ...approval,
      status: 'in-progress',
      currentIndex: approval.currentIndex + 1,
      steps,
    },
    rejected: false,
    final: false,
  };
}

export function nextRevLabel(current) {
  const raw = String(current || '0').replace(/^rev\s*/i, '');
  const n = parseInt(raw, 10);
  if (Number.isFinite(n)) return String(n + 1);
  const m = String(current || '').match(/(\d+)/);
  if (m) return String(Number(m[1]) + 1);
  return '1';
}

/** Next printed CE revision. Blank, 0, and dotted rates stay at 01. */
export function nextCeRevision(current) {
  const s = String(current || "").trim();
  if (!s || s === "0" || s === "00" || /^\d+\.\d+$/.test(s)) return "01";
  const m = s.match(/(\d+)\s*$/);
  const n = m ? parseInt(m[1], 10) : 0;
  return String((n || 0) + 1).padStart(2, "0");
}

/** Next revision number already used by a document family, padded to 2 digits. */
export function nextRevisionNo(baseNo, ceList, documents) {
  let max = 0;
  const take = (raw) => {
    const s = String(raw || "").trim();
    if (!s || s === "0" || s === "00" || /^\d+\.\d+$/.test(s)) return;
    const m = s.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  };
  (ceList || []).forEach((ce) => {
    const doc = documents?.[ce.id] || {};
    const docNo = doc.projectInfo?.docNo || "";
    const id = ce.id || "";
    if (docNo === baseNo || id === baseNo || id.startsWith(`${baseNo}-R`)) {
      take(doc.projectInfo?.revNo);
      const tagged = id.match(/-R(\d+)/);
      if (tagged) take(tagged[1]);
    }
  });
  take(documents?.[baseNo]?.projectInfo?.revNo);
  return String(max + 1).padStart(2, "0");
}

export function liveCeForRce(ceList, rceId) {
  if (!rceId) return null;
  return (ceList || []).find(
    (ce) =>
      (ce.rceId === rceId || ce.rceNo === rceId) &&
      ce.status !== 'Cancelled' &&
      ce.status !== 'No quote' &&
      ce.status !== 'Done'
  );
}

export function monthsSince(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
}

export const STALE_RATE_MONTHS = 12;

export function rceHardBlocks(form, company) {
  const fails = [];
  if (!company) fails.push('Pick a company letterhead.');
  if (!String(form?.customer || '').trim()) fails.push('Customer is required.');
  if (!String(form?.projectTitle || '').trim()) fails.push('Project title is required.');
  if (!form?.shopwork && !form?.onsite && !form?.trading) {
    fails.push('Tick at least one work type (Onsite, Shopwork, or Trading).');
  }
  if (!form?.ceDeadline) fails.push('CE deadline is required.');
  if (form?.onsite && !(Number(form?.estDurationDays) > 0)) {
    fails.push('Onsite is ticked — enter estimated duration in days.');
  }
  return fails;
}

export function rceSoftWarns(form, checklist, attachments) {
  const warns = [];
  const drawing = checklist?.item8?.complete;
  if (String(drawing).toUpperCase() === 'NO') {
    warns.push('Drawing / photos marked No.');
  }
  if (form?.onsite && !(Number(form?.estDurationDays) > 0)) {
    warns.push('Duration is blank.');
  }
  const emptyRows = Object.keys(checklist || {}).filter((k) => {
    if (k.includes('_')) return false;
    return !checklist[k]?.complete;
  });
  if (emptyRows.length) {
    warns.push(`${emptyRows.length} checklist row(s) left blank.`);
  }
  if (!(attachments || []).length) warns.push('No attachments uploaded.');
  return warns;
}

export const DEFAULT_OFFICIAL_PACKS = [];

export function rceIsFinalAccepted(rce) {
  if (!rce) return false;
  if (rce.approval?.status === 'accepted') return true;
  const st = String(rce.status || '').toLowerCase();
  return st === 'accepted' || st === 'approved';
}

export function rceCanWithdraw(rce) {
  if (!rce) return false;
  const ap = rce.approval;
  if (!ap || ap.status !== 'in-progress') {
    return rce.status === 'Pending' || rce.status === 'For approval';
  }
  const decided = (ap.steps || []).some(
    (s, i) => i >= 1 && (s.decision === 'accept' || s.decision === 'reject')
  );
  return !decided;
}

export function attachmentSourceTag(source, rev) {
  const r = rev == null || rev === '' ? '0' : String(rev);
  return {
    source: source || 'Estimator',
    tag: `from ${source || 'estimator'} Rev ${r}`,
  };
}

export function jobPeopleMaySet(status) {
  return PEOPLE_SETTABLE.includes(status);
}

export function checksumTotal(n) {
  const v = Number(n) || 0;
  return Math.round(v * 100) / 100;
}

export {
  actorCanDecide,
  approvalEngineOn,
  beginEngineApproval,
  commentOpen,
  decideApproval,
  fixComment,
  nextEngineRevision,
  normalizeApprovalMode,
  openStepIndexes,
  planEdit,
  planRevise,
  planUpdate,
  validateFlowSteps,
} from "./approvalEngine.js";

export {
  canDecideTakeover,
  ceCreateAllowed,
  decideTakeover,
  dueReminderSlots,
  pendingClosingStatus,
  planClosing,
  planTakeover,
  rceChanged,
  rceStamp,
  reminderSlotsUntil,
} from "./reminders.js";

export { matrixAllows, normalizeNotifyMatrix } from "./notifyMatrix.js";

export {
  ceBlocksInspectionLines,
  inspectionNotingSteps,
  isOwnSignaturePath,
  needsDraftWatermark,
  shouldLoadExportSignatures,
  signatureObjectPath,
  signaturePeople,
  signatureUserKey,
} from "./signatures.js";

export {
  canMintAlternate,
  combinedTotal,
  familyKey,
  nextAddendum,
  nextAlternate,
  nextUpdateCopy,
  parseCeNumber,
  planSuffix,
  urgentPlan,
  URGENT_TAG,
} from "./docSuffixes.js";

export { addWorkingDays, isWorkingDay, workingDaysBetween } from "./phCalendar.js";
export { foldFamilyRows } from "./monitoringFamilies.js";
export { constantDrift, priceDrifts, resyncPlan } from "./priceCheck.js";
export { bumpScopeUsage, resourceSeed, saveAsScope } from "./scopeLibrary.js";
export { brandingVars } from "./branding.js";

export { boteLineSnapshot, equipmentRateCard, perDayRate } from "./equipmentRates.js";
export { evaluateFormula } from "./rateFormula.js";
export { buildReport, winRate } from "./reports.js";
export { mobileApprove, mobileSummary } from "./mobileView.js";
export { blocksFinalApproval, canSubmit, runChecker } from "./checker.js";
export { ceIsUnlocked, lineFromQuote, missingPhase8Table } from "./phase8.js";
export { fuelCost, routeSnapshot, truckBanWarning } from "./routeFuel.js";
export { confirmSowSplit, orderExportSections, refreshSchedule } from "./phase10.js";
