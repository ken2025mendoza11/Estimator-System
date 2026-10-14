// @ts-nocheck
/** Admin-configurable masterlist sort + naming, plus near-duplicate matching. */

export const MASTERLIST_SHEETS = [
  { key: 'manpower', label: 'Manpower', nameField: 'role' },
  { key: 'equipment', label: 'Tools & Equipment', nameField: 'description' },
  { key: 'consumables', label: 'Consumables', nameField: 'description' },
  { key: 'ppe', label: 'Safety & PPE', nameField: 'item' },
  { key: 'misc', label: 'Miscellaneous', nameField: 'description' },
  { key: 'clients', label: 'Clients', nameField: 'fullName' },
];

export const SORT_OPTIONS = [
  { id: 'name-asc', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'reviewed-new', label: 'Last reviewed (newest)' },
  { id: 'reviewed-old', label: 'Last reviewed (oldest)' },
  { id: 'custom', label: 'Custom order (sort #)' },
  { id: 'custom-standard', label: 'Custom Standard' },
];

export const CUSTOM_STANDARD_ORDER = {
  manpower: ['PM', 'Admin', 'Manpower'],
  consumables: [
    'Consumables - Welding',
    'Consumables - Machining',
    'Consumables - Abrasive',
    'Consumables - Sandblast',
    'Consumables - NDT',
    'Consumables - Electrical',
    'Consumables - Gaskets/Sealants',
    'Consumables - Chemicals',
    'Consumables - Gas',
    'Consumables - Painting',
    'Consumables - Shims',
    'Consumables - Accessories',
    'Consumables - Fasteners',
    'Consumables - Rebabbitting',
    'Consumables - General',
    'Materials - Bar',
    'Materials - Plate',
    'Materials - Rod',
    'Materials - Pipe',
    'Materials - Plastic',
    'Materials - Wood',
  ],
  equipment: [
    'Equipment - Welding',
    'Equipment - Machining',
    'Equipment - Sandblast',
    'Equipment - NDT',
    'Equipment - Electrical',
    'Equipment - Lifting',
    'Equipment - Rebabbitting',
    'Equipment - General',
    'Tools - Welding',
    'Tools - Mechanical',
    'Tools - Measuring',
    'Tools - Sandblast',
    'Tools - NDT',
    'Tools - Electrical',
    'Tools - Painting',
    'Tools - Lifting',
    'Tools - Scaffold',
    'Tools - Lighting',
    'Tools - Rebabbitting',
    'Safety Equipment - General',
  ],
  ppe: [
    'PPE - General',
    'PPE - Welding',
    'PPE - Sandblast',
    'PPE - NDT',
    'Safety Equipment - General',
    'Safety Equipment - Tool',
  ],
};

export const NAMING_OPTIONS = [
  { id: 'as-typed', label: 'As typed' },
  { id: 'title', label: 'Title Case' },
  { id: 'upper', label: 'UPPERCASE' },
  { id: 'sentence', label: 'Sentence case' },
];

export function defaultMasterlistRules() {
  const sheets = {};
  MASTERLIST_SHEETS.forEach((s) => {
    sheets[s.key] = { sort: 'name-asc', naming: 'title' };
  });
  return {
    similarity: 0.78,
    sheets,
  };
}

export function normalizeMasterlistRules(raw) {
  const base = defaultMasterlistRules();
  const src = raw && typeof raw === 'object' ? raw : {};
  const sheets = { ...base.sheets };
  MASTERLIST_SHEETS.forEach((s) => {
    const hit = src.sheets?.[s.key] || src[s.key];
    if (hit && typeof hit === 'object') {
      sheets[s.key] = {
        sort: SORT_OPTIONS.some((o) => o.id === hit.sort) ? hit.sort : 'name-asc',
        naming: NAMING_OPTIONS.some((o) => o.id === hit.naming)
          ? hit.naming
          : 'title',
      };
    }
  });
  const sim = Number(src.similarity);
  return {
    similarity: Number.isFinite(sim) ? Math.min(0.95, Math.max(0.5, sim)) : 0.78,
    sheets,
  };
}

export function sheetRule(rules, sheetKey) {
  const all = normalizeMasterlistRules(rules);
  return all.sheets[sheetKey] || { sort: 'name-asc', naming: 'title' };
}

export function itemDisplayName(item, nameField) {
  if (!item) return '';
  return String(
    item[nameField] ||
      item.role ||
      item.description ||
      item.item ||
      item.name ||
      item.fullName ||
      ''
  ).trim();
}

export function applyNaming(value, style) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return raw;
  if (style === 'upper') return raw.toUpperCase();
  if (style === 'sentence') {
    const lower = raw.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  if (style === 'title') {
    return raw
      .split(' ')
      .map((w) => {
        if (!w) return w;
        if (/^[A-Z0-9]{2,}$/.test(w) && w.length <= 5) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }
  return raw;
}

export function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

export function nameSimilarity(a, b) {
  const x = normalizeForMatch(a);
  const y = normalizeForMatch(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) {
    const shorter = Math.min(x.length, y.length);
    const longer = Math.max(x.length, y.length);
    return Math.max(0.82, shorter / longer);
  }
  const d = levenshtein(x, y);
  return 1 - d / Math.max(x.length, y.length);
}

export function findSimilarItems(name, items, nameField, threshold = 0.78) {
  const needle = String(name || '').trim();
  if (!needle) return [];
  return (items || [])
    .map((it) => {
      const label = itemDisplayName(it, nameField);
      return {
        item: it,
        label,
        score: nameSimilarity(needle, label),
      };
    })
    .filter((row) => row.label && row.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function standardToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function standardCandidates(item, nameField) {
  const out = [];
  const push = (value) => {
    const text = String(value ?? '').trim();
    if (text) out.push(text);
  };
  ['category', 'class', 'group', 'section', 'classification', 'itemCategory', 'itemClass', 'type', 'kind'].forEach(
    (key) => push(item?.[key])
  );
  if (item?.customFields && typeof item.customFields === 'object') {
    Object.entries(item.customFields).forEach(([key, value]) => {
      if (/categor|class|group|section|type|kind/i.test(key)) push(value);
      else push(value);
    });
  }
  Object.entries(item || {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;
    if (/categor|class|group|section|type|kind/i.test(key)) push(value);
  });
  push(itemDisplayName(item, nameField));
  return out;
}

function standardMatchScore(value, label) {
  const v = standardToken(value);
  const l = standardToken(label);
  if (!v || !l) return 0;
  if (v === l) return 1000 + l.length;
  const tail = standardToken(String(label).split(/\s+-\s+/).slice(1).join(' '));
  if (tail && v === tail) return 800 + l.length;
  if (v.startsWith(`${l} `) || l.startsWith(`${v} `)) return 600 + l.length;
  return 0;
}

export function customStandardRank(item, sheetKey, nameField) {
  const order = CUSTOM_STANDARD_ORDER[sheetKey] || [];
  if (!order.length) return 0;
  const values = standardCandidates(item, nameField);
  let best = -1;
  let index = order.length;
  order.forEach((label, i) => {
    values.forEach((value) => {
      const score = standardMatchScore(value, label);
      if (score > best) {
        best = score;
        index = i;
      }
    });
  });
  return best > 0 ? index : order.length;
}

export function sortMasterlistItems(items, sortId, nameField, sheetKey) {
  const list = [...(items || [])];
  const nameOf = (it) => itemDisplayName(it, nameField).toLowerCase();
  const reviewed = (it) => Date.parse(it.lastReviewed || '') || 0;
  if (sortId === 'name-desc') {
    list.sort((a, b) => nameOf(b).localeCompare(nameOf(a)));
  } else if (sortId === 'reviewed-new') {
    list.sort((a, b) => reviewed(b) - reviewed(a) || nameOf(a).localeCompare(nameOf(b)));
  } else if (sortId === 'reviewed-old') {
    list.sort((a, b) => reviewed(a) - reviewed(b) || nameOf(a).localeCompare(nameOf(b)));
  } else if (sortId === 'custom') {
    list.sort(
      (a, b) =>
        (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
        nameOf(a).localeCompare(nameOf(b))
    );
  } else if (sortId === 'custom-standard') {
    list.sort((a, b) => {
      const rank = customStandardRank(a, sheetKey, nameField) - customStandardRank(b, sheetKey, nameField);
      return rank || nameOf(a).localeCompare(nameOf(b));
    });
  } else {
    list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }
  return list;
}
