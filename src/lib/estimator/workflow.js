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
};

export function nowIso() {
  return new Date().toISOString();
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function timelineEntry({
  who,
  action,
  remarks = '',
  snapshot = null,
  rev = '',
}) {
  return {
    id: uid('tl'),
    at: nowIso(),
    who: who || '',
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

export function unreadNotices(list, user) {
  return (list || []).filter(
    (n) =>
      !n.read &&
      (!n.to || n.to === user || n.to === '*' || (n.toRole && n.toRole))
  );
}

export function markNoticesRead(list, user) {
  return (list || []).map((n) =>
    !n.to || n.to === user || n.to === '*' ? { ...n, read: true } : n
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

export function startApproval(steps, actor) {
  const flow = normalizeFlow(steps);
  const startIndex = flow.length > 1 ? 1 : 0;
  return {
    status: 'in-progress',
    currentIndex: startIndex,
    steps: flow.map((s, i) => ({
      ...s,
      decision: i < startIndex ? 'prepared' : '',
      by: i < startIndex ? actor : '',
      at: i < startIndex ? nowIso() : '',
      remarks: '',
    })),
    startedAt: nowIso(),
    startedBy: actor || '',
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

export function applyApprovalDecision(approval, { actor, level, decision, remarks }) {
  if (!approval || approval.status !== 'in-progress') {
    return { ok: false, reason: 'No in-progress approval.' };
  }
  const step = currentApprovalStep(approval);
  if (!canActOnStep(step, level)) {
    return { ok: false, reason: `This step is for ${step?.role || 'an approver'}.` };
  }
  const steps = approval.steps.map((s, i) =>
    i === approval.currentIndex
      ? {
          ...s,
          decision,
          by: actor,
          at: nowIso(),
          remarks: remarks || '',
        }
      : s
  );
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
