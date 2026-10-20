import { supabase, COMPANY_WORKSPACE_ID } from "@/lib/supabase/client";
import { ensureSupabaseAccess } from "@/lib/supabase/session";
import {
  defaultWorkspace,
  emptyMasterlist,
  jsonSafe,
  parseJson,
  type Json,
  type MasterlistState,
  type WorkspacePayload,
} from "./defaults";
import {
  assembleWorkspace,
  docKey,
  planSave,
  splitWorkspace,
  WorkspaceSaveError,
  type PlannedWrite,
  type RevisionMap,
  type StoredDoc,
} from "./workspace-docs";
import { missingDocNumberRpc } from "./docNumbers";
import {
  downloadDataUrl,
  fileBody,
  listStoredFiles,
  payloadHasFileBodies,
  rehydratePayloadFiles,
  rewritePayloadFiles,
} from "./file-storage";

type WorkspaceRow = {
  ce_list: unknown;
  rce_list: unknown;
  masterlist: unknown;
  documents: unknown;
  schema_config: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.length ? text : null;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToWorkspace(row: WorkspaceRow | null): WorkspacePayload {
  const fallback = defaultWorkspace();
  if (!row) return fallback;
  const masterlist = parseJson<MasterlistState>(row.masterlist, emptyMasterlist());
  return {
    ceList: parseJson(row.ce_list, fallback.ceList),
    rceList: parseJson(row.rce_list, fallback.rceList),
    masterlist: { ...emptyMasterlist(), ...masterlist },
    documents: parseJson(row.documents, {}),
    schemaConfig: parseJson(row.schema_config, {}),
  };
}

function masterlistRowCount(ml: MasterlistState): number {
  let total = 0;
  (["manpower", "equipment", "consumables", "ppe", "misc", "clients"] as const).forEach(
    (key) => {
      if (Array.isArray(ml[key])) total += ml[key].length;
    },
  );
  (ml.customCategories || []).forEach((raw) => {
    const items = asRecord(raw).items;
    if (Array.isArray(items)) total += items.length;
  });
  return total;
}

async function restoreMasterlistFromTables(): Promise<MasterlistState | null> {
  const [itemsRes, clientsRes, catsRes] = await Promise.all([
    supabase
      .from("masterlist_items")
      .select(
        "id, category_key, attrs, name, role, description, item, unit, daily_rate, monthly_rate, rate_per_day, unit_cost, estimated_cost, per_diem, allowance",
      ),
    supabase.from("clients").select("id, client_code, full_name, address, extra"),
    supabase
      .from("masterlist_categories")
      .select("id, category_key, category_name"),
  ]);
  if (itemsRes.error && clientsRes.error) return null;
  const items = itemsRes.data || [];
  const clients = clientsRes.data || [];
  if (!items.length && !clients.length) return null;

  const ml = emptyMasterlist();
  const fixed = new Set(["manpower", "equipment", "consumables", "ppe", "misc"]);
  const customMap = new Map<
    string,
    { id: string; categoryKey: string; categoryName: string; items: Json[] }
  >();
  for (const cat of catsRes.data || []) {
    const key = String(cat.category_key || "");
    if (!key || fixed.has(key)) continue;
    customMap.set(key, {
      id: String(cat.id || key),
      categoryKey: key,
      categoryName: String(cat.category_name || key),
      items: [],
    });
  }
  for (const row of items) {
    const attrs = asRecord(row.attrs);
    const item = {
      ...attrs,
      id: String(attrs.id || row.id),
      name: attrs.name ?? row.name ?? "",
      role: attrs.role ?? row.role ?? "",
      description: attrs.description ?? row.description ?? "",
      item: attrs.item ?? row.item ?? "",
      unit: attrs.unit ?? row.unit ?? "",
      dailyRate: attrs.dailyRate ?? row.daily_rate ?? 0,
      monthlyRate: attrs.monthlyRate ?? row.monthly_rate ?? 0,
      ratePerDay: attrs.ratePerDay ?? row.rate_per_day ?? 0,
      unitCost: attrs.unitCost ?? row.unit_cost ?? 0,
      estimatedCost: attrs.estimatedCost ?? row.estimated_cost ?? 0,
      perDiem: attrs.perDiem ?? row.per_diem ?? 0,
      allowance: attrs.allowance ?? row.allowance ?? 0,
    } as Json;
    const key = String(row.category_key || "");
    if (
      key === "manpower" ||
      key === "equipment" ||
      key === "consumables" ||
      key === "ppe" ||
      key === "misc"
    ) {
      ml[key].push(item);
    } else if (key) {
      if (!customMap.has(key)) {
        customMap.set(key, {
          id: key,
          categoryKey: key,
          categoryName: key,
          items: [],
        });
      }
      customMap.get(key)?.items.push(item);
    }
  }
  ml.customCategories = Array.from(customMap.values());
  ml.clients = clients.map((row) => {
    const extra = asRecord(row.extra);
    return {
      ...extra,
      id: String(extra.id || row.id),
      clientCode: String(extra.clientCode || row.client_code || ""),
      fullName: String(extra.fullName || row.full_name || ""),
      address: String(extra.address || row.address || ""),
    } as Json;
  });
  return masterlistRowCount(ml) ? ml : null;
}

function asDate(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}


const MIGRATION_KEY = "migration:doc-safety";

type Marker = { docs?: boolean; files?: boolean };

export type LoadResult = {
  workspace: WorkspacePayload;
  revisions: RevisionMap;
  warning?: string;
  /** Document table is missing — show records, but do not write. */
  blocked?: boolean;
};

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function explain(error: { message?: string; code?: string } | null): Error {
  const message = error?.message || "The save failed.";
  if (/workspace_docs|save_workspace_doc|schema cache|estimator-files/i.test(message)) {
    return new Error(
      "The database is missing the document-save update. Run supabase/apply-v2.sql in the Supabase SQL editor. Your changes are still here.",
    );
  }
  const text = /your changes are still here/i.test(message)
    ? message
    : `${message} Your changes are still here.`;
  return new Error(text);
}

function blankWorkspace(): WorkspacePayload {
  return {
    ceList: [],
    rceList: [],
    masterlist: emptyMasterlist(),
    documents: {},
    schemaConfig: {},
  };
}

async function readMarker(): Promise<Marker> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", MIGRATION_KEY)
    .maybeSingle();
  if (error) return {};
  const value = data?.value;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Marker)
    : {};
}

async function writeMarker(marker: Marker): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: MIGRATION_KEY,
      value: marker,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw error;
}

async function readAllDocs(): Promise<StoredDoc[]> {
  const rows: StoredDoc[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("workspace_docs")
      .select("kind, doc_id, payload, version, ord, deleted_at")
      .range(from, from + page - 1);
    if (error) throw error;
    const batch = data || [];
    for (const row of batch) {
      rows.push({
        kind: String(row.kind),
        id: String(row.doc_id),
        payload: (row.payload ?? {}) as Json,
        version: Number(row.version) || 1,
        ord: Number(row.ord) || 0,
        deleted: Boolean(row.deleted_at),
      });
    }
    if (batch.length < page) break;
  }
  return rows;
}

function missingSaveRpc(error: { message?: string; code?: string } | null): boolean {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  if (code === "PGRST202" || code === "42883") return true;
  return /save_workspace_doc/i.test(message) && /does not exist|could not find|schema cache/i.test(message);
}

/** Prefer the save function. A direct write is only the fallback when that function is not deployed. */
async function writeWorkspaceDoc(input: {
  kind: string;
  id: string;
  payload: Json;
  ord: number;
  expectedVersion: number | null;
  ignoreExists?: boolean;
}): Promise<void> {
  const { data, error } = await supabase.rpc("save_workspace_doc", {
    p_kind: input.kind,
    p_doc_id: input.id,
    p_payload: input.payload,
    p_ord: input.ord,
    p_expected: input.expectedVersion,
    p_force: false,
    p_delete: false,
    p_mirror: null,
  });
  if (error) {
    if (!missingSaveRpc(error)) throw error;
    if (input.expectedVersion == null) {
      const { error: writeError } = await supabase.from("workspace_docs").upsert(
        {
          kind: input.kind,
          doc_id: input.id,
          payload: input.payload,
          version: 1,
          ord: input.ord,
          deleted_at: null,
        },
        { onConflict: "kind,doc_id", ignoreDuplicates: true },
      );
      if (writeError) throw writeError;
      return;
    }
    const { data: updated, error: writeError } = await supabase
      .from("workspace_docs")
      .update({ payload: input.payload })
      .eq("kind", input.kind)
      .eq("doc_id", input.id)
      .eq("version", input.expectedVersion)
      .select("version");
    if (writeError) throw writeError;
    if (!updated?.length) {
      throw new Error("A record changed while attachments were being moved. Reload before editing.");
    }
    return;
  }
  const result = (data || {}) as RpcResult;
  if (input.ignoreExists && result.conflict === "exists") return;
  if (result.forbidden || result.ok === false) {
    throw new Error(result.reason || "The document could not be saved.");
  }
}

async function importBlobDocs(payload: WorkspacePayload): Promise<void> {
  const docs = splitWorkspace(jsonSafe(payload));
  for (const doc of docs) {
    let stored = doc.payload;
    if (payloadHasFileBodies(stored)) {
      try {
        stored = await rewritePayloadFiles(doc.kind, doc.id, stored);
      } catch {
        stored = doc.payload;
      }
    }
    await writeWorkspaceDoc({
      kind: doc.kind,
      id: doc.id,
      payload: stored as Json,
      ord: doc.ord,
      expectedVersion: null,
      ignoreExists: true,
    });
  }
}

async function migrateFilePayloads(rows: StoredDoc[]): Promise<void> {
  for (const row of rows) {
    if (row.deleted || !payloadHasFileBodies(row.payload)) continue;
    const next = await rewritePayloadFiles(row.kind, row.id, row.payload);
    await writeWorkspaceDoc({
      kind: row.kind,
      id: row.id,
      payload: next,
      ord: row.ord,
      expectedVersion: row.version,
    });
    row.payload = next;
  }
}

async function migrateAttachmentTable(
  table: "rce_attachments" | "ce_attachments",
  kind: "rce" | "ce",
  ownerColumn: "rce_id" | "ce_id",
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .select("id, file_name, storage_path, mime_type, " + ownerColumn)
    .like("storage_path", "data:%");
  if (error) throw error;
  for (const row of data || []) {
    const record = row as unknown as Record<string, unknown>;
    const owner = String(record[ownerColumn] || "");
    const body = String(record.storage_path || "");
    if (!owner || !body.startsWith("data:")) continue;
    const path = await uploadOwnedFile(kind, owner, String(record.id || ""), {
      name: record.file_name,
      type: record.mime_type,
    }, body);
    const { error: updateError } = await supabase
      .from(table)
      .update({ storage_path: path })
      .eq("id", record.id as string);
    if (updateError) throw updateError;
  }
}

async function uploadOwnedFile(
  kind: string,
  owner: string,
  fileId: string,
  file: { name?: unknown; type?: unknown },
  dataUrl: string,
): Promise<string> {
  const wrapped = await rewritePayloadFiles(kind, owner, {
    attachmentFiles: [
      {
        id: fileId || crypto.randomUUID(),
        name: String(file.name || "file"),
        type: file.type == null ? "" : String(file.type),
        dataUrl,
      },
    ],
  } as Json);
  const list = (wrapped as { attachmentFiles?: Array<{ storagePath?: string }> }).attachmentFiles;
  const path = list?.[0]?.storagePath;
  if (!path) throw new Error("Could not store an existing attachment.");
  return path;
}

async function foldOifBlob(rows: StoredDoc[]): Promise<void> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "files:oif")
    .maybeSingle();
  if (error) throw error;
  const groups = asRecord(asRecord(data?.value).groups);
  const ids = Object.keys(groups);
  if (!ids.length) return;
  const remaining: Record<string, unknown> = {};
  for (const id of ids) {
    const pool = Array.isArray(groups[id]) ? (groups[id] as Array<Record<string, unknown>>) : [];
    const row = rows.find((item) => item.kind === "inspection" && item.id === id && !item.deleted);
    if (!row) {
      remaining[id] = groups[id];
      continue;
    }
    const payload = asRecord(row.payload);
    const photos = Array.isArray(payload.photos) ? payload.photos.map((file) => ({ ...(file as object) })) : [];
    let changed = false;
    for (const stored of pool) {
      const body = String(stored.storage_path || "");
      if (!body.startsWith("data:")) continue;
      const name = String(stored.file_name || "");
      const match = photos.find((file) => {
        const rec = file as Record<string, unknown>;
        return String(rec.name || "") === name && !fileBody(rec) && !rec.storagePath;
      }) as Record<string, unknown> | undefined;
      if (match) {
        match.dataUrl = body;
        match.url = body;
        changed = true;
      } else if (!photos.some((file) => String((file as Record<string, unknown>).name || "") === name)) {
        photos.push({
          id: crypto.randomUUID(),
          name,
          type: stored.mime_type || "",
          dataUrl: body,
          url: body,
        });
        changed = true;
      }
    }
    if (!changed && !payloadHasFileBodies(payload)) continue;
    const nextPayload = changed ? { ...payload, photos } : payload;
    const storedPayload = payloadHasFileBodies(nextPayload)
      ? await rewritePayloadFiles("inspection", id, nextPayload as Json)
      : (nextPayload as Json);
    try {
      await writeWorkspaceDoc({
        kind: "inspection",
        id,
        payload: storedPayload,
        ord: row.ord,
        expectedVersion: row.version,
      });
      row.payload = storedPayload;
    } catch {
      remaining[id] = groups[id];
    }
  }
  const { error: writeError } = await supabase.from("app_settings").upsert(
    {
      key: "files:oif",
      value: Object.keys(remaining).length ? { groups: remaining } : { migrated: true },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (writeError) throw writeError;
}

function cloneWorkspace(payload: WorkspacePayload): WorkspacePayload {
  return jsonSafe(payload);
}

function overlayUnmigrated(
  workspace: WorkspacePayload,
  blob: WorkspacePayload,
  revisions: RevisionMap,
): WorkspacePayload {
  const next = cloneWorkspace(workspace);
  const gone = (kind: string, id: string) => Boolean(revisions[docKey(kind, id)]?.deleted);
  const known = (kind: string, id: string) => Boolean(revisions[docKey(kind, id)]);

  if (!known("masterlist", "company") && blob.masterlist) {
    next.masterlist = blob.masterlist;
  }
  if (!known("admin", "company")) {
    const admin = (blob as { adminConfig?: Json }).adminConfig
      ?? asRecord(asRecord(blob.schemaConfig).__app).adminConfig;
    if (admin && typeof admin === "object") {
      (next as { adminConfig?: Json }).adminConfig = admin as Json;
    }
  }
  if (!known("schema", "company") && blob.schemaConfig) {
    next.schemaConfig = jsonSafe(blob.schemaConfig);
  }

  const ceIds = new Set((next.ceList || []).map((ce) => ce.id));
  for (const ce of blob.ceList || []) {
    if (!ce?.id || ceIds.has(ce.id) || gone("ce", ce.id)) continue;
    next.ceList = [...(next.ceList || []), ce];
    ceIds.add(ce.id);
    const doc = asRecord(blob.documents)[ce.id];
    if (doc && !asRecord(next.documents)[ce.id]) {
      next.documents = {
        ...asRecord(next.documents),
        [ce.id]: doc,
      } as WorkspacePayload["documents"];
    }
  }
  for (const [id, doc] of Object.entries(asRecord(blob.documents))) {
    if (gone("ce", id) || asRecord(next.documents)[id]) continue;
    next.documents = {
      ...asRecord(next.documents),
      [id]: doc,
    } as WorkspacePayload["documents"];
  }

  const rceIds = new Set(
    (next.rceList || []).map((rce) => String(asRecord(rce).id || asRecord(rce).rceNo || "")),
  );
  for (const rce of blob.rceList || []) {
    const id = String(asRecord(rce).id || asRecord(rce).rceNo || "");
    if (!id || rceIds.has(id) || gone("rce", id)) continue;
    next.rceList = [...(next.rceList || []), rce];
    rceIds.add(id);
  }

  const mergeList = (kind: string, key: "inspectionReports" | "taskTemplates" | "scopeTemplates") => {
    const current = Array.isArray((next as Record<string, unknown>)[key])
      ? ((next as Record<string, unknown>)[key] as Json[])
      : [];
    const incoming = Array.isArray((blob as Record<string, unknown>)[key])
      ? ((blob as Record<string, unknown>)[key] as Json[])
      : (Array.isArray(asRecord(asRecord(blob.schemaConfig).__app)[key])
        ? (asRecord(asRecord(blob.schemaConfig).__app)[key] as Json[])
        : []);
    const ids = new Set(current.map((item) => String(asRecord(item).id || "")));
    const merged = current.slice();
    for (const item of incoming) {
      const id = String(asRecord(item).id || asRecord(item).oifNo || "");
      if (!id || ids.has(id) || gone(kind, id)) continue;
      merged.push(item);
      ids.add(id);
    }
    (next as Record<string, unknown>)[key] = merged;
  };
  mergeList("inspection", "inspectionReports");
  mergeList("task", "taskTemplates");
  mergeList("scope", "scopeTemplates");

  const app = asRecord(asRecord(next.schemaConfig).__app);
  const blobApp = asRecord(asRecord(blob.schemaConfig).__app);
  if (!known("notifications", "company") && Array.isArray(blobApp.notifications)) {
    app.notifications = blobApp.notifications;
  }
  if (!known("wipes", "company") && Array.isArray(blobApp.dbWipeRequests)) {
    app.dbWipeRequests = blobApp.dbWipeRequests;
  }
  app.inspectionReports = (next as { inspectionReports?: Json[] }).inspectionReports || app.inspectionReports || [];
  app.taskTemplates = (next as { taskTemplates?: Json[] }).taskTemplates || app.taskTemplates || [];
  app.scopeTemplates = (next as { scopeTemplates?: Json[] }).scopeTemplates || app.scopeTemplates || [];
  if ((next as { adminConfig?: Json }).adminConfig) {
    app.adminConfig = (next as { adminConfig?: Json }).adminConfig as Json;
  }
  next.schemaConfig = { ...asRecord(next.schemaConfig), __app: app } as WorkspacePayload["schemaConfig"];
  return next;
}

async function rehydrateWorkspace(workspace: WorkspacePayload): Promise<string[]> {
  const errors: string[] = [];
  const documents = asRecord(workspace.documents);
  for (const [id, doc] of Object.entries(documents)) {
    const result = await rehydratePayloadFiles(doc as Json);
    documents[id] = result.payload;
    errors.push(...result.errors);
  }
  workspace.documents = documents as WorkspacePayload["documents"];

  const rces: WorkspacePayload["rceList"] = [];
  for (const rce of workspace.rceList || []) {
    const result = await rehydratePayloadFiles(rce as Json);
    rces.push(result.payload as WorkspacePayload["rceList"][number]);
    errors.push(...result.errors);
  }
  workspace.rceList = rces;

  const extras = workspace as WorkspacePayload & {
    inspectionReports?: Json[];
  };
  if (Array.isArray(extras.inspectionReports)) {
    const reports: Json[] = [];
    for (const report of extras.inspectionReports) {
      const result = await rehydratePayloadFiles(report);
      reports.push(result.payload);
      errors.push(...result.errors);
    }
    extras.inspectionReports = reports;
    const app = asRecord(asRecord(workspace.schemaConfig).__app);
    app.inspectionReports = reports;
    workspace.schemaConfig = {
      ...asRecord(workspace.schemaConfig),
      __app: app,
    } as WorkspacePayload["schemaConfig"];
  }
  if (errors.length) {
    await fillFromLegacyTables(workspace).catch((err: unknown) => {
      errors.push(err instanceof Error ? err.message : "Could not read a saved attachment.");
    });
  }
  return errors;
}

async function fillFromLegacyTables(workspace: WorkspacePayload): Promise<void> {
  const rceIds = (workspace.rceList || [])
    .map((rce) => String(asRecord(rce).id || asRecord(rce).rceNo || ""))
    .filter(Boolean);
  if (rceIds.length) {
    const { data, error } = await supabase
      .from("rce_attachments")
      .select("rce_id, file_name, storage_path, mime_type")
      .in("rce_id", rceIds);
    if (error) throw error;
    const byOwner = new Map<string, Array<Record<string, unknown>>>();
    for (const row of data || []) {
      const list = byOwner.get(String(row.rce_id || "")) || [];
      list.push(row as Record<string, unknown>);
      byOwner.set(String(row.rce_id || ""), list);
    }
    workspace.rceList = await Promise.all(
      (workspace.rceList || []).map(async (rce) => {
        const record = asRecord(rce);
        const pool = byOwner.get(String(record.id || record.rceNo || ""));
        if (!pool?.length) return rce;
        return {
          ...record,
          attachmentFiles: await fillPool(record.attachmentFiles, pool),
        } as unknown as WorkspacePayload["rceList"][number];
      }),
    );
  }
}

async function fillPool(list: unknown, pool: Array<Record<string, unknown>>): Promise<unknown> {
  if (!Array.isArray(list)) return list;
  const next = [];
  for (const file of list) {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      next.push(file);
      continue;
    }
    const rec = { ...(file as Record<string, unknown>) };
    if (fileBody(rec)) {
      next.push(rec);
      continue;
    }
    const name = String(rec.name || "");
    const index = pool.findIndex((row) => String(row.file_name || "") === name);
    if (index < 0) {
      next.push(rec);
      continue;
    }
    const row = pool.splice(index, 1)[0];
    const path = String(row.storage_path || "");
    if (path.startsWith("data:")) {
      rec.dataUrl = path;
      rec.url = path;
    } else if (path && !rec.storagePath) {
      try {
        const body = await downloadDataUrl(path);
        rec.storagePath = path;
        rec.dataUrl = body;
        rec.url = body;
        rec.stored = true;
      } catch {
        rec.storagePath = path;
      }
    }
    if (!rec.type && row.mime_type) rec.type = row.mime_type;
    next.push(rec);
  }
  return next;
}

async function idsMarkedDeleted(table: "cost_estimates" | "rce_requests"): Promise<Set<string>> {
  const res = await supabase.from(table).select("id, deleted_at").not("deleted_at", "is", null);
  if (res.error) return new Set();
  const ids = new Set<string>();
  for (const row of res.data || []) {
    const id = String((row as { id?: unknown }).id || "");
    if (id) ids.add(id);
  }
  return ids;
}

function withoutDeleted<T>(rows: T[] | undefined, hidden: Set<string>): T[] {
  return (rows || []).filter((row) => {
    const id = String((row as { id?: unknown })?.id || "");
    return !id || !hidden.has(id);
  });
}

export async function loadWorkspaceFromSupabase(): Promise<LoadResult> {
  await ensureSupabaseAccess();
  const warnings: string[] = [];
  const blobResult = await supabase
    .from("estimator_workspace")
    .select("ce_list, rce_list, masterlist, documents, schema_config")
    .eq("user_id", COMPANY_WORKSPACE_ID)
    .maybeSingle();
  if (blobResult.error) throw blobResult.error;
  const blobExists = Boolean(blobResult.data);
  const blob = rowToWorkspace((blobResult.data as WorkspaceRow | null) ?? null);

  let rows: StoredDoc[] = [];
  let blocked = false;
  try {
    rows = await readAllDocs();
  } catch (err) {
    if (!blobExists) throw explain(err as { message?: string });
    return {
      workspace: blob,
      revisions: {},
      blocked: true,
      warning: explain(err as { message?: string }).message,
    };
  }

  let marker = await readMarker();
  if (!marker.docs && blobExists) {
    try {
      await importBlobDocs(blob);
      rows = await readAllDocs();
      marker = { ...marker, docs: true };
      await writeMarker(marker);
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : "Could not copy existing records.");
      if (!rows.length) {
        try {
          rows = await readAllDocs();
        } catch {
          /* keep the snapshot copy below */
        }
      }
    }
  }

  if (!marker.files && rows.length) {
    try {
      await migrateFilePayloads(rows);
      await migrateAttachmentTable("rce_attachments", "rce", "rce_id");
      await migrateAttachmentTable("ce_attachments", "ce", "ce_id");
      await foldOifBlob(rows);
      marker = { ...marker, files: true };
      await writeMarker(marker);
      rows = await readAllDocs();
    } catch (err) {
      warnings.push(
        err instanceof Error
          ? err.message
          : "Could not move existing attachments into storage.",
      );
    }
  }

  const hasServerData = blobExists || rows.length > 0;
  const assembled = rows.length
    ? assembleWorkspace(rows, blankWorkspace())
    : {
        workspace: hasServerData ? blankWorkspace() : defaultWorkspace(),
        revisions: {} as RevisionMap,
      };
  let workspace = assembled.workspace;
  const revisions = assembled.revisions;
  if (blobExists && !marker.docs) {
    workspace = overlayUnmigrated(workspace, blob, revisions);
  }

  const masterKey = docKey("masterlist", "company");
  if (!revisions[masterKey] && masterlistRowCount(workspace.masterlist) === 0) {
    const restored = await restoreMasterlistFromTables().catch(() => null);
    if (restored) workspace.masterlist = restored;
  }
  const hasRceRevision = Object.keys(revisions).some((key) => key.startsWith("rce:"));
  if (!workspace.rceList.length && !hasRceRevision && !marker.docs) {
    const first = await supabase.from("rce_requests").select("id, payload, deleted_at");
    const fallback =
      first.error && /deleted_at/i.test(first.error.message)
        ? await supabase.from("rce_requests").select("id, payload")
        : first;
    const { data: rces, error } = fallback;
    if (error) warnings.push(error.message);
    else if (rces?.length) {
      workspace.rceList = rces
        .filter((row) => !(row as { deleted_at?: string | null }).deleted_at)
        .map((row) => {
        const payload = asRecord(row.payload);
        return { ...payload, id: String(payload.id || row.id) } as WorkspacePayload["rceList"][number];
      });
    }
  }

  const hiddenCe = await idsMarkedDeleted("cost_estimates");
  const hiddenRce = await idsMarkedDeleted("rce_requests");
  if (hiddenCe.size || hiddenRce.size) {
    workspace = {
      ...workspace,
      ceList: withoutDeleted(workspace.ceList, hiddenCe),
      rceList: withoutDeleted(workspace.rceList, hiddenRce),
      documents: Object.fromEntries(
        Object.entries(workspace.documents || {}).filter(([id]) => !hiddenCe.has(id)),
      ),
    };
  }

  const fileErrors = await rehydrateWorkspace(workspace);
  warnings.push(...fileErrors);
  return {
    workspace,
    revisions,
    blocked,
    warning: warnings.length
      ? `Some saved files could not be moved or opened. Records are still here. ${warnings[0]}`
      : undefined,
  };
}

type SaveOptions = {
  revisions: RevisionMap;
  force?: string[];
  canWriteAdmin?: boolean;
  /** False while hydrating so a local backup cannot delete server documents. */
  tombstones?: boolean;
};

type RpcResult = {
  ok?: boolean;
  skipped?: boolean;
  forbidden?: boolean;
  reason?: string;
  conflict?: "version" | "deleted" | "exists";
  version?: number;
};

function rceMirror(payload: Json): Json {
  const rce = asRecord(payload);
  const id = String(rce.id || rce.rceNo || "");
  return {
    company_name: asText(rce.company),
    client: asText(rce.client || rce.customer),
    customer: asText(rce.customer),
    address: asText(rce.address),
    location: asText(rce.location),
    description: asText(rce.description || rce.projectTitle),
    category: asText(rce.category),
    project_type: asText(rce.projectType),
    project_title: asText(rce.projectTitle || rce.description),
    inquiry_number: asText(rce.inquiryNumber),
    inquiry_date: asDate(rce.inquiryDate),
    rce_no: asText(rce.rceNo || id),
    rce_date: asDate(rce.rceDate),
    priority_level: asText(rce.priorityLevel),
    ce_deadline: asDate(rce.ceDeadline),
    submission_deadline: asDate(rce.submissionDeadline),
    shopwork: Boolean(rce.shopwork),
    onsite: Boolean(rce.onsite),
    trading: Boolean(rce.trading),
    mechanical: Boolean(rce.mechanical),
    electrical: Boolean(rce.electrical),
    other_remarks: asText(rce.otherRemarks),
    decline_reason: asText(rce.declineReason),
    prepared_by: asText(rce.preparedBy),
    reviewed_by: asText(rce.reviewedBy),
    approved_by: asText(rce.approvedBy),
    status: String(rce.status || "Pending"),
    date_received: asDate(rce.dateReceived || rce.rceDate),
    payload,
  } as Json;
}

function ceMirror(payload: Json, rceIds: Set<string>): Json | null {
  const body = asRecord(payload);
  const summary = asRecord(body.summary);
  if (!summary.id) return null;
  const document = body.document && typeof body.document === "object" ? asRecord(body.document) : null;
  const rceId = String(summary.rceId || "");
  const estimate = {
    rce_id: rceId && rceIds.has(rceId) ? rceId : null,
    client: asText(summary.client),
    location: asText(summary.location),
    project: asText(summary.project),
    status: String(summary.status || "Draft"),
    last_edited: asDate(summary.lastEdited),
    last_edited_by: asText(summary.lastEditedBy),
  };
  if (!document) return { estimate } as unknown as Json;
  return {
    estimate,
    document: {
      meta: document.meta ?? {},
      sow_text: String(document.sowText || ""),
      ce_status: asText(document.ceStatus || document.status),
      view_type: asText(document.viewType),
      doc_no: asText(document.docNo),
      rev_no: asText(document.revNo),
      rev_date: asDate(document.revDate),
      file_attachments: document.fileAttachments ?? {},
      summary_task_filters: document.summaryTaskFilters ?? {},
      document,
    },
  } as unknown as Json;
}

async function callSaveDoc(
  write: { kind: string; id: string; payload: Json; ord: number; expectedVersion: number | null; force: boolean },
  mirror: Json | null,
  doDelete: boolean,
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("save_workspace_doc", {
    p_kind: write.kind,
    p_doc_id: write.id,
    p_payload: doDelete ? {} : write.payload,
    p_ord: write.ord,
    p_expected: write.expectedVersion,
    p_force: write.force,
    p_delete: doDelete,
    p_mirror: mirror,
  });
  if (error) throw explain(error);
  return (data || {}) as RpcResult;
}

async function syncAttachmentRows(kind: string, id: string, payload: Json): Promise<void> {
  const files = listStoredFiles(payload);
  if (kind === "rce") {
    const { data, error } = await supabase
      .from("rce_attachments")
      .select("id, storage_path")
      .eq("rce_id", id);
    if (error) throw error;
    const existing = data || [];
    const wanted = new Set(files.map((file) => file.storagePath));
    const have = new Set(existing.map((row) => String(row.storage_path || "")));
    const remove = existing.filter((row) => {
      const path = String(row.storage_path || "");
      if (!path || path.startsWith("data:")) return false;
      return !wanted.has(path);
    });
    if (remove.length) {
      const { error: deleteError } = await supabase
        .from("rce_attachments")
        .delete()
        .in("id", remove.map((row) => row.id));
      if (deleteError) throw deleteError;
    }
    const insert = files.filter((file) => !have.has(file.storagePath));
    if (insert.length) {
      const { error: insertError } = await supabase.from("rce_attachments").insert(
        insert.map((file) => ({
          id: crypto.randomUUID(),
          rce_id: id,
          file_name: file.name,
          storage_path: file.storagePath,
          mime_type: file.mime,
          file_size: file.size,
        })),
      );
      if (insertError) throw insertError;
    }
    return;
  }
  if (kind !== "ce") return;
  const { data, error } = await supabase
    .from("ce_attachments")
    .select("id, storage_path")
    .eq("ce_id", id);
  if (error) throw error;
  const existing = data || [];
  const wanted = new Set(files.map((file) => file.storagePath));
  const have = new Set(existing.map((row) => String(row.storage_path || "")));
  const remove = existing.filter((row) => {
    const path = String(row.storage_path || "");
    if (!path || path.startsWith("data:")) return false;
    return !wanted.has(path);
  });
  if (remove.length) {
    const { error: deleteError } = await supabase
      .from("ce_attachments")
      .delete()
      .in("id", remove.map((row) => row.id));
    if (deleteError) throw deleteError;
  }
  const insert = files.filter((file) => !have.has(file.storagePath));
  if (insert.length) {
    const { error: insertError } = await supabase.from("ce_attachments").insert(
      insert.map((file) => ({
        id: crypto.randomUUID(),
        ce_id: id,
        sheet_key: file.sheet,
        file_name: file.name,
        storage_path: file.storagePath,
        mime_type: file.mime,
      })),
    );
    if (insertError) throw insertError;
  }
}

async function syncSecondary(
  kind: string,
  id: string,
  payload: Json,
  masterlist: MasterlistState | null,
): Promise<void> {
  if (kind === "masterlist" && masterlist) {
    await syncClients(masterlist.clients);
    await syncMasterlist(masterlist);
    return;
  }
  if (kind === "ce" || kind === "rce" || kind === "inspection") {
    await syncAttachmentRows(kind, id, payload);
  }
}

function remember(
  revisions: RevisionMap,
  kind: string,
  id: string,
  version: number,
  hash: string,
  synced: boolean,
  deleted = false,
) {
  revisions[docKey(kind, id)] = { version, hash: deleted ? "" : hash, synced, deleted };
}

/** Server counter. Null means the SQL function is not applied yet and the caller uses the local format. */
export async function allocateDocNumber(kind: string, company: string, year: number): Promise<string | null> {
  await ensureSupabaseAccess();
  const { data, error } = await supabase.rpc("next_doc_no", {
    p_kind: kind,
    p_company: company || "",
    p_year: year,
  });
  if (error) {
    if (missingDocNumberRpc(error)) return null;
    throw error;
  }
  return typeof data === "string" && data ? data : null;
}

export async function saveWorkspaceToSupabase(
  payload: WorkspacePayload,
  options: SaveOptions,
): Promise<RevisionMap> {
  await ensureSupabaseAccess();
  const revisions: RevisionMap = { ...(options?.revisions || {}) };
  const force = new Set(options?.force || []);
  const hold = new Set<string>();
  if (!options?.canWriteAdmin) hold.add("admin");
  let local;
  try {
    local = splitWorkspace(jsonSafe(payload));
  } catch (err) {
    if (err instanceof WorkspaceSaveError) {
      err.revisions = revisions;
      throw err;
    }
    throw err;
  }
  const plan = planSave(local, revisions, force, hold, options?.tombstones !== false);
  const kindOrder: Record<string, number> = { rce: 0, masterlist: 1, ce: 2 };
  plan.writes.sort(
    (a, b) => (kindOrder[a.kind] ?? 5) - (kindOrder[b.kind] ?? 5),
  );
  const conflicts: Array<{ kind: string; id: string; reason: "version" | "deleted" | "exists" }> = [];
  const rceIds = new Set(
    local.filter((doc) => doc.kind === "rce").map((doc) => doc.id),
  );
  let secondaryError: string | null = null;

  const finishWrite = async (write: PlannedWrite, stored: Json) => {
    try {
      await syncSecondary(
        write.kind,
        write.id,
        stored,
        write.kind === "masterlist" ? (stored as unknown as MasterlistState) : null,
      );
      remember(revisions, write.kind, write.id, revisions[docKey(write.kind, write.id)]?.version || write.expectedVersion || 1, write.hash, true);
    } catch (err) {
      secondaryError = err instanceof Error ? err.message : "A related update failed.";
      remember(
        revisions,
        write.kind,
        write.id,
        revisions[docKey(write.kind, write.id)]?.version || write.expectedVersion || 1,
        write.hash,
        false,
      );
    }
  };

  for (const write of plan.writes) {
    let stored = write.payload;
    try {
      if (payloadHasFileBodies(stored)) {
        stored = await rewritePayloadFiles(write.kind, write.id, stored);
      }
    } catch (err) {
      throw explain(err as { message?: string });
    }
    if (write.touchOnly) {
      remember(revisions, write.kind, write.id, write.expectedVersion || 1, write.hash, false);
      await finishWrite({ ...write, payload: stored }, stored);
      continue;
    }
    const mirror = write.kind === "rce"
      ? rceMirror(stored)
      : write.kind === "ce"
        ? ceMirror(stored, rceIds)
        : null;
    let result: RpcResult;
    try {
      result = await callSaveDoc(
        { ...write, payload: stored, expectedVersion: write.expectedVersion },
        mirror,
        false,
      );
    } catch (err) {
      if (conflicts.length || secondaryError) {
        throw new WorkspaceSaveError(
          err instanceof Error ? err.message : "The save failed. Your changes are still here.",
          conflicts,
          revisions,
        );
      }
      throw err;
    }
    if (result.skipped) {
      const current = revisions[docKey(write.kind, write.id)];
      if (current) remember(revisions, write.kind, write.id, current.version, current.hash, true);
      continue;
    }
    if (result.forbidden) {
      throw new WorkspaceSaveError(
        result.reason || "You cannot save that change.",
        conflicts,
        revisions,
      );
    }
    if (!result.ok || result.conflict) {
      const reason = result.conflict === "deleted"
        ? "deleted"
        : result.conflict === "exists"
          ? "exists"
          : "version";
      conflicts.push({
        kind: write.kind,
        id: write.id,
        reason,
      });
      continue;
    }
    const version = Number(result.version) || (write.expectedVersion || 0) + 1;
    remember(revisions, write.kind, write.id, version, write.hash, false);
    await finishWrite({ ...write, payload: stored, expectedVersion: version }, stored);
  }

  for (const tomb of plan.tombstones) {
    let result: RpcResult;
    try {
      result = await callSaveDoc(
        {
          kind: tomb.kind,
          id: tomb.id,
          payload: {},
          ord: 0,
          expectedVersion: tomb.expectedVersion,
          force: tomb.force,
        },
        null,
        true,
      );
    } catch (err) {
      throw new WorkspaceSaveError(
        err instanceof Error ? err.message : "Could not keep a deleted record deleted. Your changes are still here.",
        conflicts,
        revisions,
      );
    }
    if (!result.ok || result.conflict) {
      conflicts.push({
        kind: tomb.kind,
        id: tomb.id,
        reason: result.conflict === "deleted" ? "deleted" : "version",
      });
      continue;
    }
    remember(revisions, tomb.kind, tomb.id, Number(result.version) || tomb.expectedVersion + 1, "", true, true);
  }

  if (conflicts.length) {
    const exists = conflicts.some((item) => item.reason === "exists");
    throw new WorkspaceSaveError(
      exists
        ? "That document number already exists. Reload and create it again."
        : "This was changed by someone else — Reload / Keep mine",
      conflicts,
      revisions,
    );
  }
  if (secondaryError) {
    throw new WorkspaceSaveError(
      `Could not finish saving (${secondaryError}). Your changes are still here.`,
      [],
      revisions,
    );
  }
  return revisions;
}

async function syncClients(clients: Json[]): Promise<void> {
  if (!clients?.length) return;
  const rows = clients.map((raw) => {
    const item = asRecord(raw);
    return {
      id: String(item.id || ""),
      client_code: asText(item.clientCode),
      full_name: String(item.fullName || ""),
      address: asText(item.address),
      extra: item,
    };
  }).filter((row) => row.id);
  if (!rows.length) return;
  const { error } = await supabase.from("clients").upsert(rows, { onConflict: "id" });
  throwIf(error);
}

async function syncMasterlist(masterlist: MasterlistState): Promise<void> {
  const custom = Array.isArray(masterlist.customCategories) ? masterlist.customCategories : [];
  if (custom.length) {
    const { error } = await supabase.from("masterlist_categories").upsert(
      custom.map((raw, index) => {
        const cat = asRecord(raw);
        const key = String(cat.categoryKey || cat.id || `custom-${index}`);
        return {
          id: String(cat.id || key),
          category_key: key,
          category_name: String(cat.categoryName || key),
          is_fixed: false,
          sort_order: 100 + index,
        };
      }),
      { onConflict: "id" },
    );
    throwIf(error);
  }
  const groups: Array<[string, Json[]]> = [
    ["manpower", masterlist.manpower],
    ["equipment", masterlist.equipment],
    ["consumables", masterlist.consumables],
    ["ppe", masterlist.ppe],
    ["misc", masterlist.misc],
  ];
  for (const cat of custom) {
    const record = asRecord(cat);
    const key = String(record.categoryKey || "");
    if (!key) continue;
    groups.push([key, Array.isArray(record.items) ? (record.items as Json[]) : []]);
  }
  const rows = groups.flatMap(([categoryKey, items]) =>
    (items || []).map((raw) => {
      const item = asRecord(raw);
      const id = String(item.id || "");
      if (!id) return null;
      return {
        id,
        category_key: categoryKey,
        name: asText(item.name),
        role: asText(item.role),
        description: asText(item.description),
        item: asText(item.item),
        unit: asText(item.unit),
        daily_rate: asNumber(item.dailyRate),
        monthly_rate: asNumber(item.monthlyRate),
        rate_per_day: asNumber(item.ratePerDay),
        unit_cost: asNumber(item.unitCost),
        estimated_cost: asNumber(item.estimatedCost),
        per_diem: asNumber(item.perDiem),
        allowance: asNumber(item.allowance),
        attrs: item,
      };
    }).filter((row) => row !== null),
  );
  if (!rows.length) return;
  const { error } = await supabase.from("masterlist_items").upsert(rows, { onConflict: "id" });
  throwIf(error);
}
