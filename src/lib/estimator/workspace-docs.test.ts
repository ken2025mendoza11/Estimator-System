import assert from "node:assert/strict";
import test from "node:test";
import { emptyMasterlist, type WorkspacePayload } from "./defaults.ts";
import {
  assembleWorkspace,
  changedDocKeys,
  docKey,
  mergeServerWithDirty,
  planSave,
  revisionsForDirtyPush,
  splitWorkspace,
  stableHash,
  stripVolatileFileFields,
} from "./workspace-docs.ts";

function sample(): WorkspacePayload {
  return {
    ceList: [
      { id: "CE-2026-001", client: "ABC", status: "Draft", project: "Pump", lastEdited: "2026-01-02" },
    ],
    rceList: [{ id: "RCE-2026-001", client: "ABC", description: "Pump" }],
    masterlist: emptyMasterlist(),
    documents: {
      "CE-2026-001": {
        sowText: "Scope",
        fileAttachments: {
          general: [{ id: "file-1", name: "scope.pdf", storagePath: "ce/CE-2026-001/file-1" }],
        },
      },
    },
    schemaConfig: {
      columns: { manpower: ["role"] },
      __app: {
        savedAt: "2026-01-02T00:00:00.000Z",
        adminConfig: { users: [{ id: "user-1", name: "A" }] },
        inspectionReports: [{ id: "OIF-2026-001", oifNo: "OIF-2026-001", photos: [] }],
        taskTemplates: [{ id: "task-1", title: "Seal" }],
        scopeTemplates: [{ id: "scope-1", title: "Onsite" }],
        notifications: [{ id: "note-1" }],
        dbWipeRequests: [],
      },
    },
    inspectionReports: [{ id: "OIF-2026-001", oifNo: "OIF-2026-001", photos: [] }],
    adminConfig: { users: [{ id: "user-1", name: "A" }] },
    taskTemplates: [{ id: "task-1", title: "Seal" }],
    scopeTemplates: [{ id: "scope-1", title: "Onsite" }],
  } as WorkspacePayload;
}

test("split and assemble keep the same records", () => {
  const docs = splitWorkspace(sample());
  const rows = docs.map((doc) => ({
    kind: doc.kind,
    id: doc.id,
    payload: doc.payload,
    ord: doc.ord,
    version: 3,
  }));
  const { workspace, revisions } = assembleWorkspace(rows, sample());
  assert.equal(workspace.ceList[0].id, "CE-2026-001");
  assert.equal(workspace.ceList[0].client, "ABC");
  assert.equal(workspace.rceList[0].id, "RCE-2026-001");
  assert.equal((workspace.documents["CE-2026-001"] as { sowText: string }).sowText, "Scope");
  const reports = (workspace as { inspectionReports?: Array<{ id: string }> }).inspectionReports;
  assert.equal(reports?.[0].id, "OIF-2026-001");
  assert.equal(revisions[docKey("ce", "CE-2026-001")].version, 3);
  assert.equal(revisions[docKey("inspection", "OIF-2026-001")].version, 3);
});

test("a deleted record stays out of the assembled workspace", () => {
  const docs = splitWorkspace(sample());
  const rows = docs.map((doc) => ({
    kind: doc.kind,
    id: doc.id,
    payload: doc.payload,
    ord: doc.ord,
    version: doc.kind === "rce" ? 4 : 1,
    deleted: doc.kind === "rce",
  }));
  const { workspace, revisions } = assembleWorkspace(rows, sample());
  assert.equal(workspace.rceList.length, 0);
  assert.equal(revisions[docKey("rce", "RCE-2026-001")].deleted, true);
  assert.equal(workspace.ceList.length, 1);
});

test("file bytes do not change the document hash", () => {
  const stored = { name: "a.pdf", storagePath: "rce/1/a", stored: true };
  const open = { name: "a.pdf", stored: true, dataUrl: "data:application/pdf;base64,QQ==", url: "data:application/pdf;base64,QQ==" };
  assert.equal(stableHash(stripVolatileFileFields(stored)), stableHash(stripVolatileFileFields(open)));
});

test("unchanged documents are not written and a removal becomes a tombstone", () => {
  const docs = splitWorkspace(sample());
  const { revisions } = assembleWorkspace(
    docs.map((doc) => ({ ...doc, version: 2 })),
    sample(),
  );
  const unchanged = planSave(docs, revisions, new Set(), new Set());
  assert.equal(unchanged.writes.length, 0);
  assert.equal(unchanged.tombstones.length, 0);

  const edited = docs.map((doc) =>
    doc.kind === "ce"
      ? {
          ...doc,
          payload: { ...(doc.payload as object), summary: { id: "CE-2026-001", client: "Changed", status: "Draft", project: "Pump", lastEdited: "2026-01-03" } },
          hash: "different",
        }
      : doc,
  );
  const planned = planSave(edited, revisions, new Set(), new Set());
  assert.equal(planned.writes.length, 1);
  assert.equal(planned.writes[0].id, "CE-2026-001");
  assert.equal(planned.writes[0].expectedVersion, 2);
  assert.equal(planned.writes[0].force, false);

  const removed = docs.filter((doc) => doc.kind !== "ce");
  const tomb = planSave(removed, revisions, new Set(), new Set());
  assert.deepEqual(
    tomb.tombstones.map((item) => item.id),
    ["CE-2026-001"],
  );
});

test("a server document this client never loaded is not deleted", () => {
  const docs = splitWorkspace(sample()).filter((doc) => doc.kind !== "ce");
  const tomb = planSave(docs, {}, new Set(), new Set());
  assert.equal(tomb.tombstones.length, 0);
});

test("an already deleted record is not written back", () => {
  const docs = splitWorkspace(sample());
  const base = Object.fromEntries(docs.map((doc) => [docKey(doc.kind, doc.id), {
    version: 2,
    hash: doc.hash,
    synced: true,
    deleted: doc.kind === "inspection",
  }]));
  const without = docs.filter((doc) => doc.kind !== "inspection");
  const planned = planSave(without, base, new Set(), new Set());
  assert.equal(planned.tombstones.some((item) => item.kind === "inspection"), false);
});

test("saving only the timestamp does not rewrite settings", () => {
  const first = sample();
  const second = sample();
  const app = (second.schemaConfig as { __app: { savedAt: string } }).__app;
  app.savedAt = "2026-04-01T00:00:00.000Z";
  const a = splitWorkspace(first).find((doc) => doc.kind === "schema");
  const b = splitWorkspace(second).find((doc) => doc.kind === "schema");
  assert.equal(a?.hash, b?.hash);
});

test("held admin settings are not part of the save", () => {
  const docs = splitWorkspace(sample());
  const planned = planSave(docs, {}, new Set(), new Set(["admin"]));
  assert.equal(planned.writes.some((doc) => doc.kind === "admin"), false);
  assert.equal(planned.writes.some((doc) => doc.kind === "ce"), true);
});

test("hydration does not tombstone a server document missing from the local copy", () => {
  const server = sample();
  server.ceList.push({
    id: "CE-2026-009",
    client: "Server",
    status: "Draft",
    project: "Kept",
    lastEdited: "2026-02-01",
  });
  const local = sample();
  local.ceList[0] = { ...local.ceList[0], client: "Local edit" };
  const merged = mergeServerWithDirty(server, local, [docKey("ce", "CE-2026-001")]);
  assert.equal(merged.ceList.find((ce) => ce.id === "CE-2026-001")?.client, "Local edit");
  assert.equal(merged.ceList.some((ce) => ce.id === "CE-2026-009"), true);
  assert.equal(merged.rceList.length, server.rceList.length);
  const docs = splitWorkspace(merged);
  const { revisions } = assembleWorkspace(
    splitWorkspace(server).map((doc) => ({ ...doc, version: 4 })),
    server,
  );
  const quiet = planSave(docs, revisions, new Set(), new Set(), false);
  assert.equal(quiet.tombstones.length, 0);
  assert.equal(quiet.writes.length, 1);
  assert.equal(quiet.writes[0].id, "CE-2026-001");
  assert.equal(quiet.writes[0].expectedVersion, 4);
});

test("a local list does not replace server rows that were not edited", () => {
  const server = sample();
  const local = sample();
  local.rceList = [];
  local.ceList = [];
  const merged = mergeServerWithDirty(server, local, [docKey("ce", "CE-2026-001"), docKey("rce", "RCE-2026-001")]);
  assert.equal(merged.ceList.length, 1);
  assert.equal(merged.rceList.length, 1);
  const untouched = mergeServerWithDirty(server, local, []);
  assert.equal(untouched, server);
});

test("changed document keys ignore a timestamp-only save", () => {
  const first = sample();
  const second = sample();
  const app = (second.schemaConfig as { __app: { savedAt: string } }).__app;
  app.savedAt = "2026-05-01T00:00:00.000Z";
  assert.deepEqual(changedDocKeys(first, second), []);
  second.ceList[0] = { ...second.ceList[0], client: "Edited" };
  assert.deepEqual(changedDocKeys(first, second), [docKey("ce", "CE-2026-001")]);
});

test("a dirty document keeps the version the edit started from", () => {
  const server = {
    [docKey("ce", "CE-2026-001")]: { version: 5, hash: "server", synced: true },
    [docKey("rce", "RCE-2026-001")]: { version: 3, hash: "rce", synced: true },
  };
  const backup = {
    [docKey("ce", "CE-2026-001")]: { version: 2, hash: "local-base", synced: true },
  };
  const pinned = revisionsForDirtyPush(server, backup, [docKey("ce", "CE-2026-001")]);
  assert.equal(pinned[docKey("ce", "CE-2026-001")].version, 2);
  assert.equal(pinned[docKey("rce", "RCE-2026-001")].version, 3);
  assert.equal(revisionsForDirtyPush(server, backup, [])[docKey("ce", "CE-2026-001")].version, 5);
  assert.equal(server[docKey("ce", "CE-2026-001")].version, 5);
});


test("Step 25: a stored ord that differs from the list position does not cause a save on load", () => {
  const docs = splitWorkspace(sample());
  const rows = docs.map((doc) => ({
    kind: doc.kind,
    id: doc.id,
    payload: doc.payload,
    ord: doc.kind === "ce" || doc.kind === "inspection" ? doc.ord + 100 : doc.ord,
    version: 1,
  }));
  const { workspace, revisions } = assembleWorkspace(rows, sample());
  const plan = planSave(splitWorkspace(workspace), revisions, new Set(), new Set());
  assert.equal(plan.writes.length, 0);
});
