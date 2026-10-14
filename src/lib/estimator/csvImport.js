// @ts-nocheck
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const SKIP = new Set([
  'no',
  'itemno',
  'itemnumber',
  'actions',
  'action',
  'row',
]);

const PLACEHOLDER = /^(?:-+|—|–|n\/a|na|null|none|\.|nil)$/i;

/** Extra names a CSV may use. The sheet's own header always wins when that column has values. */
const CSV_FIELD_MAP = {
  manpower: {
    role: ['role / position', 'position', 'designation', 'manpower', 'labor', 'labour', 'name'],
    dailyRate: ['daily rate', 'rate/day', 'rate per day'],
    monthlyRate: ['monthly rate', 'rate/month', 'rate per month'],
    perDiem: ['per diem'],
    allowance: ['allowances'],
    active: ['status'],
    lastReviewed: ['last reviewed', 'reviewed', 'date reviewed'],
  },
  equipment: {
    description: ['item', 'tool', 'equipment', 'name'],
    unit: ['uom', 'unit of measure'],
    ratePerDay: ['daily rate', 'rate per day', 'rate/day', 'rate'],
    powerKw: ['kw', 'power', 'power kw', 'power (kw)'],
    hoursPerDay: ['hrs/day', 'hours/day', 'hours per day', 'hrs per day', 'hours'],
    kwhRate: ['kwh', 'php/kwh', 'peso/kwh', 'rate/kwh', '₱/kwh'],
    active: ['status'],
    lastReviewed: ['last reviewed', 'reviewed', 'date reviewed'],
  },
  consumables: {
    description: ['item', 'name', 'material'],
    unit: ['uom', 'unit of measure'],
    unitCost: ['unit cost', 'cost', 'rate', 'price'],
    active: ['status'],
    lastReviewed: ['last reviewed', 'reviewed', 'date reviewed'],
  },
  ppe: {
    item: ['description', 'name', 'ppe'],
    unit: ['uom', 'unit of measure'],
    unitCost: ['unit cost', 'cost', 'rate', 'price'],
    active: ['status'],
    lastReviewed: ['last reviewed', 'reviewed', 'date reviewed'],
  },
  misc: {
    description: ['item', 'name'],
    estimatedCost: ['estimated cost', 'cost', 'amount', 'rate'],
    active: ['status'],
    lastReviewed: ['last reviewed', 'reviewed', 'date reviewed'],
  },
  clients: {
    clientCode: ['client code', 'code', 'abbreviation', 'abbrev', 'client id'],
    fullName: [
      'full name',
      'client name',
      'company',
      'company name',
      'customer',
      'customer name',
      'name',
      'client',
      'legal name',
      'registered name',
      'complete name',
      'name of client',
      'name of company',
      'business name',
      'trade name',
      'company full name',
    ],
    address: ['addr', 'location', 'site', 'address / location', 'site address'],
  },
};

export function normalizeCsvHeader(h) {
  return fold(h)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function fold(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u0000/g, '');
}

function cleanCell(value) {
  return fold(value).trim();
}

function placeholder(value) {
  return PLACEHOLDER.test(cleanCell(value));
}

function cellHasValue(value) {
  const s = cleanCell(value);
  return !!s && !placeholder(s);
}

function unwrapExcelText(value) {
  const s = cleanCell(value);
  const wrapped = s.match(/^="([\s\S]*)"$/);
  return wrapped ? wrapped[1] : s;
}

export function coerceCsvValue(val, type) {
  const s = unwrapExcelText(val);
  if (!cellHasValue(s)) return '';
  if (type !== 'number') return s;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function headerScore(headerNorm, col, aliases) {
  if (!headerNorm || SKIP.has(headerNorm)) return 0;
  const keyN = normalizeCsvHeader(col.key);
  const labelN = normalizeCsvHeader(col.label);
  if (headerNorm === labelN || headerNorm === keyN) return 100;
  const aliasNorms = (aliases || []).map(normalizeCsvHeader).filter(Boolean);
  if (aliasNorms.includes(headerNorm)) return 80;
  if (
    labelN.length >= 4 &&
    (headerNorm.includes(labelN) || labelN.includes(headerNorm))
  ) {
    return 60;
  }
  return 0;
}

function columnFill(grid, headerAt, index) {
  const data = grid.slice((headerAt ?? -1) + 1);
  if (!data.length) return 1;
  let n = 0;
  data.forEach((row) => {
    if (cellHasValue(row?.[index])) n += 1;
  });
  return n / data.length;
}

export function resolveFieldMapping(headers, categoryKey, columns, grid, headerAt) {
  const aliasMap = CSV_FIELD_MAP[categoryKey] || {};
  const cols =
    Array.isArray(columns) && columns.length
      ? columns
      : Object.keys(aliasMap).map((key) => ({
          key,
          label: key,
          type: 'text',
          visible: true,
        }));
  const headerNorms = (headers || []).map((h, index) => ({
    raw: cleanCell(h),
    index,
    norm: normalizeCsvHeader(h),
  }));
  const useFill = Array.isArray(grid) && headerAt != null;
  const pairs = [];
  cols.forEach((col) => {
    headerNorms.forEach((h) => {
      let score = headerScore(h.norm, col, aliasMap[col.key]);
      if (!score) return;
      if (useFill) {
        const fill = columnFill(grid, headerAt, h.index);
        if (fill < 0.2) score -= 65;
        else if (fill >= 0.45) score += 20;
      }
      if (score <= 0) return;
      pairs.push({
        key: col.key,
        index: h.index,
        score: score + (col.visible === false ? 0 : 3),
      });
    });
  });
  pairs.sort((a, b) => b.score - a.score || a.index - b.index);
  const usedH = new Set();
  const usedC = new Set();
  const result = {};
  pairs.forEach((p) => {
    if (usedH.has(p.index) || usedC.has(p.key)) return;
    usedH.add(p.index);
    usedC.add(p.key);
    result[p.key] = p.index;
  });

  const unmatchedCols = cols.filter(
    (c) => result[c.key] == null && c.visible !== false
  );
  const unmatchedHeaders = headerNorms.filter(
    (h) => h.norm && !SKIP.has(h.norm) && !usedH.has(h.index)
  );
  if (
    unmatchedCols.length > 0 &&
    unmatchedCols.length === unmatchedHeaders.length
  ) {
    unmatchedCols.forEach((col, i) => {
      result[col.key] = unmatchedHeaders[i].index;
    });
  }
  return result;
}

function contentScore(data, index, col) {
  const vals = data.map((row) => cleanCell(row?.[index])).filter(cellHasValue);
  if (!vals.length) return 0;
  const avgComma =
    vals.reduce((sum, v) => sum + (v.match(/,/g) || []).length, 0) / vals.length;
  const avgLen = vals.reduce((sum, v) => sum + v.length, 0) / vals.length;
  const avgWords =
    vals.reduce((sum, v) => sum + v.split(/\s+/).filter(Boolean).length, 0) /
    vals.length;
  const numeric =
    vals.filter((v) => /^-?[\d,]+(\.\d+)?$/.test(v.replace(/[₱$\s]/g, ''))).length /
    vals.length;
  if ((col.type || 'text') === 'number') return numeric * 100;
  const labelN = normalizeCsvHeader(col.label);
  const keyN = normalizeCsvHeader(col.key);
  if (
    keyN === 'address' ||
    labelN.includes('address') ||
    labelN.includes('location')
  ) {
    return avgComma * 40 + Math.min(avgLen, 80);
  }
  if (keyN === 'clientcode' || labelN.includes('code') || labelN.includes('abbrev')) {
    const short =
      vals.filter((v) => v.length <= 16 && !v.includes(',')).length / vals.length;
    return short * 90;
  }
  let score = (1 / (1 + avgComma)) * 35 + Math.min(avgWords, 6) * 8 + 8;
  if (avgComma >= 2) score -= 55;
  if (numeric > 0.85) score -= 40;
  return score;
}

function rescueEmptyMappings(fieldIndex, headers, grid, headerAt, categoryKey, columns) {
  const aliasMap = CSV_FIELD_MAP[categoryKey] || {};
  const data = grid.slice(headerAt + 1);
  const used = new Set(Object.values(fieldIndex));
  let unused = [];
  headers.forEach((h, i) => {
    if (used.has(i)) return;
    const norm = normalizeCsvHeader(h);
    if (!norm || SKIP.has(norm)) return;
    if (columnFill(grid, headerAt, i) < 0.35) return;
    unused.push(i);
  });
  if (!unused.length || !columns?.length) return;

  const needs = columns.filter((col) => {
    if (col.visible === false) return false;
    const idx = fieldIndex[col.key];
    if (idx == null) return true;
    return columnFill(grid, headerAt, idx) < 0.2;
  });
  if (!needs.length) return;

  const takenC = new Set();
  const takenI = new Set();
  const claim = (col, index) => {
    const prev = fieldIndex[col.key];
    fieldIndex[col.key] = index;
    if (prev != null) used.delete(prev);
    used.add(index);
    unused = unused.filter((i) => i !== index);
    takenC.add(col.key);
    takenI.add(index);
  };

  const ranked = [];
  needs.forEach((col) => {
    unused.forEach((i) => {
      const hs = headerScore(normalizeCsvHeader(headers[i]), col, aliasMap[col.key]);
      if (!hs) return;
      ranked.push({
        col,
        i,
        score: hs + columnFill(grid, headerAt, i) * 10,
      });
    });
  });
  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((r) => {
    if (takenC.has(r.col.key) || takenI.has(r.i) || !unused.includes(r.i)) return;
    claim(r.col, r.i);
  });

  const needs2 = needs.filter(
    (col) =>
      !takenC.has(col.key) &&
      (fieldIndex[col.key] == null ||
        columnFill(grid, headerAt, fieldIndex[col.key]) < 0.2)
  );
  const unused2 = unused.filter((i) => !takenI.has(i));
  if (!needs2.length || !unused2.length) return;
  const contentRanked = [];
  needs2.forEach((col) => {
    unused2.forEach((i) => {
      const cs = contentScore(data, i, col);
      if (cs >= 28) contentRanked.push({ col, i, score: cs });
    });
  });
  contentRanked.sort((a, b) => b.score - a.score);
  contentRanked.forEach((r) => {
    if (takenC.has(r.col.key) || takenI.has(r.i) || !unused.includes(r.i)) return;
    claim(r.col, r.i);
  });
}

function pickHeaderRow(grid, categoryKey, columns) {
  const limit = Math.min(grid.length, 8);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < limit; i += 1) {
    const score = Object.keys(resolveFieldMapping(grid[i], categoryKey, columns)).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export function mapCsvMatrix(matrix, categoryKey, columns) {
  const grid = (matrix || [])
    .map((row) => (Array.isArray(row) ? row : [row]).map(cleanCell))
    .filter((row) => row.some((cell) => cell !== ''));
  if (!grid.length) throw new Error('No data found in CSV.');

  const headerAt = pickHeaderRow(grid, categoryKey, columns);
  const headers = grid[headerAt];
  if (!headers.some((h) => h)) throw new Error('No column headers found in CSV.');
  const cols = Array.isArray(columns) ? columns : [];
  const fieldIndex = resolveFieldMapping(headers, categoryKey, cols, grid, headerAt);
  rescueEmptyMappings(fieldIndex, headers, grid, headerAt, categoryKey, cols);
  const mappedKeys = Object.keys(fieldIndex);
  if (!mappedKeys.length) {
    throw new Error(
      "No matching columns found. Use this sheet's header names as the CSV column headers."
    );
  }
  const colByKey = new Map(cols.map((c) => [c.key, c]));
  const rows = grid
    .slice(headerAt + 1)
    .map((cells) => {
      const row = {};
      const custom = {};
      mappedKeys.forEach((fieldKey) => {
        const col = colByKey.get(fieldKey);
        const value = coerceCsvValue(cells[fieldIndex[fieldKey]], col?.type || 'text');
        if (col?.isCustom) custom[fieldKey] = value;
        else row[fieldKey] = value;
      });
      if (cells.length > headers.length) {
        const extraCells = cells.slice(headers.length).map(cleanCell).filter(Boolean);
        const nameCol = cols.find((c) =>
          ['fullName', 'role', 'description', 'item', 'name'].includes(c.key)
        );
        const nameKey = nameCol && fieldIndex[nameCol.key] != null ? nameCol.key : '';
        const addressKey = cols.find((c) => c.key === 'address')?.key;
        const oneExtra = extraCells.length === 1 ? extraCells[0] : '';
        const addressNow = addressKey ? String(row[addressKey] || '') : '';
        if (
          oneExtra &&
          nameKey &&
          !cellHasValue(row[nameKey]) &&
          oneExtra.split(/\s+/).length >= 3 &&
          !oneExtra.includes(',') &&
          addressNow.includes(',')
        ) {
          row[nameKey] = oneExtra;
        } else if (extraCells.length) {
          const textKey = [...cols]
            .reverse()
            .find(
              (c) =>
                fieldIndex[c.key] != null &&
                (c.type || 'text') !== 'number' &&
                !c.isCustom
            )?.key;
          if (textKey) {
            row[textKey] = [row[textKey], ...extraCells].filter(Boolean).join(', ');
          }
        }
      }
      if (categoryKey === 'clients' && !cellHasValue(row.fullName) && row.clientCode) {
        const split = String(row.clientCode).match(
          /^([A-Za-z0-9-]{2,16})\s+[-–—|:]\s+(.+)$/
        );
        if (split) {
          row.clientCode = split[1];
          row.fullName = split[2].trim();
        }
      }
      if (Object.keys(custom).length) row.customFields = custom;
      return row;
    })
    .filter((row) => {
      const vals = Object.entries(row)
        .filter(([k]) => k !== 'customFields')
        .map(([, v]) => v);
      if (row.customFields) vals.push(...Object.values(row.customFields));
      return vals.some((v) => String(v ?? '').trim() !== '');
    });

  const matchedLabels = mappedKeys.map((k) => colByKey.get(k)?.label || k);
  const unmatchedLabels = cols
    .filter((c) => c.visible !== false && fieldIndex[c.key] == null)
    .map((c) => c.label || c.key);
  const blankLabels = cols
    .filter(
      (c) =>
        c.visible !== false &&
        fieldIndex[c.key] != null &&
        columnFill(grid, headerAt, fieldIndex[c.key]) < 0.05
    )
    .map((c) => c.label || c.key);
  const repairs = cols
    .filter((c) => fieldIndex[c.key] != null)
    .filter((c) => {
      const hn = normalizeCsvHeader(headers[fieldIndex[c.key]]);
      return hn && hn !== normalizeCsvHeader(c.label) && hn !== normalizeCsvHeader(c.key);
    })
    .map((c) => `${c.label || c.key} taken from “${headers[fieldIndex[c.key]]}”`);
  return {
    rows,
    matchedLabels,
    unmatchedLabels,
    blankLabels,
    repairs,
    sourceHeaders: headers.filter((h) => cleanCell(h)),
    fieldIndex,
  };
}

function fillScore(mapped, columns) {
  const keys = (columns || []).filter((c) => c.visible !== false).map((c) => c.key);
  let score = 0;
  (mapped.rows || []).forEach((row) => {
    keys.forEach((key) => {
      const value = row[key] ?? row.customFields?.[key];
      if (cellHasValue(value)) score += 1;
    });
  });
  return score;
}

function filledCounts(mapped, columns) {
  const keys = (columns || []).filter((c) => c.visible !== false).map((c) => c.key);
  const counts = {};
  keys.forEach((key) => {
    counts[key] = (mapped.rows || []).filter((row) =>
      cellHasValue(row[key] ?? row.customFields?.[key])
    ).length;
  });
  return counts;
}

function keepsFilledFields(nextCounts, prevCounts) {
  return Object.keys(prevCounts).every((key) => nextCounts[key] + 0.01 >= prevCounts[key]);
}

export function parseCsvText(text, categoryKey, columns) {
  const cleaned = fold(text).replace(/^sep\s*=\s*\S+\s*\r?\n/i, '');
  if (!cleaned.trim()) throw new Error('No data found in CSV.');
  const candidates = [
    { delimiter: '' },
    { delimiter: ',' },
    { delimiter: ';' },
    { delimiter: '\t' },
    { delimiter: '|' },
  ];
  let best = null;
  let headerMapped = false;
  candidates.forEach((candidate) => {
    if (headerMapped) return;
    let matrix;
    try {
      matrix = Papa.parse(cleaned, {
        header: false,
        skipEmptyLines: 'greedy',
        delimiter: candidate.delimiter,
      }).data;
    } catch {
      return;
    }
    let mapped;
    try {
      mapped = mapCsvMatrix(matrix, categoryKey, columns);
    } catch {
      return;
    }
    if (!mapped.rows.length) return;
    const counts = filledCounts(mapped, columns);
    const score = fillScore(mapped, columns) - (mapped.unmatchedLabels?.length || 0) * 0.25;
    if (!best) {
      best = { mapped, counts, score };
      if (!(mapped.unmatchedLabels || []).length) headerMapped = true;
      return;
    }
    const improvesEmpty = Object.keys(counts).some((key) => counts[key] > best.counts[key]);
    if (
      improvesEmpty &&
      keepsFilledFields(counts, best.counts) &&
      score >= best.score
    ) {
      best = { mapped, counts, score };
      if (!(mapped.unmatchedLabels || []).length) headerMapped = true;
    }
  });
  if (!best) throw new Error('No data found in CSV.');
  return best.mapped;
}

function matrixFromHtml(text) {
  if (!/<table[\s>]/i.test(text) || !/<t[dh][\s>]/i.test(text)) return null;
  const rows = [];
  const rowRe = /<tr[\s\S]*?<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(text))) {
    const cells = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[0]))) {
      cells.push(
        cellMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&/gi, '&')
          .replace(/&#39;|'/gi, "'")
          .replace(/"/gi, '"')
          .replace(/\s+/g, ' ')
          .trim()
      );
    }
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows.length ? rows : null;
}

function isSpreadsheet(bytes, name) {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return true;
  }
  return /\.xlsx?$/i.test(name || '');
}

export function parseSpreadsheetArray(buf, categoryKey, columns) {
  const wb = XLSX.read(buf, { type: 'array' });
  let best = null;
  wb.SheetNames.forEach((name) => {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });
    let mapped;
    try {
      mapped = mapCsvMatrix(matrix, categoryKey, columns);
    } catch {
      return;
    }
    const score = fillScore(mapped, columns);
    if (!best || score > best.score) best = { score, mapped };
  });
  if (!best) throw new Error('No matching columns found in this spreadsheet.');
  return best.mapped;
}

function decodeCsvBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let text;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le').decode(buf);
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be').decode(buf);
  } else {
    text = new TextDecoder('utf-8').decode(buf);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\u0000/g, '');
}

export function parseDatabaseCSV(file, categoryKey, columns) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.onload = () => {
      try {
        const buf = reader.result;
        const bytes = new Uint8Array(buf);
        if (isSpreadsheet(bytes, file && file.name)) {
          resolve(parseSpreadsheetArray(buf, categoryKey, columns));
          return;
        }
        const text = decodeCsvBuffer(buf);
        const html = matrixFromHtml(text);
        if (html) {
          try {
            const mapped = mapCsvMatrix(html, categoryKey, columns);
            if (mapped.rows.length) {
              resolve(mapped);
              return;
            }
          } catch {
            /* not an HTML table we can use */
          }
        }
        resolve(parseCsvText(text, categoryKey, columns));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function importKey(keyFn, row) {
  try {
    return String(keyFn(row) || '')
      .trim()
      .toLowerCase();
  } catch {
    return '';
  }
}

/** Reimport updates a matching row instead of adding another blank copy. Empty cells do not wipe stored values. */
export function mergeImportedRows(existing, incoming, keyFn) {
  const next = [...(existing || [])];
  const index = new Map();
  next.forEach((row, i) => {
    const key = importKey(keyFn, row);
    if (key && !index.has(key)) index.set(key, i);
  });
  let added = 0;
  let updated = 0;
  (incoming || []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const key = importKey(keyFn, row);
    const patch = {};
    Object.entries(row).forEach(([field, val]) => {
      if (field === 'id') return;
      if (field === 'customFields' && val && typeof val === 'object') {
        const custom = {};
        Object.entries(val).forEach(([ck, cv]) => {
          if (cellHasValue(cv)) custom[ck] = cv;
        });
        if (Object.keys(custom).length) patch.customFields = custom;
        return;
      }
      if (val == null || !cellHasValue(val)) return;
      patch[field] = val;
    });
    if (key && index.has(key)) {
      const at = index.get(key);
      const prev = next[at];
      next[at] = {
        ...prev,
        ...patch,
        customFields: patch.customFields
          ? { ...(prev.customFields || {}), ...patch.customFields }
          : prev.customFields,
        id: prev.id,
      };
      updated += 1;
    } else {
      next.push({ ...row });
      if (key) index.set(key, next.length - 1);
      added += 1;
    }
  });
  return { rows: next, added, updated };
}
