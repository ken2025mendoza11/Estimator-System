// @ts-nocheck
/**
 * SOW headings and a project schedule. Flags sowTagging and schedule stay off
 * unless each one is exactly true. Day numbers are taken as already computed.
 * The chart does not insert a gap between a finish and the next start.
 */

import { ceIsUnlocked } from "./phase8.js";
import { addWorkingDays, cleanHolidayDate, isWorkingDay } from "./phCalendar.js";
import { phDate } from "./phTime.js";

function oneActivity(raw) {
	if (Array.isArray(raw?.activity_id)) return String(raw.activity_id[0] || "");
	if (Array.isArray(raw?.activity_ids)) return String(raw.activity_ids[0] || "");
	return String(raw?.activity_id || "");
}

export function normalizeSow(list) {
	const out = [];
	const seen = new Set();
	(Array.isArray(list) ? list : []).forEach((raw) => {
		const heading = String(raw?.heading || "").replace(/\s+/g, " ").trim();
		if (!heading) return;
		let id = String(raw?.id || `sow-${out.length + 1}`);
		if (seen.has(id)) id = `${id}-${out.length + 1}`;
		seen.add(id);
		out.push({ id, heading, activity_id: oneActivity(raw) });
	});
	return out;
}

/** Headings from the scope text. Nothing is stored until confirmSowSplit is confirmed. */
export function proposeSowSplit(sowText) {
	const text = String(sowText || "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&/g, "&");
	const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
	return lines.map((heading, index) => ({ id: `sow-${index + 1}`, heading, activity_id: "" }));
}

export function confirmSowSplit(sowText, confirmed) {
	if (confirmed !== true) return null;
	return normalizeSow(proposeSowSplit(sowText));
}

export function phase10Findings(opts) {
	const src = opts || {};
	if (src.features?.sowTagging !== true) return [];
	const sow = normalizeSow(src.sow);
	const tasks = Array.isArray(src.tasks) ? src.tasks : [];
	const ids = new Set(tasks.map((task) => String(task?.id || "")).filter(Boolean));
	const used = new Set();
	const out = [];
	sow.forEach((row) => {
		if (!row.activity_id) {
			out.push({ id: "sow-untagged", severity: "warning", message: `Heading “${row.heading}” has no activity.`, extra: { tab: "SOW" } });
			return;
		}
		if (!ids.has(row.activity_id)) {
			out.push({ id: "sow-unknown", severity: "warning", message: `Heading “${row.heading}” activity is not a task id.`, extra: { tab: "SOW" } });
			return;
		}
		used.add(row.activity_id);
	});
	tasks.forEach((task) => {
		const id = String(task?.id || "");
		if (!id || used.has(id)) return;
		out.push({
			id: "sow-uncovered",
			severity: "warning",
			message: `Task “${task.title || id}” is not covered by a heading.`,
			extra: { tab: "SOW", taskId: id }
		});
	});
	return out;
}

export function firstWorkingDay(iso, holidays) {
	const clean = cleanHolidayDate(iso);
	if (!clean) return "";
	if (isWorkingDay(clean, holidays)) return clean;
	return addWorkingDays(clean, 1, holidays);
}

export function barList(schedule) {
	if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return [];
	return Object.entries(schedule)
		.filter(([key, value]) => key !== "rows" && key !== "startDate" && key !== "locked" && value && typeof value === "object" && !Array.isArray(value) && value.taskId)
		.map(([, value]) => value)
		.sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0) || String(a.taskId).localeCompare(String(b.taskId)));
}

function assignDates(tasks, startDate, holidays) {
	const first = firstWorkingDay(startDate, holidays) || firstWorkingDay(phDate(), holidays);
	const bars = {};
	(tasks || []).forEach((task) => {
		const id = String(task?.id || "");
		if (!id) return;
		const start = Math.max(1, Math.round(Number(task.start) || 1));
		const end = Math.max(start, Math.round(Number(task.end) || start));
		bars[id] = {
			taskId: id,
			title: String(task.title || "Task"),
			predecessor: String(task.predecessor || ""),
			start,
			end,
			duration: end - start + 1,
			startOn: addWorkingDays(first, start - 1, holidays),
			endOn: addWorkingDays(first, end - 1, holidays)
		};
	});
	return { startDate: first, bars };
}

/**
 * Working bars are keyed by task id. A locked estimate keeps the baseline rows.
 * Finish-to-start day numbers are taken as given. This does not insert a lag.
 */
export function refreshSchedule({ previous, tasks, startDate, holidays, status } = {}) {
	const prev = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
	const unlocked = ceIsUnlocked(status);
	if (!unlocked && Array.isArray(prev.rows) && prev.rows.some((row) => row && row.baseline === true)) {
		return { ...prev, locked: true };
	}
	const dated = assignDates(tasks || [], startDate || prev.startDate || "", holidays || []);
	const next = { ...dated.bars, startDate: dated.startDate, locked: !unlocked };
	if (Array.isArray(prev.rows)) next.rows = prev.rows.map((row) => ({ ...row }));
	if (!unlocked) {
		next.rows = barList(next).map((bar) => ({
			taskId: bar.taskId,
			start: bar.start,
			end: bar.end,
			duration: bar.duration,
			startOn: bar.startOn,
			endOn: bar.endOn,
			predecessor: bar.predecessor || "",
			baseline: true
		}));
		next.locked = true;
	}
	return next;
}

export function ganttModel(schedule) {
	const bars = barList(schedule);
	const days = bars.reduce((max, bar) => Math.max(max, Number(bar.end) || 1), 1);
	return {
		days,
		bars: bars.map((bar, index) => ({
			taskId: bar.taskId,
			title: bar.title || bar.taskId,
			x: ((Number(bar.start) || 1) - 1) * 16,
			width: Math.max(1, (Number(bar.end) || 1) - (Number(bar.start) || 1) + 1) * 16,
			y: index * 24,
			startOn: bar.startOn || "",
			endOn: bar.endOn || ""
		}))
	};
}

export function scheduleExportSection(schedule) {
	const bars = barList(schedule);
	return {
		title: "Project schedule",
		exportTitle: "PROJECT SCHEDULE",
		columns: ["Task", "Start", "End", "Working days"],
		rows: bars.length ? bars.map((bar) => [bar.title || bar.taskId, bar.startOn || "", bar.endOn || "", String(bar.duration || "")]) : [["No tasks", "", "", ""]]
	};
}

/** Summary, scope, cost breakdown, project schedule, then annex pages. */
export function orderExportSections(sections) {
	const summary = [];
	const sow = [];
	const schedule = [];
	const annex = [];
	const cost = [];
	(sections || []).forEach((section) => {
		const title = String(section?.title || "");
		const exportTitle = String(section?.exportTitle || "");
		if (title === "CE Summary" || exportTitle === "COST ESTIMATE SUMMARY") summary.push(section);
		else if (section?.sowHtml != null || title === "Scope of Work") sow.push(section);
		else if (title === "Project schedule" || exportTitle === "PROJECT SCHEDULE") schedule.push(section);
		else if (section?.pdfData || section?.imageData || title === "ATTCH" || exportTitle === "ATTACHMENT") annex.push(section);
		else cost.push(section);
	});
	return [...summary, ...sow, ...cost, ...schedule, ...annex];
}
