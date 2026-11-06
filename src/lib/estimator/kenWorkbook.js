/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Import Ken's official CE workbook (form SY3-F-TSG-25 / SY3-F-TSG-26) and the
 * older Cover + BOL export that uses Role / Position headers.
 * Masterlist, Procurement Masterlist, and TOOLS(NEW) are never imported.
 * BOL / MOB manpower line math matches the sheet: I = E*G*H, K = H/8*1.3,
 * L = J*K*E*G, M = I+L. Blank and subtotal rows stay unticked.
 * Official export stays ken-template.xlsx / fillCeTemplate.
 */

export const KEN_IGNORED_SHEETS = ["Masterlist", "Procurement Masterlist", "TOOLS(NEW)"];

function norm(value) {
	return String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function text(value) {
	return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function numCell(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	const raw = String(value ?? "").trim();
	if (!raw || raw === "-" || raw === "—" || /^n\/?a$/i.test(raw)) return 0;
	const n = Number(raw.replace(/[,₱\s]/g, "").replace(/[^0-9.-]/g, ""));
	return Number.isFinite(n) ? n : 0;
}

/**
 * Sheet columns: E qty, G days, H rate, J OT hours.
 * I = E*G*H, K = H/8*1.3, L = J*K*E*G, M = I+L.
 * @param {{ qty?: unknown, days?: unknown, rate?: unknown, otHrs?: unknown }} row
 */
export function bolSheetMath(row) {
	const E = numCell(row?.qty);
	const G = numCell(row?.days);
	const H = numCell(row?.rate);
	const J = numCell(row?.otHrs);
	const subtotalA = E * G * H;
	const otRate = (H / 8) * 1.3;
	const subtotalB = J * otRate * E * G;
	const total = subtotalA + subtotalB;
	return { subtotalA, otRate, subtotalB, total };
}

export function isIgnoredKenSheet(name) {
	const token = norm(name);
	return KEN_IGNORED_SHEETS.some((sheet) => norm(sheet) === token);
}

/**
 * @param {string[] | null | undefined} sheetNames
 */
export function workbookKind(sheetNames) {
	const names = (sheetNames || []).map((name) => String(name || "").trim());
	const upper = names.map((name) => name.toUpperCase());
	if (upper.includes("CE SUMMARY") && upper.includes("BOL") && names.some((name) => /MOB\s*&\s*DEMOB/i.test(name))) return "ken-ce";
	if (names.some((name) => /^cover$/i.test(name)) && names.some((name) => /^bol$/i.test(name))) return "old-export";
	return "";
}

function findHeaders(rows, required) {
	const need = required.map(norm);
	const hits = [];
	(rows || []).forEach((row, index) => {
		const cells = (row || []).map(norm).filter(Boolean);
		if (need.every((token) => cells.includes(token))) hits.push(index);
	});
	return hits;
}

function colMap(header) {
	const map = {};
	(header || []).forEach((cell, index) => {
		const token = norm(cell);
		if (!token || map[token] != null) return;
		map[token] = index;
	});
	return map;
}

function cell(row, map, keys) {
	for (const key of keys) {
		const index = map[norm(key)];
		if (index == null) continue;
		return row?.[index];
	}
	return "";
}

function skipLabel(name) {
	const label = text(name);
	if (!label) return "blank";
	if (/^(sub\s*total|subtotal|total|grand total)\b/i.test(label)) return "subtotal";
	if (/^(item|item no\.?|description|manpower loading|role \/ position)$/i.test(label)) return "header";
	return "";
}

function lineFrom(partial) {
	const filled = partial.filled === true;
	return {
		...partial,
		skip: filled ? "" : partial.skip || "blank",
		selected: filled,
	};
}

function manpowerLines(rows, section, category) {
	const headers = findHeaders(rows, ["manpower loading", "qty"]);
	const lines = [];
	headers.forEach((at, index) => {
		const map = colMap(rows[at]);
		const stop = headers[index + 1] ?? rows.length;
		for (let i = at + 1; i < stop; i++) {
			const row = rows[i] || [];
			const loading = text(cell(row, map, ["manpower loading", "manpower loading (role)"]));
			const reason = skipLabel(loading);
			if (reason === "subtotal" || reason === "header") continue;
			if (reason === "blank") continue;
			const qty = cell(row, map, ["qty"]);
			const days = cell(row, map, ["no. of days", "no of days", "days"]);
			const rate = cell(row, map, ["rate per day", "unit cost", "rate/day"]);
			const otHrs = cell(row, map, ["ot hrs per day", "ot hrs"]);
			const written = numCell(cell(row, map, ["total"]));
			const math = bolSheetMath({ qty, days, rate, otHrs });
			const total = written || math.total;
			const filled = written !== 0 || math.total !== 0;
			lines.push(lineFrom({
				section,
				category,
				description: loading,
				role: loading,
				qty: numCell(qty),
				days: numCell(days),
				rate: numCell(rate),
				otHrs: numCell(otHrs),
				unit: text(cell(row, map, ["uom", "unit"])),
				unitPrice: filled ? total : numCell(rate),
				total,
				sheetTotal: written,
				mathTotal: math.total,
				filled,
			}));
		}
	});
	return lines;
}

function qtyLines(rows, section, category) {
	const headers = findHeaders(rows, ["description", "qty"]);
	const lines = [];
	headers.forEach((at, index) => {
		const map = colMap(rows[at]);
		const stop = headers[index + 1] ?? rows.length;
		for (let i = at + 1; i < stop; i++) {
			const row = rows[i] || [];
			const description = text(cell(row, map, ["description", "item description"]));
			const reason = skipLabel(description);
			if (reason) continue;
			const qty = numCell(cell(row, map, ["qty"]));
			const days = numCell(cell(row, map, ["days", "no. of days", "no of days"]));
			const price = numCell(cell(row, map, ["unit price", "rate / unit cost", "unit cost"]));
			const written = numCell(cell(row, map, ["total", "subtotal"]));
			const computed = qty * (days || (written ? 0 : 1)) * (written ? 0 : price);
			const total = written || computed || (days ? qty * days * price : qty * price);
			const filled = written !== 0 || (qty !== 0 && (price !== 0 || days !== 0));
			lines.push(lineFrom({
				section,
				category,
				description,
				role: description,
				qty,
				days,
				rate: price,
				unit: text(cell(row, map, ["uom", "unit"])),
				unitPrice: filled ? total : price,
				total,
				sheetTotal: written,
				filled,
			}));
		}
	});
	return lines;
}

function roleLines(rows) {
	const headers = findHeaders(rows, ["role / position", "qty"]);
	const lines = [];
	headers.forEach((at) => {
		const map = colMap(rows[at]);
		for (let i = at + 1; i < rows.length; i++) {
			const row = rows[i] || [];
			if (findHeaders([row], ["role / position", "qty"]).length) break;
			const role = text(cell(row, map, ["role / position", "role", "position"]));
			const reason = skipLabel(role);
			if (reason === "subtotal" || reason === "header") continue;
			if (!role) continue;
			const qty = numCell(cell(row, map, ["qty"]));
			const days = numCell(cell(row, map, ["days"]));
			const rate = numCell(cell(row, map, ["rate/day", "rate per day"]));
			const written = numCell(cell(row, map, ["subtotal", "total"]));
			const filled = qty !== 0 || written !== 0;
			lines.push(lineFrom({
				section: "BOL",
				category: "BOL",
				description: role,
				role,
				qty,
				days,
				rate,
				unit: "pax",
				unitPrice: filled ? written || rate : rate,
				total: written,
				sheetTotal: written,
				filled,
			}));
		}
	});
	return lines;
}

function sectionTotals(lines) {
	const totals = {};
	(lines || []).forEach((line) => {
		if (!line?.selected) return;
		const key = line.category || "BOL";
		totals[key] = (totals[key] || 0) + numCell(line.total);
	});
	return totals;
}

const KEN_SUMMARY_REFS = {
	A: "MOB & DEMOB!L50",
	B: "MOB & DEMOB!L98",
	C: "BOL!M153",
	D: "BOTE!L43",
	E: "BOCM!L43",
	F: "PPE!L43",
	"G.1": "MISC.!L19",
	"G.2": "MISC.!L30",
	"G.3": "MISC.!L38",
	"G.4": "MISC.!L54",
	"G.5": "MISC.!L64",
};

function grid(book, name) {
	const found = (book?.SheetNames || []).find((sheet) => String(sheet).toUpperCase() === String(name).toUpperCase());
	if (!found) return [];
	return book.grids?.[found] || [];
}

function importKen(book) {
	const lines = [
		...manpowerLines(grid(book, "BOL"), "BOL", "BOL"),
		...manpowerLines(grid(book, "MOB & DEMOB"), "MOB", "BOL"),
		...qtyLines(grid(book, "BOTE"), "BOTE", "BOTE"),
		...qtyLines(grid(book, "BOCM"), "BOCM", "BOCM"),
		...qtyLines(grid(book, "PPE"), "PPE", "PPE"),
		...qtyLines(grid(book, "MISC."), "MISC", "MISC"),
	];
	return { lines, summaryRefs: KEN_SUMMARY_REFS, sections: sectionTotals(lines) };
}

function importOld(book) {
	const lines = [
		...roleLines(grid(book, "BOL")),
		...qtyLines(grid(book, "BOTE"), "BOTE", "BOTE"),
		...qtyLines(grid(book, "BOCM"), "BOCM", "BOCM"),
		...qtyLines(grid(book, "PPE"), "PPE", "PPE"),
		...qtyLines(grid(book, "MISC"), "MISC", "MISC"),
	];
	return { lines, summaryRefs: {}, sections: sectionTotals(lines) };
}

/**
 * @param {{ SheetNames?: string[], grids?: Record<string, unknown[][]> }} book
 */
export function importCostWorkbook(book) {
	const names = book?.SheetNames || [];
	const kind = workbookKind(names);
	const ignored = names.filter((name) => isIgnoredKenSheet(name));
	const body = kind === "ken-ce" ? importKen(book) : kind === "old-export" ? importOld(book) : { lines: [], summaryRefs: {}, sections: {} };
	const used = new Set(body.lines.map((line) => line.section));
	return {
		kind,
		ignored,
		lines: body.lines,
		summaryRefs: body.summaryRefs,
		sections: body.sections,
		sheetsUsed: [...used],
		mapped: {
			columns: [],
			missing: [],
			ignored: ignored.slice(),
			rows: body.lines.map((line, index) => ({
				...line,
				index,
				ken: true,
			})),
			kenSections: ["BOL", "BOTE", "BOCM", "PPE", "MISC"].map((category) => ({
				category,
				rows: body.lines.filter((line) => line.category === category),
			})).filter((section) => section.rows.length),
		},
	};
}

/**
 * @param {typeof import("xlsx")} XLSX
 * @param {any} workbook
 */
export function gridsFromWorkbook(XLSX, workbook) {
	const grids = {};
	(workbook?.SheetNames || []).forEach((name) => {
		if (isIgnoredKenSheet(name)) return;
		const sheet = workbook.Sheets?.[name];
		if (sheet) {
			Object.keys(sheet).forEach((addr) => {
				if (addr.startsWith("!")) return;
				// Excel error code 42 is #N/A. It is not a rate.
				if (sheet[addr] && sheet[addr].t === "e") sheet[addr] = { t: "s", v: "" };
			});
		}
		grids[name] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
	});
	return { SheetNames: workbook.SheetNames || [], grids };
}
