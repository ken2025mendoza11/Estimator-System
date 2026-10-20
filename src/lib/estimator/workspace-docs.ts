import type { Json, WorkspacePayload } from "./defaults";

export const DOC_KINDS = [
  "ce",
  "rce",
  "inspection",
  "task",
  "scope",
  "masterlist",
  "admin",
  "schema",
  "notifications",
  "wipes",
] as const;

export type DocKind = (typeof DOC_KINDS)[number];

const SINGLETONS: Record<string, string> = {
  masterlist: "company",
  admin: "company",
  schema: "company",
  notifications: "company",
  wipes: "company",
};

const APP_KEYS = [
  "adminConfig",
  "inspectionReports",
  "taskTemplates",
  "scopeTemplates",
  "notifications",
  "dbWipeRequests",
] as const;

export type LocalDoc = {
  kind: DocKind;
  id: string;
  payload: Json;
  ord: number;
  hash: string;
};

export type Revision = {
  version: number;
  hash: string;
  synced: boolean;
  deleted?: boolean;
};

export type RevisionMap = Record<string, Revision>;

export type PlannedWrite = {
  kind: DocKind;
  id: string;
  payload: Json;
  ord: number;
  hash: string;
  expectedVersion: number | null;
  force: boolean;
  /** Version already matches. Retry the mirror only. */
  touchOnly: boolean;
};

export type PlannedTombstone = {
  kind: string;
  id: string;
  expectedVersion: number;
  force: boolean;
};

export class WorkspaceSaveError extends Error {
  conflicts: Array<{ kind: string; id: string; reason: "version" | "deleted" | "exists" }>;
  revisions: RevisionMap;

  constructor(
    message: string,
    conflicts: Array<{ kind: string; id: string; reason: "version" | "deleted" | "exists" }>,
    revisions: RevisionMap,
  ) {
    super(message);
    this.name = "WorkspaceSaveError";
    this.conflicts = conflicts;
    this.revisions = revisions;
  }
}

export function docKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function isSingleton(kind: string): boolean {
  return Object.prototype.hasOwnProperty.call(SINGLETONS, kind);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

/** Drop file bytes and storage paths so a rehydrated file hashes like the stored one. */
export function stripVolatileFileFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripVolatileFileFields);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (key === "storagePath") continue;
    if (key === "dataUrl" || key === "url") {
      const text = typeof inner === "string" ? inner : "";
      if (text.startsWith("data:") || text.startsWith("blob:")) continue;
    }
    out[key] = stripVolatileFileFields(inner);
  }
  return out;
}

function canonical(kind: DocKind, payload: unknown): unknown {
  const copy = stripVolatileFileFields(cloneJson(payload));
  if (kind === "schema") {
    const app = asRecord(asRecord(copy).__app);
    delete app.savedAt;
  }
  return copy;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function stableHash(value: unknown): string {
  const text = stableStringify(value);
  const mix = (seed: number) => {
    let hash = seed >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  return mix(0x811c9dc5) + mix(0x811c9dc5 ^ text.length);
}

function docHash(kind: DocKind, payload: unknown, ord: number): string {
  return stableHash({ ord, body: canonical(kind, payload) });
}

function readList(payload: WorkspacePayload, key: string): Json[] {
  const top = (payload as Record<string, unknown>)[key];
  if (Array.isArray(top)) return top as Json[];
  const nested = asRecord(asRecord(payload.schemaConfig).__app)[key];
  return Array.isArray(nested) ? (nested as Json[]) : [];
}

function schemaBody(schemaConfig: WorkspacePayload["schemaConfig"]): Json {
  const schema = cloneJson(asRecord(schemaConfig)) as Record<string, unknown>;
  const app = asRecord(schema.__app);
  for (const key of APP_KEYS) delete app[key];
  if (Object.keys(app).length) schema.__app = app;
  else delete schema.__app;
  return schema as Json;
}

function requireId(kind: string, id: string): string {
  const text = String(id || "").trim();
  if (!text) {
    throw new WorkspaceSaveError(
      `A ${kind} record is missing an id, so nothing was overwritten. Your changes are still here.`,
      [],
      {},
    );
  }
  return text;
}

function pushDoc(
  docs: LocalDoc[],
  kind: DocKind,
  id: string,
  payload: Json,
  ord: number,
) {
  docs.push({
    kind,
    id,
    payload,
    ord,
    hash: docHash(kind, payload, ord),
  });
}

export function splitWorkspace(payload: WorkspacePayload): LocalDoc[] {
  const docs: LocalDoc[] = [];
  const documents = asRecord(payload.documents);
  const listed = new Set<string>();
  (payload.ceList || []).forEach((ce, index) => {
    const id = requireId("cost estimate", ce?.id);
    listed.add(id);
    const document = Object.prototype.hasOwnProperty.call(documents, id)
      ? (documents[id] as Json)
      : null;
    pushDoc(docs, "ce", id, { summary: ce as unknown as Json, document } as Json, index);
  });
  Object.keys(documents).forEach((id, index) => {
    if (listed.has(id)) return;
    pushDoc(
      docs,
      "ce",
      requireId("cost estimate", id),
      { summary: null, document: documents[id] as Json } as Json,
      (payload.ceList || []).length + index,
    );
  });
  (payload.rceList || []).forEach((rce, index) => {
    const record = asRecord(rce);
    const id = requireId("RCE", String(record.id || record.rceNo || ""));
    pushDoc(docs, "rce", id, rce as Json, index);
  });
  readList(payload, "inspectionReports").forEach((report, index) => {
    const record = asRecord(report);
    const id = requireId("inspection report", String(record.id || record.oifNo || ""));
    pushDoc(docs, "inspection", id, report as Json, index);
  });
  readList(payload, "taskTemplates").forEach((item, index) => {
    const record = asRecord(item);
    const id = requireId("task template", String(record.id || ""));
    pushDoc(docs, "task", id, item as Json, index);
  });
  readList(payload, "scopeTemplates").forEach((item, index) => {
    const record = asRecord(item);
    const id = requireId("scope template", String(record.id || ""));
    pushDoc(docs, "scope", id, item as Json, index);
  });
  pushDoc(docs, "masterlist", SINGLETONS.masterlist, (payload.masterlist || {}) as Json, 0);
  const adminTop = (payload as Record<string, unknown>).adminConfig;
  const admin = adminTop && typeof adminTop === "object"
    ? (adminTop as Json)
    : ((asRecord(asRecord(payload.schemaConfig).__app).adminConfig as Json) ?? {});
  pushDoc(docs, "admin", SINGLETONS.admin, (admin || {}) as Json, 0);
  pushDoc(docs, "schema", SINGLETONS.schema, schemaBody(payload.schemaConfig || {}), 0);
  const app = asRecord(asRecord(payload.schemaConfig).__app);
  const notifications = Array.isArray(app.notifications) ? (app.notifications as Json) : [];
  const wipes = Array.isArray(app.dbWipeRequests) ? (app.dbWipeRequests as Json) : [];
  pushDoc(docs, "notifications", SINGLETONS.notifications, notifications, 0);
  pushDoc(docs, "wipes", SINGLETONS.wipes, wipes, 0);
  return docs;
}

export type StoredDoc = {
  kind: string;
  id: string;
  payload: Json;
  ord: number;
  version: number;
  deleted?: boolean;
};

export function assembleWorkspace(
  rows: StoredDoc[],
  fallback: WorkspacePayload,
): { workspace: WorkspacePayload; revisions: RevisionMap } {
  const live = rows
    .filter((row) => !row.deleted && DOC_KINDS.includes(row.kind as DocKind))
    .slice()
    .sort((a, b) => a.ord - b.ord || a.id.localeCompare(b.id));
  if (!live.length && !rows.length) {
    return { workspace: fallback, revisions: {} };
  }
  const revisions: RevisionMap = {};
  const take = (kind: DocKind) =>
    live.filter((row) => {
      if (row.kind !== kind) return false;
      revisions[docKey(kind, row.id)] = {
        version: row.version,
        hash: docHash(kind, row.payload, row.ord),
        synced: true,
      };
      return true;
    });
  const ces = take("ce");
  const rces = take("rce");
  const inspections = take("inspection");
  const tasks = take("task");
  const scopes = take("scope");
  const master = take("masterlist")[0];
  const admin = take("admin")[0];
  const schema = take("schema")[0];
  const notes = take("notifications")[0];
  const wipes = take("wipes")[0];
  for (const row of rows) {
    if (!row.deleted) continue;
    if (!DOC_KINDS.includes(row.kind as DocKind)) continue;
    revisions[docKey(row.kind, row.id)] = {
      version: row.version,
      hash: "",
      synced: true,
      deleted: true,
    };
  }

  const ceList = ces
    .map((row) => asRecord(row.payload).summary)
    .filter((summary) => summary && typeof summary === "object") as WorkspacePayload["ceList"];
  const documents: WorkspacePayload["documents"] = {};
  ces.forEach((row) => {
    const payload = asRecord(row.payload);
    if (payload.document && typeof payload.document === "object") {
      documents[row.id] = payload.document as Json;
    }
  });
  const inspectionReports = inspections.map((row) => row.payload);
  const taskTemplates = tasks.map((row) => row.payload);
  const scopeTemplates = scopes.map((row) => row.payload);
  const adminConfig = (admin?.payload as Json) ?? {};
  const notifications = Array.isArray(notes?.payload) ? notes.payload : [];
  const dbWipeRequests = Array.isArray(wipes?.payload) ? wipes.payload : [];
  const schemaRecord = asRecord(schema?.payload);
  const app = asRecord(schemaRecord.__app);
  delete app.adminConfig;
  delete app.inspectionReports;
  delete app.taskTemplates;
  delete app.scopeTemplates;
  delete app.notifications;
  delete app.dbWipeRequests;
  const schemaConfig = {
    ...schemaRecord,
    __app: {
      ...app,
      adminConfig,
      inspectionReports,
      taskTemplates,
      scopeTemplates,
      notifications,
      dbWipeRequests,
    },
  } as WorkspacePayload["schemaConfig"];

  const workspace = {
    ceList,
    rceList: rces.map((row) => row.payload) as WorkspacePayload["rceList"],
    masterlist: (master?.payload as WorkspacePayload["masterlist"]) || fallback.masterlist,
    documents,
    schemaConfig,
    inspectionReports,
    adminConfig,
    taskTemplates,
    scopeTemplates,
  } as WorkspacePayload;
  return { workspace, revisions };
}

export function planSave(
  local: LocalDoc[],
  base: RevisionMap,
  forceKeys: Set<string>,
  holdKinds: Set<string>,
  allowTombstones = true,
): { writes: PlannedWrite[]; tombstones: PlannedTombstone[] } {
  const writes: PlannedWrite[] = [];
  const seen = new Set<string>();
  for (const doc of local) {
    const key = docKey(doc.kind, doc.id);
    seen.add(key);
    if (holdKinds.has(doc.kind)) continue;
    const prev = base[key];
    const forced = forceKeys.has(key);
    if (prev && prev.hash === doc.hash && prev.synced !== false && !forced) continue;
    const touchOnly = Boolean(prev && prev.hash === doc.hash && prev.synced === false && !forced);
    writes.push({
      kind: doc.kind,
      id: doc.id,
      payload: doc.payload,
      ord: doc.ord,
      hash: doc.hash,
      expectedVersion: prev ? prev.version : null,
      force: forced,
      touchOnly,
    });
  }
  const tombstones: PlannedTombstone[] = [];
  if (!allowTombstones) return { writes, tombstones };
  for (const [key, prev] of Object.entries(base)) {
    if (seen.has(key) || !prev.version) continue;
    const splitAt = key.indexOf(":");
    const kind = key.slice(0, splitAt);
    const id = key.slice(splitAt + 1);
    if (isSingleton(kind) || holdKinds.has(kind)) continue;
    if (prev.deleted) continue;
    tombstones.push({
      kind,
      id,
      expectedVersion: prev.version,
      force: forceKeys.has(key),
    });
  }
  return { writes, tombstones };
}

function listRows(payload: WorkspacePayload, key: string): Json[] {
  const top = (payload as Record<string, unknown>)[key];
  if (Array.isArray(top)) return [...(top as Json[])];
  const nested = asRecord(asRecord(payload.schemaConfig).__app)[key];
  return Array.isArray(nested) ? [...(nested as Json[])] : [];
}

function putList(payload: WorkspacePayload, key: string, rows: Json[]) {
  (payload as Record<string, unknown>)[key] = rows;
  const schema = asRecord(payload.schemaConfig);
  const app = asRecord(schema.__app);
  app[key] = rows;
  schema.__app = app;
  payload.schemaConfig = schema as WorkspacePayload["schemaConfig"];
}

function replaceRow(rows: Json[], id: string, payload: Json) {
  const index = rows.findIndex((row) => {
    const record = asRecord(row);
    return String(record.id || record.rceNo || record.oifNo || "") === id;
  });
  if (index >= 0) rows[index] = payload;
  else rows.push(payload);
}

/**
 * Server lists stay. Only documents the user changed locally are copied over.
 * A local backup never drops a server document.
 */
export function mergeServerWithDirty(
  server: WorkspacePayload,
  local: WorkspacePayload | null,
  dirtyKeys: string[],
): WorkspacePayload {
  if (!local || !dirtyKeys.length) return server;
  const dirty = new Set(dirtyKeys);
  let localDocs: LocalDoc[];
  try {
    localDocs = splitWorkspace(local);
  } catch {
    return server;
  }
  const next = cloneJson(server);
  const ces = [...(next.ceList || [])];
  const rces = [...(next.rceList || [])] as Json[];
  const documents = { ...(next.documents || {}) };
  const inspections = listRows(next, "inspectionReports");
  const tasks = listRows(next, "taskTemplates");
  const scopes = listRows(next, "scopeTemplates");
  for (const doc of localDocs) {
    if (!dirty.has(docKey(doc.kind, doc.id))) continue;
    if (doc.kind === "ce") {
      const body = asRecord(doc.payload);
      if (body.summary && typeof body.summary === "object") {
        const summary = body.summary as { id?: string };
        const index = ces.findIndex((ce) => ce?.id === doc.id);
        if (index >= 0) ces[index] = summary as WorkspacePayload["ceList"][number];
        else ces.push(summary as WorkspacePayload["ceList"][number]);
      }
      if (body.document && typeof body.document === "object") {
        documents[doc.id] = body.document as Json;
      }
    } else if (doc.kind === "rce") {
      replaceRow(rces, doc.id, doc.payload);
    } else if (doc.kind === "inspection") {
      replaceRow(inspections, doc.id, doc.payload);
    } else if (doc.kind === "task") {
      replaceRow(tasks, doc.id, doc.payload);
    } else if (doc.kind === "scope") {
      replaceRow(scopes, doc.id, doc.payload);
    } else if (doc.kind === "masterlist") {
      next.masterlist = doc.payload as WorkspacePayload["masterlist"];
    } else if (doc.kind === "admin") {
      (next as { adminConfig?: Json }).adminConfig = doc.payload;
      const schema = asRecord(next.schemaConfig);
      const app = asRecord(schema.__app);
      app.adminConfig = doc.payload;
      schema.__app = app;
      next.schemaConfig = schema as WorkspacePayload["schemaConfig"];
    } else if (doc.kind === "notifications") {
      const schema = asRecord(next.schemaConfig);
      const app = asRecord(schema.__app);
      app.notifications = doc.payload;
      schema.__app = app;
      next.schemaConfig = schema as WorkspacePayload["schemaConfig"];
    } else if (doc.kind === "wipes") {
      const schema = asRecord(next.schemaConfig);
      const app = asRecord(schema.__app);
      app.dbWipeRequests = doc.payload;
      schema.__app = app;
      next.schemaConfig = schema as WorkspacePayload["schemaConfig"];
    }
  }
  next.ceList = ces;
  next.rceList = rces as WorkspacePayload["rceList"];
  next.documents = documents;
  putList(next, "inspectionReports", inspections);
  putList(next, "taskTemplates", tasks);
  putList(next, "scopeTemplates", scopes);
  return next;
}

/** Keys whose payload hash changed. Used so a save pushes only the dirty documents. */
export function changedDocKeys(prev: WorkspacePayload, next: WorkspacePayload): string[] {
  let before: LocalDoc[] = [];
  let after: LocalDoc[] = [];
  try {
    before = splitWorkspace(prev);
  } catch {
    return [];
  }
  try {
    after = splitWorkspace(next);
  } catch {
    return [];
  }
  const prevHash = new Map(before.map((doc) => [docKey(doc.kind, doc.id), doc.hash]));
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const doc of after) {
    const key = docKey(doc.kind, doc.id);
    seen.add(key);
    if (prevHash.get(key) !== doc.hash) keys.push(key);
  }
  for (const doc of before) {
    const key = docKey(doc.kind, doc.id);
    if (!seen.has(key)) keys.push(key);
  }
  return keys;
}

/**
 * A dirty document is saved against the version it was edited from, not the
 * version just read from the server. That keeps a second browser from being
 * overwritten without a conflict.
 */
export function revisionsForDirtyPush(
  server: RevisionMap,
  backup: RevisionMap | null | undefined,
  dirtyKeys: string[],
): RevisionMap {
  if (!backup || !dirtyKeys.length) return server;
  const next: RevisionMap = { ...server };
  for (const key of dirtyKeys) {
    const prev = backup[key];
    if (prev && Number.isFinite(prev.version)) next[key] = prev;
  }
  return next;
}

