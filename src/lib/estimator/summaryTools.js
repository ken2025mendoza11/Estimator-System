// @ts-nocheck
// Pure helpers for the BOL / BOTE / BOCM / PPE summary sheets.
// They never change pricing: they only find, group, filter and plan edits
// to breakdown lines. Totals are still computed by the existing formulas.

export function walkSubs(task) {
  const out = [];
  const walk = (list) => (list || []).forEach((s) => { out.push(s); walk(s.children); });
  walk(task?.subtasks);
  return out;
}

/** Same roll-up key the summary uses (see getScheduledItemMap). */
export function summaryItemKey(category, it) {
  if (!it) return "";
  if (category === "BOL") return `${it.role}~${it.dayType || "Regular"}~${it.shift || "Day"}`;
  if (category === "PPE") return it.item || "";
  return it.description || "";
}

export function summaryItemName(category, it) {
  if (!it) return "";
  if (category === "BOL") return String(it.role || "");
  if (category === "PPE") return String(it.item || "");
  return String(it.description || "");
}

/** Key for a new/named resource (BOL also carries day type + shift). */
export function keyFor(category, name, dayType, shift) {
  const n = String(name || "").trim();
  if (category === "BOL") return `${n}~${dayType || "Regular"}~${shift || "Day"}`;
  return n;
}

/**
 * Every breakdown line that rolls into one summary row.
 * BOL matches role + day type + shift; others match description/item.
 */
export function itemLocations(tasks, category, key, workTypeOf) {
  const rows = [];
  (tasks || []).forEach((t) => {
    walkSubs(t).forEach((s) => {
      (s.items?.[category] || []).forEach((it) => {
        if (summaryItemKey(category, it) !== key) return;
        rows.push({
          taskId: t.id,
          subtaskId: s.id,
          workType: workTypeOf ? workTypeOf(t) : t.workType,
          scope: t.title,
          subtask: s.title,
          item: it,
        });
      });
    });
  });
  return rows;
}

/**
 * Plan how qty lands in one scope (subtask): add onto a matching line, or
 * create a new line. Never splits. Returns { mode, itemId?, from, to }.
 */
export function planMergeIntoScope(subItems, category, key, qty) {
  const add = Number(qty) || 0;
  const hit = (subItems || []).find((it) => summaryItemKey(category, it) === key);
  if (hit) {
    const from = Number(hit.qty) || 0;
    return { mode: "add", itemId: hit.id, from, to: Math.round((from + add) * 1e6) / 1e6 };
  }
  return { mode: "new", from: 0, to: add };
}

/** Days for a new line = the scope's scheduled window (inclusive). */
export function scheduleDays(sched) {
  if (!sched) return 1;
  return Math.max(1, (Number(sched.end) || 0) - (Number(sched.start) || 0) + 1);
}

/** Build a new breakdown line from a masterlist hit (rate from database). */
export function newLineFor(category, { id, name, dayType, shift, qty, days, hit, rate }) {
  const r = Number(rate) || 0;
  const masterlistId = hit?.id || "";
  if (category === "BOL") return { id, masterlistId: masterlistId || null, role: name, dayType: dayType || "Regular", shift: shift || "Day", qty, days, rate: r, otHrs: 0, perDiem: Number(hit?.perDiem) || 0, allowance: Number(hit?.allowance) || 0 };
  if (category === "BOTE") return { id, masterlistId, description: name, qty, days, rate: r, powerKw: Number(hit?.powerKw) || 0, hoursPerDay: Number(hit?.hoursPerDay) || 0, kwhRate: Number(hit?.kwhRate) || 0 };
  if (category === "BOCM") return { id, masterlistId, description: name, qty, unit: String(hit?.unit || "unit"), unitCost: r };
  return { id, masterlistId, item: name, qty, unitCost: r };
}

/**
 * Breakdown notes in one block: grouped by work type (in the given order),
 * sorted A to Z inside each group. Empty groups are dropped.
 */
export function groupSortNotes(groups) {
  const cmp = (a, b) => String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
  return (groups || [])
    .map((g) => ({ ...g, rows: (g.rows || []).slice().sort((a, b) => cmp(a.who, b.who) || cmp(a.notes, b.notes)) }))
    .filter((g) => g.rows.length > 0);
}

export function matchesQuery(label, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return String(label || "").toLowerCase().includes(q);
}

/** Filter only what is shown. Totals must be computed from the unfiltered rows. */
export function filterRows(rows, query, labelOf) {
  const q = String(query || "").trim();
  if (!q) return rows || [];
  return (rows || []).filter((r) => matchesQuery(labelOf(r), q));
}

export function sumBy(rows, pick) {
  return Math.round((rows || []).reduce((s, r) => s + (Number(pick(r)) || 0), 0) * 100) / 100;
}

/** SSS/HDMF/PHIC: formula unless the user typed a value; blank returns to formula. */
export function overrideOr(formulaValue, override) {
  if (override === undefined || override === null || String(override).trim() === "") return formulaValue;
  const n = Number(String(override).replace(/,/g, ""));
  return Number.isFinite(n) ? n : formulaValue;
}
