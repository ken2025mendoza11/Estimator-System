// @ts-nocheck
// Fills Ken's CE-format Excel template (CE SUMMARY, SOW Breakdown, SCOPE, MOB & DEMOB,
// BOL, BOTE, BOCM, PPE, MISC.) with one estimate. ExcelJS is passed in, so the same
// code runs in the browser (export button) and in Node (tests / samples).
//
//   const buf = await fillCeTemplate(ExcelJS, templateArrayBuffer, buildCeExcelModel(payload));
//
import { calcBOL, calcBOCM, calcBOTE, calcMISC, calcPPE, dolePay } from "./ceTotals.js";

// Template sheets that are NOT in the CE format are removed (lookup / helper sheets):
export const CE_TEMPLATE_IGNORED_SHEETS = [
	"Manpower Cost (Regular Days)",
	"Manpower Cost (Legal Holidays)",
	"Manpower Cost (Benefits&Others)",
	"TOOLS(NEW)",
	"Masterlist",
	"Procurement Masterlist",
];
export const CE_TEMPLATE_SHEETS = ["CE SUMMARY", "SOW Breakdown", "SCOPE", "MOB & DEMOB", "BOL", "BOTE", "BOCM", "PPE", "MISC."];

// Regular OT is 1.25. Rest day, Sunday, special day, and holiday OT are 1.30.
export const CE_OT_FACTOR = 1.25;
export function ceOtFactor(dayType) {
	return /sun|special|holiday|rest|legal|non/i.test(String(dayType || "")) ? 1.3 : CE_OT_FACTOR;
}

const num = (v) => {
	if (typeof v === "number") return Number.isFinite(v) ? v : 0;
	const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
	return Number.isFinite(n) ? n : 0;
};
const txt = (v) => String(v ?? "").trim();
const lines = (task, key) => (task.subtasks || []).flatMap(function walk(s) {
	return [...(s.items?.[key] || []), ...(s.children || []).flatMap(walk)];
});
const MISC_BLOCK_OF_SECTION = { A: "A", B: "B", C: "C", D: "D", E: "E", I: "INS" };

// ---------- model ----------
export function buildCeExcelModel(payload) {
	const tasks = payload.tasks || [];
	const summary = (payload.sections || []).find((s) => s.title === "CE Summary") || {};
	const pb = summary.projectBlock || {};
	// Same signatory blocks the PDF draws (summary.signs: Prepared, Checked, Noted, Approved, Reviewed, Checked, Concurred).
	const signs = summary.signs || [];
	const sg = (i) => signs[i] || {};
	const sig = {
		preparedBy: sg(0).name, preparedTitle: sg(0).title, checkedBy: sg(1).name, checkedTitle: sg(1).title,
		notedBy: sg(2).name, notedTitle: sg(2).title, approvedBy: sg(3).name, approvedTitle: sg(3).title,
		reviewedBy: sg(4).name, reviewedTitle: sg(4).title, checkedBy2: sg(5).name, checkedTitle2: sg(5).title,
		concurredBy: sg(6).name, concurredTitle: sg(6).title,
	};
	const sow = (payload.sections || []).find((s) => s.title === "Scope of Work") || {};
	const mob = (payload.sections || []).find((s) => s.title === "Mobilization");
	const demob = (payload.sections || []).find((s) => s.title === "Demobilization");
	const all = (key) => tasks.flatMap((t) => lines(t, key).map((it) => ({ ...it, workType: t.workType, task: t })));
	const pricing = payload.pricing;
	const bol = all("BOL").map((it) => {
		const line = calcBOL(it, pricing);
		const pay = dolePay(num(it.rate), txt(it.dayType || "Regular"), txt(it.shift || "Day"), pricing && pricing.formula);
		return {
			designation: txt(it.role || it.designation),
			qty: num(it.qty), uom: txt(it.uom || "pax"), days: num(it.days), rate: num(it.rate), otHrs: num(it.otHrs),
			dayType: txt(it.dayType || "Regular"), shift: txt(it.shift || "Day"),
			otRate: pay.otRate, amount: line.subtotal, benefits: pricing && pricing.model === "direct-v1" ? line.benefits : 0,
		};
	});
	const bote = all("BOTE").map((it) => {
		const amount = calcBOTE(it, it.workType);
		const use = num(it.qty) * (num(it.days) || 1) * num(it.rate ?? it.unitCost);
		return {
			description: txt(it.description), qty: num(it.qty), uom: txt(it.unit || it.uom || "unit"), days: num(it.days) || 1,
			price: num(it.rate ?? it.unitCost), electricity: it.workType === "onsite" ? 0 : amount - use, amount,
		};
	});
	const bocm = all("BOCM").map((it) => ({ description: txt(it.description), qty: num(it.qty), uom: txt(it.unit || it.uom || "pc"), price: num(it.unitCost ?? it.rate), amount: calcBOCM(it) }));
	const ppe = all("PPE").map((it) => ({ description: txt(it.description || it.item), qty: num(it.qty), uom: txt(it.unit || it.uom || "pc"), price: num(it.unitCost ?? it.rate), amount: calcPPE(it) }));
	const misc = all("MISC").map((it) => ({ block: MISC_BLOCK_OF_SECTION[it.section] || "D", description: txt(it.description).toUpperCase(), qty: num(it.qty), uom: txt(it.unit || it.uom || "lot"), days: it.days == null || it.days === "" ? 1 : num(it.days), price: num(it.unitCost ?? it.rate), amount: calcMISC(it, pricing) }));
	const mobPart = (section) => {
		const blocks = section?.blocks || [];
		const lineRows = (b) => (b?.rows || []).filter((_, i) => (b.rowMeta?.[i]?.kind || "line") === "line");
		return {
			manpower: lineRows(blocks[0]).map((r) => ({ designation: txt(r[1]), qty: num(r[2]), uom: txt(r[3] || "pax"), days: num(r[4]), rate: num(r[5]) })),
			allowance: lineRows(blocks[1]).map((r) => ({ description: txt(r[1]).toUpperCase() === "SKILLED" ? "SKILLED MANPOWER" : txt(r[1]).toUpperCase(), qty: num(r[2]), uom: txt(r[3] || "pax"), days: num(r[4]), price: num(r[5]) })),
			lines: lineRows(blocks[2]).map((r) => ({ description: txt(r[1]).toUpperCase(), qty: num(r[2]), uom: txt(r[3]), days: num(r[4]), price: num(r[5]) })),
		};
	};
	return {
		// ISO form header, same constants as drawExportChrome (isoDocNo / isoRev / isoRevDate).
		docNo: "F-TSG-025",
		revNo: "00",
		revDate: "N/A",
		ceNumber: txt(payload.ceNumber || pb.docNo),
		project: pb,
		notes: (summary.notes || []).map((n) => txt(typeof n === "string" ? n : n.text)).filter(Boolean),
		signatures: sig,
		sowHtml: String(sow.sowHtml || ""),
		sowBlocks: null,
		tasks: tasks.map((t) => ({
			title: txt(t.title), workType: t.workType,
			manpower: lines(t, "BOL").map((it) => ({ d: txt(it.role || it.designation), q: num(it.qty), u: "pax" })),
			tools: lines(t, "BOTE").map((it) => ({ d: txt(it.description), q: num(it.qty), u: txt(it.unit || "unit") })),
			consumables: lines(t, "BOCM").map((it) => ({ d: txt(it.description), q: num(it.qty), u: txt(it.unit || "pc") })),
			ppe: lines(t, "PPE").map((it) => ({ d: txt(it.description || it.item), q: num(it.qty), u: txt(it.unit || "pc") })),
			misc: lines(t, "MISC").map((it) => ({ d: txt(it.description), q: num(it.qty), u: txt(it.unit || "lot") })),
		})),
		bol, bote, bocm, ppe, misc,
		benefits: bol.reduce((sum, row) => sum + num(row.benefits), 0),
		mob: mobPart(mob), demob: mobPart(demob),
	};
}

// SOW rich text -> numbered lines ("1. Main task", "    a. Sub-task"), no DOM needed.
export function sowHtmlToLines(html) {
	const out = [];
	const counters = [];
	let depth = 0;
	let buf = "";
	const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
	const flush = () => {
		const text = decode(buf).replace(/\s+/g, " ").trim();
		buf = "";
		if (!text) return;
		if (depth === 0) { out.push(text); return; }
		counters[depth - 1] = (counters[depth - 1] || 0) + 1;
		const n = counters[depth - 1];
		const marker = depth === 1 ? `${n}.` : `${String.fromCharCode(96 + ((n - 1) % 26) + 1)}.`;
		out.push(`${"    ".repeat(depth - 1)}${marker} ${text}`);
	};
	String(html || "").split(/(<[^>]+>)/).forEach((part) => {
		const tag = part.match(/^<\s*(\/)?\s*([a-z0-9]+)/i);
		if (!tag) { buf += part; return; }
		const [, close, name] = tag;
		const t = name.toLowerCase();
		if (t === "ul" || t === "ol") { flush(); if (close) { counters[depth] = 0; depth -= 1; } else { depth += 1; counters[depth - 1] = 0; } }
		else if (t === "li" || t === "p" || t === "div" || /^h[1-6]$/.test(t) || t === "br") flush();
	});
	flush();
	return out;
}

// ---------- tiny formula evaluator (enough for the template's formulas) ----------
const colNum = (c) => c.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
function makeEvaluator(wb) {
	const memo = new Map();
	const value = (sheet, addr) => {
		const key = `${sheet}!${addr}`;
		if (memo.has(key)) return memo.get(key);
		const ws = wb.getWorksheet(sheet);
		if (!ws) return null;
		const cell = ws.getCell(addr);
		// Covered cells of a merge are empty in Excel (ExcelJS echoes the anchor's value there).
		if (cell.isMerged && cell.master && cell.master.address !== cell.address) { memo.set(key, null); return null; }
		const v = cell.value;
		let out;
		if (v && typeof v === "object" && "formula" in v) { memo.set(key, 0); out = evaluate(sheet, v.formula); }
		else if (v && typeof v === "object" && "richText" in v) out = v.richText.map((r) => r.text).join("");
		else out = v ?? null;
		memo.set(key, out);
		return out;
	};
	const range = (sheet, a, b) => {
		const [, c1, r1] = a.replace(/\$/g, "").match(/([A-Z]+)(\d+)/);
		const [, c2, r2] = b.replace(/\$/g, "").match(/([A-Z]+)(\d+)/);
		const out = [];
		for (let r = +r1; r <= +r2; r++) for (let c = colNum(c1); c <= colNum(c2); c++) out.push(value(sheet, `${colName(c)}${r}`));
		return out;
	};
	const flat = (args) => args.flat(Infinity);
	const n = (v) => (typeof v === "number" ? v : typeof v === "boolean" ? +v : (v === null || v === "" ? 0 : Number(v) || 0));
	const fns = {
		SUM: (...a) => flat(a).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0),
		PRODUCT: (...a) => { const xs = flat(a).filter((v) => typeof v === "number"); return xs.length ? xs.reduce((p, v) => p * v, 1) : 0; },
		SUBTOTAL: (code, ...a) => code === 103 ? flat(a).filter((v) => v !== null && v !== "").length : fns.SUM(...a),
		IFERROR: (v, alt) => (v === undefined || Number.isNaN(v) ? alt : v),
		MAX: (...a) => Math.max(...flat(a).filter((v) => typeof v === "number"), 0),
	};
	function evaluate(sheet, formula) {
		const ref = (s) => s.replace(/^'|'$/g, "").replace(/''/g, "'");
		const js = formula
			.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
			.replace(/((?:'[^']+'|[A-Za-z0-9_.]+)!)?\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)/g, (_, sh, c1, r1, c2, r2) => `R(${JSON.stringify(sh ? ref(sh.slice(0, -1)) : sheet)},"${c1}${r1}","${c2}${r2}")`)
			.replace(/((?:'[^']+'|[A-Za-z0-9_.]+)!)?(?<![A-Za-z"])\$?([A-Z]{1,3})\$?(\d+)(?![\d(A-Za-z"])/g, (_, sh, c, r) => `V(${JSON.stringify(sh ? ref(sh.slice(0, -1)) : sheet)},"${c}${r}")`)
			;
		try {
			const f = new Function("R", "V", "F", "N", `with (F) { return (${js.replace(/V\(([^)]*)\)/g, "N(V($1))")}); }`);
			const out = f(range, value, fns, (v) => (typeof v === "string" && !/^[-\d.]+$/.test(v) ? v : n(v)));
			return typeof out === "number" && !Number.isFinite(out) ? 0 : out;
		} catch {
			return undefined;
		}
	}
	return { value, evaluate };
}

// ---------- fill ----------
const FORMULA_DEAD = /Masterlist|SOW Breakdown'!|Manpower Cost|TOOLS\(NEW\)|_xlfn/;
export async function fillCeTemplate(ExcelJS, templateBuffer, model) {
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(templateBuffer);
	CE_TEMPLATE_IGNORED_SHEETS.forEach((name) => { const ws = wb.getWorksheet(name); if (ws) wb.removeWorksheet(ws.id); });
	wb.definedNames.model = (wb.definedNames.model || []).filter((d) => !(d.ranges || []).some((r) => CE_TEMPLATE_IGNORED_SHEETS.some((s) => r.includes(s))));

	// Shared / array formulas become plain formulas so single cells can be rewritten safely.
	wb.worksheets.forEach((ws) => ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
		const v = cell.value;
		if (!v || typeof v !== "object") return;
		if ("sharedFormula" in v || v.shareType) cell.value = { formula: cell.formula };
	})));

	const S = (name) => wb.getWorksheet(name);
	const set = (ws, addr, value) => { ws.getCell(addr).value = value === undefined ? null : value; };
	const peso = (ws, addr) => { ws.getCell(addr).numFmt = '"₱"#,##0.00'; };
	const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;
	const f = (formula) => ({ formula });

	// Generic table filler: rows[] go into first..last, unused rows are cleared.
	function fillTable(ws, first, last, rows, write, clearCols, itemCol = "C", descCol = "D") {
		for (let r = first; r <= last; r++) {
			const row = rows[r - first];
			const excelRow = ws.getRow(r);
			if (row) {
				excelRow.hidden = false;
				set(ws, `${itemCol}${r}`, f(`SUBTOTAL(103,$${descCol}$${first}:${descCol}${r})`));
				write(r, row);
			} else {
				excelRow.hidden = true;
				[itemCol, ...clearCols].forEach((c) => set(ws, `${c}${r}`, null));
			}
		}
	}

	// --- CE SUMMARY ---
	const cs = S("CE SUMMARY");
	const p = model.project || {};
	set(cs, "N2", model.docNo); set(cs, "N3", model.revNo); set(cs, "N4", model.revDate);
	// The template's tick boxes are form controls ExcelJS cannot keep; a box glyph stands in.
	set(cs, "F5", p.electrical ? "☑" : "☐"); set(cs, "I5", p.mechanical ? "☑" : "☐");
	["F5", "I5"].forEach((a) => { cs.getCell(a).alignment = { horizontal: "right", vertical: "middle" }; });
	set(cs, "B7", p.description); set(cs, "M6", p.date); set(cs, "L8", model.ceNumber);
	set(cs, "D9", p.client); set(cs, "D10", p.location); set(cs, "D11", p.attention); set(cs, "D12", p.endUser);
	set(cs, "L10", p.material); set(cs, "L11", num(p.quantity) || p.quantity); set(cs, "L12", num(p.days) || p.days);
	// Mobilization and demobilization stay the MOB & DEMOB sheet totals (L15 and L16).
	const insurance = model.misc.filter((m) => m.block === "INS").reduce((s, m) => s + m.amount, 0);
	set(cs, "L34", insurance);
	set(cs, "L24", roundMoney(model.benefits));
	peso(cs, "L24");
	cs.getCell("L34").note = "Insurances (system MISC section I). The template's MISC. sheet has no insurance block.";
	[41, 42, 43, 44].forEach((r, i) => set(cs, `B${r}`, model.notes[i] ? `${i + 1}. ${model.notes[i]}` : null));
	const sg = model.signatures || {};
	set(cs, "B50", sg.preparedBy || null); set(cs, "F50", sg.checkedBy || null); set(cs, "I50", sg.notedBy || null); set(cs, "M50", sg.approvedBy || null);
	set(cs, "B51", sg.preparedTitle || "Cost Estimator"); set(cs, "F51", sg.checkedTitle || null); set(cs, "I51", sg.notedTitle || null); set(cs, "M51", sg.approvedTitle || null);
	set(cs, "B56", sg.reviewedBy || null); set(cs, "F56", sg.checkedBy2 || null); set(cs, "I56", sg.concurredBy || null);
	set(cs, "B57", sg.reviewedBy ? sg.reviewedTitle || null : null); set(cs, "F57", sg.checkedBy2 ? sg.checkedTitle2 || null : null); set(cs, "I57", sg.concurredBy ? sg.concurredTitle || null : null);
	["B50", "F50", "I50", "M50", "B56", "F56", "I56"].forEach((a) => { cs.getCell(a).alignment = { ...(cs.getCell(a).alignment || {}), horizontal: "center", vertical: "bottom", shrinkToFit: true, wrapText: false }; });

	// --- SOW Breakdown (one row group per task; literal UOMs) ---
	const sb = S("SOW Breakdown");
	set(sb, "P1", model.docNo); set(sb, "P2", model.revNo); set(sb, "P3", model.revDate);
	const sbRows = [];
	model.tasks.forEach((t) => {
		const n = Math.max(1, t.manpower.length, t.tools.length, t.consumables.length, t.ppe.length, t.misc.length);
		for (let i = 0; i < n; i++) sbRows.push({ scope: i === 0 ? `${t.title} (${t.workType === "shop" ? "Shop" : "Onsite"})` : null, mp: t.manpower[i], tl: t.tools[i], cm: t.consumables[i], pp: t.ppe[i], ms: t.misc[i] });
	});
	for (let r = 7; r <= 40; r++) {
		const row = sbRows[r - 7] || {};
		set(sb, `B${r}`, row.scope || null);
		[["C", "D", "E", row.mp], ["F", "G", "H", row.tl], ["I", "J", "K", row.cm], ["L", "M", "N", row.pp], ["O", "P", "Q", row.ms]].forEach(([d, q, u, it]) => {
			set(sb, `${d}${r}`, it ? it.d : null); set(sb, `${q}${r}`, it ? it.q : null); set(sb, `${u}${r}`, it ? it.u.toUpperCase() : null);
		});
	}

	// --- SCOPE (SOW text, one line per row) ---
	const sc = S("SCOPE");
	const sowLines = sowHtmlToLines(model.sowHtml);
	for (let r = 8; r <= 52; r++) set(sc, `B${r}`, sowLines[r - 8] ?? null);

	// --- MOB & DEMOB ---
	const md = S("MOB & DEMOB");
	const manCols = ["D", "E", "F", "G", "H", "J"];
	const fillMob = (part, aFirst, aLast, foodFirst, foodLast, trFirst, trLast) => {
		fillTable(md, aFirst, aLast, part.manpower, (r, it) => {
			set(md, `D${r}`, it.designation); set(md, `E${r}`, it.qty); set(md, `F${r}`, it.uom.toUpperCase()); set(md, `G${r}`, it.days); set(md, `H${r}`, it.rate);
			set(md, `J${r}`, 0); // system Mob/Demob sheets do not cost overtime
			set(md, `K${r}`, f(`H${r}/8*${CE_OT_FACTOR}`));
		}, manCols);
		const blockFill = (first, last, rows) => fillTable(md, first, last, rows, (r, it) => {
			set(md, `D${r}`, it.description); set(md, `E${r}`, it.qty); set(md, `F${r}`, it.uom.toUpperCase()); set(md, `G${r}`, it.days); set(md, `H${r}`, it.price);
			set(md, `I${r}`, f(`H${r}*E${r}*G${r}`));
		}, ["D", "E", "F", "G", "H"]);
		blockFill(foodFirst, foodLast, part.allowance);
		blockFill(trFirst, trLast, part.lines);
	};
	fillMob(model.mob, 10, 23, 29, 31, 33, 47);
	fillMob(model.demob, 58, 71, 77, 79, 81, 95);
	set(md, "N2", f("'CE SUMMARY'!N2"));

	// --- BOL: C.1..C.6 by day type / shift, C.7 benefits ---
	const bl = S("BOL");
	const BOL_TABLES = [
		{ key: "Regular|Day", first: 13, last: 27 }, { key: "Regular|Night", first: 32, last: 46 },
		{ key: "Sunday|Day", first: 54, last: 68 }, { key: "Sunday|Night", first: 73, last: 87 },
		{ key: "Holiday|Day", first: 95, last: 109 }, { key: "Holiday|Night", first: 114, last: 128 },
	];
	const dayKey = (it) => `${/sun|special|non/i.test(it.dayType) ? "Sunday" : /holiday|legal/i.test(it.dayType) ? "Holiday" : "Regular"}|${/night/i.test(it.shift) ? "Night" : "Day"}`;
	BOL_TABLES.forEach((t) => {
		const rows = model.bol.filter((it) => dayKey(it) === t.key);
		const factor = t.key.startsWith("Regular") ? CE_OT_FACTOR : 1.3;
		fillTable(bl, t.first, t.last, rows, (r, it) => {
			set(bl, `D${r}`, it.designation); set(bl, `E${r}`, it.qty); set(bl, `F${r}`, it.uom.toLowerCase()); set(bl, `G${r}`, it.days);
			set(bl, `H${r}`, it.rate); set(bl, `J${r}`, it.otHrs); set(bl, `K${r}`, roundMoney(it.otRate ?? (it.rate / 8) * factor));
			peso(bl, `H${r}`); peso(bl, `K${r}`);
			set(bl, `M${r}`, roundMoney(it.amount)); peso(bl, `M${r}`);
		}, ["D", "E", "G", "H", "J"]);
	});
	for (let r = 136; r <= 150; r++) { ["C", "D", "E", "G", "H", "M"].forEach((c) => set(bl, `${c}${r}`, null)); }
	set(bl, "M153", f("SUM(M28,M47,M69,M88,M110,M129,N151)"));

	// --- BOTE / BOCM / PPE ---
	const bt = S("BOTE");
	fillTable(bt, 11, 40, model.bote, (r, it) => {
		set(bt, `D${r}`, it.description); set(bt, `H${r}`, it.qty); set(bt, `I${r}`, it.uom.toUpperCase()); set(bt, `J${r}`, it.days); set(bt, `K${r}`, it.price);
		peso(bt, `K${r}`);
		set(bt, `L${r}`, roundMoney(it.amount)); peso(bt, `L${r}`);
	}, ["D", "H", "I", "J", "K"]);
	set(bt, "K42", null); set(bt, "J42", null);
	[["BOCM", model.bocm], ["PPE", model.ppe]].forEach(([name, rows]) => {
		const ws = S(name);
		fillTable(ws, 11, 42, rows, (r, it) => {
			set(ws, `D${r}`, it.description); set(ws, `I${r}`, it.qty); set(ws, `J${r}`, it.uom.toUpperCase()); set(ws, `K${r}`, it.price);
			peso(ws, `K${r}`);
			set(ws, `L${r}`, roundMoney(it.amount)); peso(ws, `L${r}`);
		}, ["D", "I", "J", "K"]);
	});

	// --- MISC. ---
	const mi = S("MISC.");
	[{ b: "A", first: 10, last: 18 }, { b: "B", first: 23, last: 29 }, { b: "C", first: 34, last: 37 }, { b: "D", first: 42, last: 53 }, { b: "E", first: 58, last: 63 }].forEach((blk) => {
		fillTable(mi, blk.first, blk.last, model.misc.filter((m) => m.block === blk.b), (r, it) => {
			set(mi, `D${r}`, it.description); set(mi, `H${r}`, it.qty); set(mi, `I${r}`, it.uom.toUpperCase()); set(mi, `J${r}`, it.days); set(mi, `K${r}`, it.price);
			peso(mi, `K${r}`);
			set(mi, `L${r}`, roundMoney(it.amount)); peso(mi, `L${r}`);
		}, ["D", "H", "I", "J", "K"]);
	});
	set(mi, "L66", f("SUM(L19,L30,L38,L54,L64)"));

	// Ken's terminology (items 9 / 14): "Unit Cost" -> "Unit Price", "Item" -> "Item No.".
	wb.worksheets.forEach((ws) => ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
		if (cell.isMerged && cell.master && cell.master.address !== cell.address) return;
		const v = typeof cell.value === "string" ? cell.value.trim() : null;
		if (v === "UNIT COST") cell.value = "UNIT PRICE";
		else if (v === "ITEM") cell.value = "ITEM NO.";
	})));

	// Any formula still pointing at a removed lookup sheet is cleared.
	wb.worksheets.forEach((ws) => ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
		const v = cell.value;
		if (v && typeof v === "object" && "formula" in v && FORMULA_DEAD.test(v.formula)) cell.value = null;
	})));

	wb.worksheets.forEach((ws) => {
		for (let c = 1; c <= 16; c++) {
			const col = ws.getColumn(c);
			const min = c >= 12 ? 18 : 14;
			if (!col.width || col.width < min) col.width = min;
		}
	});
	["L15", "L16", "L17", "L25", "L26", "L27", "L34", "L36", "L38"].forEach((addr) => peso(cs, addr));

	// Cached results so viewers that do not recalculate (previews, phones) show numbers.
	const ev = makeEvaluator(wb);
	const unresolved = [];
	wb.worksheets.forEach((ws) => ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
		const v = cell.value;
		if (!v || typeof v !== "object" || !("formula" in v)) return;
		if (cell.isMerged && cell.master && cell.master.address !== cell.address) return;
		const resultRaw = ev.value(ws.name, cell.address);
		const result = typeof resultRaw === "number" ? roundMoney(resultRaw) : resultRaw;
		if (result === undefined) unresolved.push(`${ws.name}!${cell.address}`);
		else cell.value = { formula: v.formula, result };
	})));
	wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true };
	const money = (n) => (typeof n === "number" ? roundMoney(n) : n);
	const totals = {
		summary: money(ev.value("CE SUMMARY", "L36")), bol: money(ev.value("BOL", "M153")), bote: money(ev.value("BOTE", "L43")), bocm: money(ev.value("BOCM", "L43")),
		ppe: money(ev.value("PPE", "L43")), misc: money(ev.value("MISC.", "L66")), mob: money(ev.value("MOB & DEMOB", "L50")), demob: money(ev.value("MOB & DEMOB", "L98")),
	};
	const pin = (ws, addr, result) => {
		const cell = ws.getCell(addr);
		const v = cell.value;
		const formula = v && typeof v === "object" && v.formula ? v.formula : null;
		const n = roundMoney(result);
		cell.value = formula ? { formula, result: n } : n;
		peso(ws, addr);
	};
	pin(cs, "L15", totals.mob);
	pin(cs, "L16", totals.demob);
	pin(cs, "L17", totals.bol);
	pin(cs, "L24", model.benefits);
	pin(cs, "L25", totals.bote);
	pin(cs, "L26", totals.bocm);
	pin(cs, "L27", totals.ppe);
	pin(cs, "L36", totals.summary);
	pin(S("BOL"), "M153", totals.bol);
	pin(S("BOTE"), "L43", totals.bote);
	pin(S("BOCM"), "L43", totals.bocm);
	pin(S("PPE"), "L43", totals.ppe);
	pin(S("MISC."), "L66", totals.misc);
	pin(S("MOB & DEMOB"), "L50", totals.mob);
	pin(S("MOB & DEMOB"), "L98", totals.demob);
	const buffer = await wb.xlsx.writeBuffer();
	return { buffer, unresolved, totals, pageTotals: { BOL: totals.bol, BOTE: totals.bote, BOCM: totals.bocm, PPE: totals.ppe, MISC: totals.misc, MOB: totals.mob, DEMOB: totals.demob }, total: totals.summary };
}
