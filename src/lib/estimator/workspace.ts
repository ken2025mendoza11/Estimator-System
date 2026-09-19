import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  defaultWorkspace,
  emptyMasterlist,
  jsonSafe,
  parseJson,
  type MasterlistState,
  type WorkspacePayload,
} from "./defaults";

export type { WorkspacePayload };

type WorkspaceRow = {
  ce_list: unknown;
  rce_list: unknown;
  masterlist: unknown;
  documents: unknown;
  schema_config: unknown;
};

function rowToWorkspace(row: WorkspaceRow | undefined): WorkspacePayload {
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

function asJson(value: unknown): string {
  return JSON.stringify(jsonSafe(value ?? null));
}

export const loadWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<WorkspacePayload> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<WorkspaceRow>`
      select ce_list, rce_list, masterlist, documents, schema_config
      from estimator_workspace
      where user_id = ${context.userId}
      limit 1
    `;
    return rowToWorkspace(rows[0]);
  });

export const saveWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: WorkspacePayload): WorkspacePayload => {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid workspace");
    }
    const fallback = defaultWorkspace();
    return jsonSafe({
      ceList: Array.isArray(data.ceList) ? data.ceList : fallback.ceList,
      rceList: Array.isArray(data.rceList) ? data.rceList : fallback.rceList,
      masterlist: {
        ...emptyMasterlist(),
        ...(data.masterlist && typeof data.masterlist === "object"
          ? data.masterlist
          : {}),
      },
      documents:
        data.documents && typeof data.documents === "object" ? data.documents : {},
      schemaConfig:
        data.schemaConfig && typeof data.schemaConfig === "object"
          ? data.schemaConfig
          : {},
    });
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into estimator_workspace (
        user_id, ce_list, rce_list, masterlist, documents, schema_config, updated_at
      ) values (
        ${context.userId},
        ${asJson(data.ceList)}::jsonb,
        ${asJson(data.rceList)}::jsonb,
        ${asJson(data.masterlist)}::jsonb,
        ${asJson(data.documents)}::jsonb,
        ${asJson(data.schemaConfig)}::jsonb,
        now()
      )
      on conflict (user_id) do update set
        ce_list = excluded.ce_list,
        rce_list = excluded.rce_list,
        masterlist = excluded.masterlist,
        documents = excluded.documents,
        schema_config = excluded.schema_config,
        updated_at = now()
    `;
    return { ok: true as const };
  });
