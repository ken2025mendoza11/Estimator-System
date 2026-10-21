// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { remapCloneIds } from "./cloneIds.js";
import { runChecker } from "./checker.js";
import {
	barList,
	confirmSowSplit,
	ganttModel,
	normalizeSow,
	orderExportSections,
	phase10Findings,
	refreshSchedule
} from "./phase10.js";

test("a split waits for confirmation and each heading keeps one activity", () => {
	assert.equal(confirmSowSplit("<p>Weld</p><p>Paint</p>", false), null);
	const sow = confirmSowSplit("<p>Weld the frame</p><p>Paint</p>", true);
	assert.deepEqual(sow.map((row) => row.heading), ["Weld the frame", "Paint"]);
	assert.deepEqual(sow.map((row) => row.activity_id), ["", ""]);
	assert.equal(normalizeSow([{ heading: "Weld", activity_id: ["task-a", "task-b"] }])[0].activity_id, "task-a");
	assert.equal(confirmSowSplit("Keep", true)[0].heading, "Keep");
});

test("coverage uses task ids and stays quiet when the flag is off", () => {
	const tasks = [{ id: "task-a", title: "Shop" }, { id: "task-b", title: "Site" }];
	assert.deepEqual(phase10Findings({ features: {}, sow: [], tasks }), []);
	const on = phase10Findings({
		features: { sowTagging: true },
		sow: [{ id: "sow-1", heading: "Weld", activity_id: "" }, { id: "sow-2", heading: "Other", activity_id: "missing" }],
		tasks
	});
	assert.equal(on.some((row) => row.id === "sow-untagged" && /Weld/.test(row.message)), true);
	assert.equal(on.some((row) => row.id === "sow-unknown"), true);
	assert.equal(on.filter((row) => row.id === "sow-uncovered").length, 2);
	const covered = phase10Findings({
		features: { sowTagging: true },
		sow: [{ heading: "Shop work", activity_id: "task-a" }, { heading: "Site work", activity_id: "task-b" }],
		tasks
	});
	assert.deepEqual(covered, []);
	const report = runChecker({ tasks: [], features: { sowTagging: true }, sow: [{ heading: "Loose", activity_id: "" }] });
	assert.equal(report.findings.some((row) => row.rule === "sow-untagged"), true);
	const quiet = runChecker({ tasks: [], features: {}, sow: [{ heading: "Loose", activity_id: "" }] });
	assert.equal(quiet.findings.some((row) => row.rule === "sow-untagged"), false);
});

test("bars follow Philippine working days and a lock keeps the baseline", () => {
	const tasks = [
		{ id: "task-a", title: "Shop", predecessor: "", start: 1, end: 6, duration: 6 },
		{ id: "task-b", title: "Follows", predecessor: "task-a", start: 7, end: 7, duration: 1 }
	];
	const draft = refreshSchedule({ tasks, startDate: "2026-10-18", holidays: [], status: "Draft" });
	assert.equal(draft.startDate, "2026-10-19");
	assert.equal(draft["task-a"].startOn, "2026-10-19");
	assert.equal(draft["task-a"].endOn, "2026-10-24");
	assert.equal(draft["task-b"].startOn, "2026-10-26");
	assert.equal(draft["task-b"].start, 7);
	assert.equal(draft.locked, false);
	assert.equal(draft.rows, undefined);
	const held = refreshSchedule({ previous: draft, tasks, startDate: "2026-10-18", holidays: [], status: "For approval" });
	assert.equal(held.locked, true);
	assert.equal(held.rows[0].baseline, true);
	assert.equal(held.rows[0].endOn, "2026-10-24");
	const moved = refreshSchedule({
		previous: held,
		tasks: [{ id: "task-a", title: "Shop", predecessor: "", start: 1, end: 2, duration: 2 }],
		startDate: "2026-10-18",
		holidays: [],
		status: "Done"
	});
	assert.equal(moved["task-a"].endOn, "2026-10-24");
	const revised = refreshSchedule({
		previous: held,
		tasks: [{ id: "task-a", title: "Shop", predecessor: "", start: 1, end: 2, duration: 2 }],
		startDate: "2026-10-18",
		holidays: [],
		status: "For revision"
	});
	assert.equal(revised.locked, false);
	assert.equal(revised["task-a"].endOn, "2026-10-20");
	assert.equal(revised.rows[0].endOn, "2026-10-24");
	const holiday = refreshSchedule({
		tasks: [{ id: "task-a", title: "Shop", predecessor: "", start: 1, end: 1, duration: 1 }],
		startDate: "2026-10-19",
		holidays: ["2026-10-19"],
		status: "Ongoing"
	});
	assert.equal(holiday.startDate, "2026-10-20");
	assert.equal(holiday["task-a"].startOn, "2026-10-20");
});

test("the chart is bars only and a clone follows the new task ids", () => {
	const schedule = refreshSchedule({
		tasks: [
			{ id: "task-a", title: "Shop", predecessor: "", start: 1, end: 4, duration: 4 },
			{ id: "task-b", title: "Follows", predecessor: "task-a", start: 5, end: 6, duration: 2 }
		],
		startDate: "2026-10-19",
		holidays: [],
		status: "Draft"
	});
	const model = ganttModel(schedule);
	assert.equal(model.bars.length, 2);
	assert.equal(model.bars[1].x > model.bars[0].x, true);
	assert.equal(model.bars[0].width > 0, true);
	const { doc, idMap } = remapCloneIds({
		tasks: [
			{ id: "task-a", title: "Shop", predecessor: null, subtasks: [] },
			{ id: "task-b", title: "Follows", predecessor: "task-a", subtasks: [] }
		],
		sow: [{ heading: "Shop", activity_id: "task-a" }],
		sowText: "Keep this text",
		schedule
	}, (() => {
		let n = 0;
		return () => {
			n += 1;
			return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
		};
	})());
	assert.equal(doc.sowText, "Keep this text");
	assert.equal(doc.sow[0].activity_id, idMap["task-a"]);
	assert.equal(doc.schedule[idMap["task-a"]].taskId, idMap["task-a"]);
	assert.equal(doc.schedule[idMap["task-b"]].predecessor, idMap["task-a"]);
	assert.equal("task-a" in doc.schedule, false);
	assert.equal(barList(doc.schedule).length, 2);
});

test("export order is summary, scope, cost, schedule, then annexes", () => {
	const ordered = orderExportSections([
		{ title: "ATTCH", pdfData: "x" },
		{ title: "Scope of Work", sowHtml: "<p>Weld</p>" },
		{ title: "BILL OF LABOR" },
		{ title: "CE Summary", exportTitle: "COST ESTIMATE SUMMARY" },
		{ title: "Project schedule", exportTitle: "PROJECT SCHEDULE" }
	]);
	assert.deepEqual(ordered.map((section) => section.title), ["CE Summary", "Scope of Work", "BILL OF LABOR", "Project schedule", "ATTCH"]);
});

test("the flags stay off and computeSchedule is not rewritten", () => {
	const app = readFileSync(new URL("../../components/CostEstimatorApp.jsx", import.meta.url), "utf8");
	const sql = readFileSync(new URL("../../../supabase/p10-schedule-2026-10-20.sql", import.meta.url), "utf8");
	const src = readFileSync(new URL("./phase10.js", import.meta.url), "utf8");
	assert.match(app, /sowTagging: false/);
	assert.match(app, /schedule: false/);
	assert.match(app, /sowTagging: src\.features\?\.sowTagging === true/);
	assert.match(app, /schedule: src\.features\?\.schedule === true/);
	assert.match(app, /adminConfig\?\.features\?\.schedule === true/);
	assert.match(app, /function computeSchedule\(tasks\)/);
	assert.match(app, /subtask2\.type === "Parallel"/);
	assert.equal(/computeSchedule/.test(src), false);
	assert.equal(/criticalPath|milestone|lagDays|resourceView/.test(src), false);
	assert.equal(/alter table public\.clients/i.test(sql), false);
	assert.equal(/alter table public\.masterlist_items/i.test(sql), false);
	assert.match(sql, /ce_schedule/);
});
