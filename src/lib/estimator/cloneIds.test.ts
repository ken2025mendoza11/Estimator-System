import assert from "node:assert/strict";
import test from "node:test";
import { remapCloneIds } from "./cloneIds.js";
import { emptyMasterlist, type WorkspacePayload } from "./defaults.ts";
import { assembleWorkspace, splitWorkspace } from "./workspace-docs.ts";

function uuidFactory() {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function sampleDoc() {
  return {
    id: "CE-2026-001",
    projectInfo: { docNo: "CE-2026-001", revNo: "2" },
    sowText: "Keep this text",
    sow: [
      { heading: "Weld", activity_id: "task-a" },
      { heading: "Other", activity_id: "not-a-task" },
    ],
    schedule: {
      "task-a": { start: 1, end: 4, taskId: "task-a" },
      rows: [{ taskId: "task-b", subtaskId: "sub-child", predecessor: "task-a" }],
    },
    summaryTaskFilters: { showBreakdown: true, selectedTaskIds: ["task-a", "task-b"] },
    fileAttachments: { BOL: [{ id: "file-1", name: "photo.png" }] },
    clonedFrom: { note: "kept" },
    tasks: [
      {
        id: "task-a",
        title: "Shop",
        predecessor: null,
        duration: 4,
        subtasks: [
          {
            id: "sub-1",
            predecessor: null,
            items: {
              BOL: [{ id: "line-1", qty: 2, days: 3, rate: 100.5 }],
              MISC: [{ id: "line-m", qty: 1, days: 1, unitCost: 20 }],
            },
            children: [
              {
                id: "sub-child",
                predecessor: "sub-1",
                items: { BOTE: [{ id: "line-2", qty: 1, days: 2, rate: 50 }] },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: "task-b",
        title: "Follows",
        predecessor: "task-a",
        subtasks: [
          {
            id: "sub-2",
            predecessor: "missing-sub",
            items: { PPE: [{ id: "line-3", qty: 4, unitCost: 8 }] },
            children: [],
          },
        ],
      },
    ],
  };
}

function numbersOf(value: unknown, skipClone = true, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => numbersOf(item, skipClone, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (skipClone && key === "clonedFrom") continue;
      numbersOf(item, skipClone, out);
    }
  }
  return out;
}

test("a clone gets new task, subtask, and line ids and keeps the source", () => {
  const source = sampleDoc();
  const before = JSON.parse(JSON.stringify(source));
  const { doc, idMap } = remapCloneIds(source, uuidFactory());
  assert.deepEqual(source, before);
  assert.equal(doc.tasks && (doc.tasks as { id: string }[])[0].id, idMap["task-a"]);
  assert.notEqual(idMap["task-a"], "task-a");
  assert.notEqual(idMap["sub-child"], "sub-child");
  assert.notEqual(idMap["line-1"], "line-1");
  assert.equal(Object.keys(idMap).length, 9);
  const tasks = doc.tasks as Array<{ id: string; predecessor: string | null; subtasks: Array<{ id: string; predecessor: string | null; items: { BOL: Array<{ id: string; qty: number }> }; children: Array<{ id: string; predecessor: string }> }> }>;
  assert.equal(tasks[1].predecessor, idMap["task-a"]);
  assert.equal(tasks[0].predecessor, null);
  assert.equal(tasks[0].subtasks[0].children[0].predecessor, idMap["sub-1"]);
  assert.equal(tasks[1].subtasks[0].predecessor, "missing-sub");
  assert.equal(tasks[0].subtasks[0].items.BOL[0].id, idMap["line-1"]);
  assert.equal(tasks[0].subtasks[0].items.BOL[0].qty, 2);
});

test("sow activity ids and schedule rows follow the new ids", () => {
  const { doc, idMap } = remapCloneIds(sampleDoc(), uuidFactory());
  const sow = doc.sow as Array<{ heading: string; activity_id: string }>;
  assert.equal(sow[0].activity_id, idMap["task-a"]);
  assert.equal(sow[1].activity_id, "not-a-task");
  assert.equal(doc.sowText, "Keep this text");
  const schedule = doc.schedule as { rows: Array<{ taskId: string; subtaskId: string; predecessor: string }>; [key: string]: unknown };
  const moved = schedule[idMap["task-a"]] as { taskId: string; start: number };
  assert.equal(moved.taskId, idMap["task-a"]);
  assert.equal(moved.start, 1);
  assert.equal(schedule.rows[0].taskId, idMap["task-b"]);
  assert.equal(schedule.rows[0].subtaskId, idMap["sub-child"]);
  assert.equal(schedule.rows[0].predecessor, idMap["task-a"]);
  assert.equal("task-a" in schedule, false);
});

test("clonedFrom records the source and does not change money or attachment ids", () => {
  const source = sampleDoc();
  const { doc } = remapCloneIds(source, uuidFactory());
  const clonedFrom = doc.clonedFrom as { sourceId: string; note: string; idMap: Record<string, string> };
  assert.equal(clonedFrom.sourceId, "CE-2026-001");
  assert.equal(clonedFrom.note, "kept");
  assert.equal(clonedFrom.idMap["task-b"], (doc.tasks as Array<{ id: string }>)[1].id);
  assert.deepEqual(numbersOf(doc), numbersOf(source));
  const files = doc.fileAttachments as { BOL: Array<{ id: string }> };
  assert.equal(files.BOL[0].id, "file-1");
  const info = doc.projectInfo as { docNo: string; revNo: string };
  assert.equal(info.docNo, "CE-2026-001");
  assert.equal(info.revNo, "2");
  const filters = doc.summaryTaskFilters as { selectedTaskIds: string[] };
  assert.deepEqual(filters.selectedTaskIds, [clonedFrom.idMap["task-a"], clonedFrom.idMap["task-b"]]);
});

test("default ids are fresh uuids and a second clone differs", () => {
  const first = remapCloneIds(sampleDoc());
  const second = remapCloneIds(sampleDoc());
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(first.idMap["task-a"], uuid);
  assert.notEqual(first.idMap["task-a"], second.idMap["task-a"]);
  assert.deepEqual(numbersOf(first.doc), numbersOf(second.doc));
});

test("saving and loading a cost estimate does not regenerate ids", () => {
  const payload = {
    ceList: [{ id: "CE-2026-001", client: "A", status: "Ongoing", project: "P", lastEdited: "2026-01-02" }],
    rceList: [],
    masterlist: emptyMasterlist(),
    documents: {
      "CE-2026-001": sampleDoc(),
    },
    schemaConfig: { __app: {} },
    inspectionReports: [],
    adminConfig: {},
    taskTemplates: [],
    scopeTemplates: [],
  } as WorkspacePayload;
  const split = splitWorkspace(payload);
  const ce = split.find((doc) => doc.kind === "ce" && doc.id === "CE-2026-001");
  assert.ok(ce);
  const rows = split.map((doc) => ({ ...doc, version: 2 }));
  const loaded = assembleWorkspace(rows, payload).workspace;
  const document = loaded.documents["CE-2026-001"] as {
    tasks: Array<{
      id: string;
      predecessor: string | null;
      subtasks: Array<{
        items: { BOL: Array<{ id: string }> };
        children: Array<{ predecessor: string }>;
      }>;
    }>;
  };
  assert.equal(document.tasks[0].id, "task-a");
  assert.equal(document.tasks[0].subtasks[0].items.BOL[0].id, "line-1");
  assert.equal(document.tasks[1].predecessor, "task-a");
  assert.equal(document.tasks[0].subtasks[0].children[0].predecessor, "sub-1");
  const saved = splitWorkspace(loaded).find((doc) => doc.kind === "ce" && doc.id === "CE-2026-001");
  assert.deepEqual(saved?.payload, ce.payload);
});
