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

export async function loadWorkspaceFromSupabase(): Promise<WorkspacePayload> {
  const { data, error } = await supabase
    .from("estimator_workspace")
    .select("ce_list, rce_list, masterlist, documents, schema_config")
    .eq("user_id", COMPANY_WORKSPACE_ID)
    .maybeSingle();

  if (error) throw error;
  return rowToWorkspace((data as WorkspaceRow | null) ?? null);
}

export async function saveWorkspaceToSupabase(payload: WorkspacePayload): Promise<void> {
  const data = jsonSafe(payload);

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

  await syncNormalizedTables(data).catch(() => undefined);
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
      inquiry_date: asText(rce.inquiryDate),
      rce_no: asText(rce.rceNo || id),
      rce_date: asText(rce.rceDate),
      priority_level: asText(rce.priorityLevel),
      ce_deadline: asText(rce.ceDeadline),
      submission_deadline: asText(rce.submissionDeadline),
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
      date_received: asText(rce.dateReceived || rce.rceDate),
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
