import { supabase, COMPANY_WORKSPACE_ID } from "@/lib/supabase/client";
import {
  defaultWorkspace,
  emptyMasterlist,
  jsonSafe,
  parseJson,
  type Json,
  type MasterlistState,
  type WorkspacePayload,
} from "./defaults";

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

function fileBody(file: Record<string, unknown>): string {
  const body = String(file.dataUrl || file.url || "");
  return body.startsWith("data:") ? body : "";
}

function withFileBody(file: Record<string, unknown>, body: string): Json {
  return { ...file, dataUrl: body, url: body } as Json;
}

function mapFileList(list: unknown, visit: (file: Record<string, unknown>) => Json): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((file) => {
    if (!file || typeof file !== "object" || Array.isArray(file)) return file;
    return visit(file as Record<string, unknown>);
  });
}

function normalizeFiles(payload: WorkspacePayload): WorkspacePayload {
  const next = jsonSafe(payload);
  next.rceList = (next.rceList || []).map((raw) => {
    const rce = asRecord(raw);
    return {
      ...rce,
      attachmentFiles: mapFileList(rce.attachmentFiles, (file) => {
        const body = fileBody(file);
        return body ? withFileBody(file, body) : (file as Json);
      }),
    } as unknown as WorkspacePayload["rceList"][number];
  });
  const documents = asRecord(next.documents);
  for (const [ceId, raw] of Object.entries(documents)) {
    const doc = asRecord(raw);
    const bags = asRecord(doc.fileAttachments);
    const fileAttachments: Record<string, unknown> = {};
    for (const [sheet, list] of Object.entries(bags)) {
      fileAttachments[sheet] = mapFileList(list, (file) => {
        const body = fileBody(file);
        return body ? withFileBody(file, body) : (file as Json);
      });
    }
    documents[ceId] = { ...doc, fileAttachments };
  }
  next.documents = documents as WorkspacePayload["documents"];
  const schema = asRecord(next.schemaConfig);
  const app = asRecord(schema.__app);
  if (Array.isArray(app.inspectionReports)) {
    app.inspectionReports = app.inspectionReports.map((raw) => {
      const report = asRecord(raw);
      return {
        ...report,
        photos: mapFileList(report.photos, (file) => {
          const body = fileBody(file);
          return body ? withFileBody(file, body) : (file as Json);
        }),
      };
    });
    schema.__app = app;
    next.schemaConfig = schema as WorkspacePayload["schemaConfig"];
  }
  return next;
}

function stripFileBodies(payload: WorkspacePayload): WorkspacePayload {
  const next = jsonSafe(payload);
  const strip = (file: Record<string, unknown>): Json => {
    const copy = { ...file };
    if (fileBody(file)) {
      delete copy.dataUrl;
      delete copy.url;
      copy.stored = true;
    }
    return copy as Json;
  };
  next.rceList = (next.rceList || []).map((raw) => {
    const rce = asRecord(raw);
    return {
      ...rce,
      attachmentFiles: mapFileList(rce.attachmentFiles, strip),
    } as unknown as WorkspacePayload["rceList"][number];
  });
  const documents = asRecord(next.documents);
  for (const [ceId, raw] of Object.entries(documents)) {
    const doc = asRecord(raw);
    const bags = asRecord(doc.fileAttachments);
    const fileAttachments: Record<string, unknown> = {};
    for (const [sheet, list] of Object.entries(bags)) {
      fileAttachments[sheet] = mapFileList(list, strip);
    }
    documents[ceId] = { ...doc, fileAttachments };
  }
  next.documents = documents as WorkspacePayload["documents"];
  return next;
}

function needsBody(list: unknown): boolean {
  if (!Array.isArray(list)) return false;
  return list.some((file) => {
    if (!file || typeof file !== "object" || Array.isArray(file)) return false;
    const rec = file as Record<string, unknown>;
    return !fileBody(rec) && Boolean(rec.name || rec.stored);
  });
}

type StoredHit = { file_name: string; storage_path: string; mime_type?: string | null };

function fillMissingBodies(list: unknown, pool: StoredHit[]): unknown {
  return mapFileList(list, (file) => {
    if (fileBody(file)) return file as Json;
    const name = String(file.name || "");
    const index = pool.findIndex(
      (row) => row.file_name === name && String(row.storage_path || "").startsWith("data:"),
    );
    if (index < 0) return file as Json;
    const row = pool.splice(index, 1)[0];
    const next = withFileBody(file, row.storage_path);
    if (!file.type && row.mime_type) {
      (next as Record<string, unknown>).type = row.mime_type;
    }
    return next;
  });
}

async function rehydrateFiles(payload: WorkspacePayload): Promise<void> {
  const rceIds = (payload.rceList || [])
    .map((raw) => asRecord(raw))
    .filter((rce) => needsBody(rce.attachmentFiles))
    .map((rce) => String(rce.id || rce.rceNo || ""))
    .filter(Boolean);
  if (rceIds.length) {
    const { data } = await supabase
      .from("rce_attachments")
      .select("rce_id, file_name, storage_path, mime_type")
      .in("rce_id", rceIds);
    const byOwner = new Map<string, StoredHit[]>();
    for (const row of data || []) {
      const id = String(row.rce_id || "");
      const list = byOwner.get(id) || [];
      list.push(row as StoredHit);
      byOwner.set(id, list);
    }
    payload.rceList = (payload.rceList || []).map((raw) => {
      const rce = asRecord(raw);
      const id = String(rce.id || rce.rceNo || "");
      const pool = byOwner.get(id);
      if (!pool?.length) return raw;
      return {
        ...rce,
        attachmentFiles: fillMissingBodies(rce.attachmentFiles, pool),
      } as unknown as WorkspacePayload["rceList"][number];
    });
  }

  const documents = asRecord(payload.documents);
  const ceIds = Object.entries(documents)
    .filter(([, raw]) => {
      const bags = asRecord(asRecord(raw).fileAttachments);
      return Object.values(bags).some((list) => needsBody(list));
    })
    .map(([ceId]) => ceId);
  if (ceIds.length) {
    const { data } = await supabase
      .from("ce_attachments")
      .select("ce_id, sheet_key, file_name, storage_path, mime_type")
      .in("ce_id", ceIds);
    const byOwner = new Map<string, Map<string, StoredHit[]>>();
    for (const row of data || []) {
      const ceId = String(row.ce_id || "");
      const sheet = String(row.sheet_key || "");
      const sheets = byOwner.get(ceId) || new Map<string, StoredHit[]>();
      const list = sheets.get(sheet) || [];
      list.push(row as StoredHit);
      sheets.set(sheet, list);
      byOwner.set(ceId, sheets);
    }
    const documents = asRecord(payload.documents);
    for (const [ceId, raw] of Object.entries(documents)) {
      const sheets = byOwner.get(ceId);
      if (!sheets) continue;
      const doc = asRecord(raw);
      const bags = asRecord(doc.fileAttachments);
      const fileAttachments: Record<string, unknown> = { ...bags };
      for (const [sheet, pool] of sheets) {
        fileAttachments[sheet] = fillMissingBodies(bags[sheet], pool);
      }
      documents[ceId] = { ...doc, fileAttachments };
    }
    payload.documents = documents as WorkspacePayload["documents"];
  }

  const schema = asRecord(payload.schemaConfig);
  const app = asRecord(schema.__app);
  const reports = Array.isArray(app.inspectionReports) ? app.inspectionReports : [];
  const missingOif = reports.some((raw) => {
    const photos = asRecord(raw).photos;
    return Array.isArray(photos) && photos.some((file) => {
      if (!file || typeof file !== "object") return false;
      return !fileBody(file as Record<string, unknown>);
    });
  });
  if (missingOif) {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "files:oif")
      .maybeSingle();
    const stored = asRecord(data?.value);
    const groups = asRecord(stored.groups);
    app.inspectionReports = reports.map((raw) => {
      const report = asRecord(raw);
      const id = String(report.id || report.oifNo || "");
      const pool = Array.isArray(groups[id]) ? (groups[id] as StoredHit[]) : [];
      if (!pool.length) return raw;
      return { ...report, photos: fillMissingBodies(report.photos, pool.slice()) };
    });
    schema.__app = app;
    payload.schemaConfig = schema as WorkspacePayload["schemaConfig"];
  }
}

async function syncStoredFiles(data: WorkspacePayload): Promise<void> {
  const rceIds = (data.rceList || [])
    .map((raw) => String(asRecord(raw).id || asRecord(raw).rceNo || ""))
    .filter(Boolean);
  if (rceIds.length) {
    const rows = (data.rceList || []).flatMap((raw) => {
      const rce = asRecord(raw);
      const rceId = String(rce.id || rce.rceNo || "");
      const files = Array.isArray(rce.attachmentFiles) ? rce.attachmentFiles : [];
      return files.flatMap((file) => {
        if (!file || typeof file !== "object") return [];
        const rec = file as Record<string, unknown>;
        const body = fileBody(rec);
        if (!rceId || !body) return [];
        return [
          {
            id: crypto.randomUUID(),
            rce_id: rceId,
            file_name: String(rec.name || "file"),
            storage_path: body,
            mime_type: asText(rec.type),
            file_size: asNumber(rec.size),
          },
        ];
      });
    });
    await supabase.from("rce_attachments").delete().in("rce_id", rceIds);
    if (rows.length) {
      const { error } = await supabase.from("rce_attachments").insert(rows);
      if (error) throw error;
    }
  }

  const documents = asRecord(data.documents);
  const knownCe = new Set(
    (data.ceList || []).map((ce) => ce.id).filter((id): id is string => Boolean(id)),
  );
  const ceIds = Object.keys(documents).filter((id) => knownCe.has(id));
  if (ceIds.length) {
    const rows = ceIds.flatMap((ceId) => {
      const bags = asRecord(asRecord(documents[ceId]).fileAttachments);
      return Object.entries(bags).flatMap(([sheet, list]) => {
        if (!Array.isArray(list)) return [];
        return list.flatMap((file) => {
          if (!file || typeof file !== "object") return [];
          const rec = file as Record<string, unknown>;
          const body = fileBody(rec);
          if (!body) return [];
          return [
            {
              id: crypto.randomUUID(),
              ce_id: ceId,
              sheet_key: sheet,
              file_name: String(rec.name || "file"),
              storage_path: body,
              mime_type: asText(rec.type),
            },
          ];
        });
      });
    });
    await supabase.from("ce_attachments").delete().in("ce_id", ceIds);
    if (rows.length) {
      const { error } = await supabase.from("ce_attachments").insert(rows);
      if (error) throw error;
    }
  }

  const schema = asRecord(data.schemaConfig);
  const app = asRecord(schema.__app);
  const reports = Array.isArray(app.inspectionReports) ? app.inspectionReports : [];
  const groups: Record<string, StoredHit[]> = {};
  for (const raw of reports) {
    const report = asRecord(raw);
    const id = String(report.id || report.oifNo || "");
    if (!id || !Array.isArray(report.photos)) continue;
    const files = report.photos.flatMap((file) => {
      if (!file || typeof file !== "object") return [];
      const rec = file as Record<string, unknown>;
      const body = fileBody(rec);
      if (!body) return [];
      return [{ file_name: String(rec.name || "photo"), storage_path: body, mime_type: asText(rec.type) }];
    });
    if (files.length) groups[id] = files;
  }
  if (Object.keys(groups).length) {
    await supabase.from("app_settings").upsert(
      {
        key: "files:oif",
        value: { groups },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  }
}

async function upsertWorkspace(data: WorkspacePayload): Promise<void> {
  const { error } = await supabase.from("estimator_workspace").upsert(
    {
      user_id: COMPANY_WORKSPACE_ID,
      ce_list: data.ceList,
      rce_list: data.rceList,
      masterlist: data.masterlist,
      documents: data.documents,
      schema_config: data.schemaConfig,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function loadWorkspaceFromSupabase(): Promise<WorkspacePayload> {
  const { data, error } = await supabase
    .from("estimator_workspace")
    .select("ce_list, rce_list, masterlist, documents, schema_config")
    .eq("user_id", COMPANY_WORKSPACE_ID)
    .maybeSingle();

  if (error) throw error;
  const workspace = normalizeFiles(rowToWorkspace((data as WorkspaceRow | null) ?? null));
  if (masterlistRowCount(workspace.masterlist) === 0) {
    const restored = await restoreMasterlistFromTables().catch(() => null);
    if (restored) workspace.masterlist = restored;
  }
  if (!workspace.rceList.length) {
    const { data: rces } = await supabase
      .from("rce_requests")
      .select("id, payload");
    if (rces?.length) {
      workspace.rceList = rces.map((row) => {
        const payload = asRecord(row.payload);
        return { ...payload, id: String(payload.id || row.id) } as WorkspacePayload["rceList"][number];
      });
    }
  }
  await rehydrateFiles(workspace).catch(() => undefined);
  return workspace;
}

export async function saveWorkspaceToSupabase(payload: WorkspacePayload): Promise<void> {
  const data = normalizeFiles(payload);
  try {
    await upsertWorkspace(data);
  } catch {
    const slim = stripFileBodies(data);
    await upsertWorkspace(slim);
    await syncNormalizedTables(slim).catch(() => undefined);
    await syncStoredFiles(data).catch(() => undefined);
    return;
  }
  await syncNormalizedTables(data).catch(() => undefined);
  await syncStoredFiles(data).catch(() => undefined);
}

async function syncNormalizedTables(data: WorkspacePayload): Promise<void> {
  await syncClients(data.masterlist.clients);
  await syncMasterlist(data.masterlist);
  await syncRces(data.rceList);
  const rceIds = new Set(
    data.rceList.map((rce) => rce.id).filter((id): id is string => Boolean(id)),
  );
  await syncEstimates(data.ceList, data.documents, rceIds);
  await supabase.from("app_settings").upsert(
    {
      key: "db_schema_config",
      value: data.schemaConfig ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

async function syncClients(clients: Json[]): Promise<void> {
  if (!clients.length) return;
  const rows = clients.map((raw) => {
    const item = asRecord(raw);
    return {
      id: String(item.id || crypto.randomUUID()),
      client_code: asText(item.clientCode),
      full_name: String(item.fullName || ""),
      address: asText(item.address),
      extra: item,
    };
  });
  await supabase.from("clients").upsert(rows, { onConflict: "id" });
}

async function syncMasterlist(masterlist: MasterlistState): Promise<void> {
  const custom = Array.isArray(masterlist.customCategories)
    ? masterlist.customCategories
    : [];
  if (custom.length) {
    await supabase.from("masterlist_categories").upsert(
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
      return {
        id: String(item.id || crypto.randomUUID()),
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
    }),
  );
  if (rows.length) {
    await supabase.from("masterlist_items").upsert(rows, { onConflict: "id" });
  }
}

async function syncRces(list: WorkspacePayload["rceList"]): Promise<void> {
  if (!list.length) return;
  const rows = list.map((raw) => {
    const rce = asRecord(raw);
    const id = String(rce.id || rce.rceNo || crypto.randomUUID());
    return {
      id,
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
      payload: rce,
    };
  });
  await supabase.from("rce_requests").upsert(rows, { onConflict: "id" });
}

async function syncEstimates(
  list: WorkspacePayload["ceList"],
  documents: WorkspacePayload["documents"],
  rceIds: Set<string>,
): Promise<void> {
  if (!list.length) return;
  const estimates = list.map((ce) => ({
    id: ce.id,
    rce_id: ce.rceId && rceIds.has(ce.rceId) ? ce.rceId : null,
    client: ce.client || null,
    location: ce.location || null,
    project: ce.project || null,
    status: ce.status || "Draft",
    last_edited: ce.lastEdited || null,
    last_edited_by: ce.lastEditedBy || null,
  }));
  await supabase.from("cost_estimates").upsert(estimates, { onConflict: "id" });

  const docs = Object.entries(documents || {}).map(([ceId, raw]) => {
    const doc = asRecord(raw);
    return {
      ce_id: ceId,
      meta: doc.meta ?? {},
      sow_text: String(doc.sowText || ""),
      ce_status: asText(doc.ceStatus || doc.status),
      view_type: asText(doc.viewType),
      doc_no: asText(doc.docNo),
      rev_no: asText(doc.revNo),
      rev_date: asText(doc.revDate),
      file_attachments: doc.fileAttachments ?? {},
      summary_task_filters: doc.summaryTaskFilters ?? {},
      document: doc,
    };
  });
  if (docs.length) {
    await supabase.from("ce_documents").upsert(docs, { onConflict: "ce_id" });
  }
}
