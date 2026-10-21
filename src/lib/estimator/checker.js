// @ts-nocheck
/**
 * Pre-submit checker. Flag checkerV2 off keeps today's dialog.
 * Every existing preflight message is still produced. Nested subtasks are walked.
 * Errors block submit and final approval. Warnings need an acknowledgement and a reason.
 * Info is listed only.
 */

import {
	boteElectricityCost,
	directInputWarnings,
	flattenSubs,
	itemSubtotal,
	projectTotal,
	screenOfficialTotal
} from "./ceTotals.js";
import { roundMoney } from "./money.js";
import { phase8Findings } from "./phase8.js";
import { phase10Findings } from "./phase10.js";

export const CHECKER_RULES = [
	{ id: "zero-missing", label: "Zero and empty amounts", severity: "error" },
	{ id: "unpriced", label: "Unpriced lines", severity: "error" },
	{ id: "shop-power", label: "Shop or trading tool missing kW", severity: "error" },
	{ id: "adhoc", label: "Line not from the database", severity: "warning" },
	{ id: "override", label: "Rate override", severity: "warning" },
	{ id: "stale", label: "Stale rate", severity: "warning" },
	{ id: "special-rate", label: "Special rate", severity: "warning" },
	{ id: "priced", label: "No priced line", severity: "error" },
	{ id: "no-quote", label: "No-quote reason", severity: "error" },
	{ id: "rce", label: "Linked RCE", severity: "warning" },
	{ id: "extra-note", label: "Manual extra without a note", severity: "warning" },
	{ id: "sow", label: "Scope mentions a removed title", severity: "warning" },
	{ id: "drawing", label: "Promised drawing", severity: "warning" },
	{ id: "double-power", label: "Electricity counted twice", severity: "warning" },
	{ id: "entry-gaps", label: "Missing quantity, days, or rate", severity: "warning" },
	{ id: "unit", label: "Unit sanity", severity: "warning" },
	{ id: "onsite-per-diem", label: "Per diem on onsite days", severity: "warning" },
	{ id: "range", label: "Out of range", severity: "warning" },
	{ id: "direct-mismatch", label: "Direct summary does not match the breakdown", severity: "error" },
	{ id: "step6", label: "Blank work type, onsite power, per diem, MISC days, non-numeric", severity: "warning" },
	{ id: "spelling", label: "Spelling", severity: "warning" },
	{ id: "duplicate", label: "Same item and specs", severity: "error" },
	{ id: "activity", label: "Same activity and day type", severity: "warning" },
	{ id: "near-name", label: "Name close to a database item", severity: "warning" },
	{ id: "quote-over-db", label: "Quote price while a database price exists", severity: "error" },
	{ id: "quote-missing", label: "Quotation reference missing from the library", severity: "warning" },
	{ id: "availability", label: "Availability key", severity: "info" },
	{ id: "client-location", label: "Client location", severity: "info" },
	{ id: "pending-open", label: "Pending record still open", severity: "warning" },
	{ id: "sow-untagged", label: "Scope heading has no activity", severity: "warning" },
	{ id: "sow-unknown", label: "Scope heading activity is not a task", severity: "warning" },
	{ id: "sow-uncovered", label: "Task is not covered by a heading", severity: "warning" }
];

const CATS = ["BOL", "BOTE", "BOCM", "PPE", "MISC"];
const STALE_RATE_MONTHS = 12;
const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const TRADE_WORDS = ["bol", "bote", "bocm", "ppe", "misc", "rce", "oif", "sow", "kwh", "qty", "uom"];
const BASE_UNITS = ["pc", "pcs", "piece", "set", "lot", "kg", "g", "m", "mm", "cm", "l", "ltr", "liter", "hr", "day", "trip", "unit", "ea", "box", "roll", "pair", "bag", "length", "sht", "sheet"];
const FIELDS = {
	BOL: [
		{ key: "qty", label: "Qty" },
		{ key: "days", label: "Days" },
		{ key: "rate", label: "Rate/Day" },
		{ key: "perDiem", label: "Per Diem" },
		{ key: "allowance", label: "Allowance" }
	],
	BOTE: [
		{ key: "qty", label: "Qty" },
		{ key: "days", label: "Days" },
		{ key: "rate", label: "Rate/Day" }
	],
	BOCM: [
		{ key: "qty", label: "Qty" },
		{ key: "unitCost", label: "Unit Cost" }
	],
	PPE: [
		{ key: "qty", label: "Qty" },
		{ key: "unitCost", label: "Unit Cost" }
	],
	MISC: [
		{ key: "qty", label: "Qty" },
		{ key: "unitCost", label: "Unit Cost" }
	]
};
const GAP_KEYS = {
	BOL: [["qty", "Qty"], ["days", "Days"], ["rate", "Rate"]],
	BOTE: [["qty", "Qty"], ["days", "Days"], ["rate", "Rate"]],
	BOCM: [["qty", "Qty"], ["unitCost", "Unit cost"]],
	PPE: [["qty", "Qty"], ["unitCost", "Unit cost"]]
};

function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function moneyKind(value) {
	if (value === "" || value == null) return "empty";
	const n = Number(value);
	if (!Number.isFinite(n)) return "empty";
	if (n === 0) return "zero";
	return null;
}

export function defaultCheckerConfig() {
	return {
		ranges: { qty: 1000, days: 366, rate: 100000, unitCost: 10000000, perDiem: 5000, otHrs: 24, powerKw: 500 },
		words: [],
		units: [],
		rules: {}
	};
}

export function normalizeCheckerConfig(raw) {
	const base = defaultCheckerConfig();
	const src = raw && typeof raw === "object" ? raw : {};
	const ranges = { ...base.ranges };
	Object.keys(base.ranges).forEach((key) => {
		const n = Number(src.ranges?.[key]);
		if (Number.isFinite(n) && n > 0) ranges[key] = n;
	});
	const rules = {};
	const ruleSrc = src.rules && typeof src.rules === "object" ? src.rules : {};
	Object.keys(ruleSrc).forEach((id) => {
		const row = ruleSrc[id] || {};
		const next = { enabled: row.enabled !== false };
		if (row.severity === "error" || row.severity === "warning" || row.severity === "info") next.severity = row.severity;
		rules[id] = next;
	});
	return {
		ranges,
		words: Array.isArray(src.words) ? src.words.map((word) => String(word || "").trim()).filter(Boolean) : [],
		units: Array.isArray(src.units) ? src.units.map((unit) => String(unit || "").trim()).filter(Boolean) : [],
		rules
	};
}

function lineName(category, item) {
	if (!item) return "";
	if (category === "BOL") return String(item.role || "").trim();
	if (category === "PPE") return String(item.item || "").trim();
	return String(item.description || item.item || item.name || "").trim();
}

function nameField(category) {
	if (category === "BOL") return "role";
	if (category === "PPE") return "item";
	return "description";
}

function moneyField(category) {
	return category === "BOL" || category === "BOTE" ? "rate" : "unitCost";
}

function workType(task) {
	const value = String(task?.workType || "").toLowerCase();
	if (value === "shop" || value === "shopwork" || value === "shop work") return "shop";
	if (value === "trading") return "trading";
	return "onsite";
}

function monthsSince(dateStr) {
	if (!dateStr) return null;
	const t = Date.parse(dateStr);
	if (!Number.isFinite(t)) return null;
	return (Date.now() - t) / 2630016e3;
}

function exceptionMatches(ex, category, item) {
	if (!ex || ex.category !== category || !item) return false;
	const id = String(ex.masterlistId || "").trim();
	const lineId = String(item.masterlistId || "").trim();
	if (id && lineId) return id === lineId;
	const label = String(ex.label || "").trim().toLowerCase();
	return !!label && label === lineName(category, item).toLowerCase();
}

function distance(a, b) {
	if (Math.abs(a.length - b.length) > 2) return 9;
	const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
	for (let j = 0; j <= b.length; j++) rows[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
		}
	}
	return rows[a.length][b.length];
}

function specKey(category, item) {
	const unit = String(item.unit || "").trim().toLowerCase();
	const money = num(item[moneyField(category)]);
	const day = category === "BOL" ? String(item.dayType || "").toLowerCase() : "";
	const shift = category === "BOL" ? String(item.shift || "").toLowerCase() : "";
	return `${lineName(category, item).toLowerCase()}|${unit}|${money}|${day}|${shift}`;
}

function knownWords(list) {
	const set = new Set(TRADE_WORDS);
	(list || []).forEach((word) => {
		String(word || "").split(/[^A-Za-z']+/).forEach((part) => {
			if (part) set.add(part.toLowerCase());
		});
	});
	return set;
}

export function canSubmit(report, ack) {
	if (!report) return { ok: true };
	if ((report.errors || []).length) return { ok: false, reason: "Errors block submit." };
	if ((report.warnings || []).length) {
		if (!ack?.checked) return { ok: false, reason: "Warnings need acknowledgement." };
		if (!String(ack.reason || "").trim()) return { ok: false, reason: "Warnings need a reason." };
	}
	return { ok: true };
}

export function blocksFinalApproval(report) {
	return !!report && (report.errors || []).length > 0;
}

export function versionWithReport(snapshot, report, ack) {
	return {
		...snapshot,
		checker: {
			at: snapshot?.timestamp || "",
			errors: (report?.errors || []).length,
			warnings: (report?.warnings || []).length,
			info: (report?.info || []).length,
			ackReason: String(ack?.reason || "").trim(),
			findings: report?.findings || []
		}
	};
}

export function runChecker(input) {
	const opts = input || {};
	const tasks = opts.tasks || [];
	const config = normalizeCheckerConfig(opts.checker);
	const findings = [];
	const allow = knownWords([...(config.words || []), ...(opts.dictionary || [])]);
	const units = new Set([...BASE_UNITS, ...config.units.map((unit) => unit.toLowerCase())]);
	const db = opts.db || {};
	function emit(rule, severity, message, extra) {
		const row = config.rules?.[rule];
		if (row && row.enabled === false) return;
		findings.push({
			rule,
			severity: row?.severity || severity,
			message,
			...(extra || {})
		});
	}
	let priced = 0;
	let extraWithoutNote = 0;
	let boteElectricity = 0;
	let miscHasElectric = false;
	const spellSeen = new Set();
	const spell = opts.spell || null;
	function considerSpell(text) {
		if (!spell) return;
		const words = String(text || "").replace(/<[^>]+>/g, " ").match(/[A-Za-z][A-Za-z']+/g) || [];
		words.forEach((word) => {
			const key = word.toLowerCase();
			if (key.length < 3 || allow.has(key) || spellSeen.has(key)) return;
			spellSeen.add(key);
			if (spell.correct(word) || spell.correct(key)) return;
			emit("spelling", "warning", `Spelling: “${word}”.`, {
				action: "spell",
				word,
				suggestions: (spell.suggest(word) || []).slice(0, 5)
			});
		});
	}
	(tasks || []).forEach((task) => {
		const taskTitle = task?.title || "Task";
		const wt = workType(task);
		considerSpell(taskTitle);
		flattenSubs(task).forEach((sub) => {
			const subTitle = sub?.title || "Subtask";
			considerSpell(subTitle);
			const groups = {};
			const activities = {};
			CATS.forEach((cat) => {
				(sub.items?.[cat] || []).forEach((item, index) => {
					if (!item) return;
					const name = lineName(cat, item);
					const fields = FIELDS[cat];
					const hasMoney = fields.some((field) => {
						const value = item[field.key];
						return value !== "" && value != null && Number(value) !== 0;
					});
					if (!name && !hasMoney) return;
					const label = name || `Row ${index + 1}`;
					considerSpell(name);
					fields.forEach((field) => {
						const kind = moneyKind(item[field.key]);
						if (!kind) return;
						const text = `${kind === "zero" ? "Zero" : "Empty"} ${field.key} — ${label} / ${field.label}`;
						const provisional = opts.provisionalIds?.[item.id] || item.needsQuote || item.provisional;
						if ((field.key === "rate" || field.key === "unitCost") && kind === "zero") {
							if (opts.noQuote || opts.status === "No quote" || provisional) {
								emit("zero-missing", "warning", `${text} (provisional / sourcing)`, { tab: cat, itemId: String(item.id || "") });
							} else emit("zero-missing", "error", text, { tab: cat, itemId: String(item.id || "") });
						} else emit("zero-missing", "warning", text, { tab: cat, itemId: String(item.id || "") });
					});
					if (name && num(item[moneyField(cat)]) <= 0 && !item.needsQuote && !item.provisional && !opts.provisionalIds?.[item.id]) {
						emit("unpriced", "error", `Unpriced line “${name}”.`, { tab: cat, taskId: task.id, subtaskId: sub.id, category: cat, itemId: item.id });
					}
					if (itemSubtotal(cat, item, wt, opts.pricing) > 0) priced += 1;
					if (cat === "BOTE" && (wt === "shop" || wt === "trading") && name && num(item.days) > 0 && !num(item.powerKw) && !item.needsQuote) {
						emit("shop-power", "error", `Shop/Trading tool “${item.description}” has no kW — electricity would be understated.`, { tab: "BOTE", itemId: item.id });
					}
					if (name && !item.masterlistId && (num(item.rate) > 0 || num(item.unitCost) > 0) && !item.needsQuote) {
						emit("adhoc", "warning", `Ad-hoc line “${name}” is not from the database — mark Needs source or confirm the rate.`, { tab: cat });
					}
					const ex = (opts.rateExceptions || []).find((row) => exceptionMatches(row, cat, item));
					const special = ex && num(ex.rate) > 0 && num(item[moneyField(cat)]) === num(ex.rate);
					if (item.rateOverridden && !special) emit("override", "warning", `Override on “${name}” — master rate was changed.`, { tab: cat });
					const age = monthsSince(item.lastReviewed);
					if (age != null && age > STALE_RATE_MONTHS) emit("stale", "warning", `Rate for “${name}” last reviewed ${Math.round(age)} months ago.`, { tab: cat });
					if (item.manualExtra && !String(item.notes || "").trim()) extraWithoutNote += 1;
					if (cat === "BOTE") boteElectricity += boteElectricityCost(item);
					if (cat === "MISC" && /electr/i.test(String(item.description || item.item || ""))) miscHasElectric = true;
					if (wt === "onsite" && cat === "BOL" && num(item.days) > 0 && !(num(item.perDiem) > 0)) {
						emit("onsite-per-diem", "warning", `Onsite “${name}” has days and no per diem.`, { tab: "BOL", itemId: item.id });
					}
					const ranges = config.ranges;
					const checks = [
						["qty", ranges.qty],
						["days", ranges.days],
						["rate", ranges.rate],
						["unitCost", ranges.unitCost],
						["perDiem", ranges.perDiem],
						["otHrs", ranges.otHrs],
						["powerKw", ranges.powerKw]
					];
					checks.forEach(([key, max]) => {
						if (!(key in item)) return;
						if (item[key] === "" || item[key] == null) return;
						const n = Number(item[key]);
						if (!Number.isFinite(n) || n === 0) return;
						if (n < 0 || n > max) emit("range", "warning", `${key} ${n} on “${name || label}” is outside 0–${max}.`, { tab: cat, itemId: item.id });
					});
					if ((cat === "BOCM" || cat === "PPE") && name) {
						const unit = String(item.unit || "").trim();
						if (!unit) emit("unit", "warning", `Unit is missing on “${name}”.`, { tab: cat, itemId: item.id });
						else if (!units.has(unit.toLowerCase())) emit("unit", "warning", `Unit “${unit}” on “${name}” is not a known unit.`, { tab: cat, itemId: item.id });
					}
					if (GAP_KEYS[cat] && name) {
						const miss = GAP_KEYS[cat].filter(([key]) => {
							const value = item[key];
							if (value === "" || value == null) return true;
							return !!item.entryGap && !(Number(value) > 0);
						});
						if (miss.length) {
							emit("entry-gaps", "warning", `${taskTitle} / ${subTitle} / ${cat} / ${name} — missing ${miss.map(([, gapLabel]) => gapLabel).join(", ")}`, { tab: cat, itemId: item.id });
						}
					}
					if (!name) return;
					const key = specKey(cat, item);
					groups[cat] = groups[cat] || {};
					groups[cat][key] = groups[cat][key] || [];
					groups[cat][key].push(item);
					if (cat === "BOL") {
						const activity = `${name.toLowerCase()}|${String(item.dayType || "").toLowerCase()}`;
						activities[activity] = activities[activity] || [];
						activities[activity].push(item);
					}
					const names = db[cat] || [];
					const exact = names.find((row) => String(row.label || "").trim().toLowerCase() === name.toLowerCase());
					if (!exact && name.length >= 4) {
						let best = null;
						let bestDistance = 9;
						names.forEach((row) => {
							const label = String(row.label || "").trim();
							const gap = distance(name.toLowerCase(), label.toLowerCase());
							if (gap > 0 && gap < bestDistance) {
								best = row;
								bestDistance = gap;
							}
						});
						if (best && bestDistance <= 2) {
							emit("near-name", "warning", `“${name}” is close to database item “${best.label}”.`, {
								tab: cat,
								action: "use-db",
								taskId: task.id,
								subtaskId: sub.id,
								category: cat,
								itemId: item.id,
								dbId: best.id,
								dbLabel: best.label,
								nameField: nameField(cat)
							});
						}
					}
				});
			});
			Object.entries(groups).forEach(([cat, byKey]) => {
				Object.values(byKey).forEach((rows) => {
					if (rows.length < 2) return;
					const keep = rows[0];
					rows.slice(1).forEach((drop) => {
						emit("duplicate", "error", `Duplicate “${lineName(cat, keep)}” with the same specs in this subtask.`, {
							tab: cat,
							action: "merge",
							taskId: task.id,
							subtaskId: sub.id,
							category: cat,
							keepId: keep.id,
							dropId: drop.id,
							nextQty: num(keep.qty) + num(drop.qty)
						});
					});
				});
			});
			Object.values(activities).forEach((rows) => {
				if (rows.length < 2) return;
				const keys = new Set(rows.map((item) => specKey("BOL", item)));
				if (keys.size < 2) return;
				emit("activity", "warning", `“${lineName("BOL", rows[0])}” is repeated for the same day type.`, { tab: "BOL" });
			});
		});
	});
	(opts.rateExceptions || []).forEach((ex) => {
		let count = 0;
		(tasks || []).forEach((task) => flattenSubs(task).forEach((sub) => {
			(sub.items?.[ex.category] || []).forEach((item) => {
				if (lineName(ex.category, item) && exceptionMatches(ex, ex.category, item)) count += 1;
			});
		}));
		if (!count || !(num(ex.rate) > 0)) return;
		emit("special-rate", "warning", `Special rate on “${ex.label}” — ${PHP.format(num(ex.rate))} on ${count} ${count === 1 ? "line" : "lines"} in this cost estimate only.`, { tab: ex.category });
	});
	if (!priced && !opts.noQuote && opts.status !== "No quote") emit("priced", "error", "No priced line in the breakdown.", { tab: "BREAKDOWN" });
	if ((opts.noQuote || opts.status === "No quote") && !String(opts.noQuoteReason || opts.statusNote || "").trim()) {
		emit("no-quote", "error", "No-quote requires a reason.", { tab: "SUMMARY" });
	}
	if (!opts.rceId) emit("rce", "warning", "No linked RCE — SOW and attachments were not stamped from a request.", { tab: "RCE" });
	else if (opts.rceAccepted === false) emit("rce", "error", "Linked RCE is not accepted by the Final approver.", { tab: "RCE" });
	if (extraWithoutNote) emit("extra-note", "warning", `${extraWithoutNote} manual extra(s) have no note — confirm each.`, { tab: "MISC" });
	const sow = String(opts.sowText || "").replace(/<[^>]+>/g, " ").toLowerCase();
	considerSpell(opts.sowText);
	(opts.deletedTitles || []).forEach((title) => {
		const text = String(title || "").trim();
		if (text && sow.includes(text.toLowerCase())) emit("sow", "warning", `SOW mentions “${text}”, not in the breakdown.`, { tab: "SOW" });
	});
	if (opts.drawingPromised && !opts.hasDrawingFile) emit("drawing", "warning", "RCE checklist promised a drawing and ATTCH has none.", { tab: "ATTCH" });
	if (miscHasElectric && boteElectricity > 0) emit("double-power", "warning", "Shop/Trading BOTE already has electricity and MISC also mentions power — check double count.", { tab: "MISC" });
	directInputWarnings(tasks).forEach((row) => {
		const task = (tasks || []).find((item) => String(item?.id || "") === row.taskId);
		const title = task?.title || "Task";
		let itemName = "";
		if (task && row.itemId) {
			flattenSubs(task).forEach((sub) => CATS.forEach((cat) => {
				(sub.items?.[cat] || []).forEach((item) => {
					if (String(item?.id || "") === row.itemId) itemName = lineName(cat, item) || itemName;
				});
			}));
		}
		const who = itemName ? `“${itemName}”` : `“${title}”`;
		if (row.code === "blank-work-type") emit("step6", "warning", `Work type is blank on “${title}”.`, { taskId: row.taskId });
		else if (row.code === "onsite-power") emit("step6", "warning", `Onsite tool ${who} has kW — power is not costed on site.`, { itemId: row.itemId });
		else if (row.code === "missing-per-diem") emit("step6", "warning", `Per diem rate is missing on ${who}.`, { itemId: row.itemId });
		else if (row.code === "misc-blank-days") emit("step6", "warning", `MISC ${who} has blank days.`, { itemId: row.itemId });
		else if (row.code === "non-numeric") emit("step6", "warning", `MISC ${who} ${row.field} is not a number.`, { itemId: row.itemId, field: row.field });
	});
	if (opts.pricing?.model === "direct-v1") {
		const breakdown = projectTotal(tasks, opts.pricing);
		const summary = opts.summaryTotal != null ? Number(opts.summaryTotal) : screenOfficialTotal(tasks, opts.pricing, opts.summaryOverrides);
		if (roundMoney(summary) !== roundMoney(breakdown)) {
			emit("direct-mismatch", "error", `Direct summary ${summary} does not match the breakdown ${breakdown}.`, { tab: "SUMMARY" });
		}
	}
	phase8Findings(opts).forEach((row) => emit(row.id, row.severity, row.message, row.extra));
	phase10Findings(opts).forEach((row) => emit(row.id, row.severity, row.message, row.extra));
	return {
		findings,
		errors: findings.filter((row) => row.severity === "error"),
		warnings: findings.filter((row) => row.severity === "warning"),
		info: findings.filter((row) => row.severity === "info")
	};
}
