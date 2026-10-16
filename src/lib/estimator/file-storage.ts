import type { Json } from "./defaults";
import { supabase } from "@/lib/supabase/client";

export const FILE_BUCKET = "estimator-files";

const FILE_LIST_KEYS = new Set(["attachmentFiles", "photos"]);

export function fileBody(file: Record<string, unknown>): string {
  const body = String(file.dataUrl || file.url || "");
  return body.startsWith("data:") ? body : "";
}

export function payloadHasFileBodies(value: unknown): boolean {
  let found = false;
  walkFileLists(value, (list) => {
    for (const file of list) {
      if (!file || typeof file !== "object" || Array.isArray(file)) continue;
      if (fileBody(file as Record<string, unknown>)) found = true;
    }
    return list;
  });
  return found;
}

function walkFileLists(
  value: unknown,
  mapList: (list: unknown[], sheet: string | null) => unknown[],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => walkFileLists(item, mapList));
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (key === "fileAttachments" && inner && typeof inner === "object" && !Array.isArray(inner)) {
      const bags: Record<string, unknown> = {};
      for (const [sheet, list] of Object.entries(inner as Record<string, unknown>)) {
        bags[sheet] = Array.isArray(list) ? mapList(list, sheet) : list;
      }
      out[key] = bags;
      continue;
    }
    if (FILE_LIST_KEYS.has(key) && Array.isArray(inner)) {
      out[key] = mapList(inner, null);
      continue;
    }
    out[key] = walkFileLists(inner, mapList);
  }
  return out;
}

async function walkFileListsAsync(
  value: unknown,
  mapList: (list: unknown[], sheet: string | null) => Promise<unknown[]>,
): Promise<unknown> {
  if (Array.isArray(value)) {
    const next = [];
    for (const item of value) next.push(await walkFileListsAsync(item, mapList));
    return next;
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (key === "fileAttachments" && inner && typeof inner === "object" && !Array.isArray(inner)) {
      const bags: Record<string, unknown> = {};
      for (const [sheet, list] of Object.entries(inner as Record<string, unknown>)) {
        bags[sheet] = Array.isArray(list) ? await mapList(list, sheet) : list;
      }
      out[key] = bags;
      continue;
    }
    if (FILE_LIST_KEYS.has(key) && Array.isArray(inner)) {
      out[key] = await mapList(inner, null);
      continue;
    }
    out[key] = await walkFileListsAsync(inner, mapList);
  }
  return out;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  const mime = /data:([^;,]+)/i.exec(header)?.[1] || "application/octet-stream";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), mime };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const size = 0x2000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${btoa(binary)}`;
}

function storageId(file: Record<string, unknown>): string {
  const raw = String(file.id || "").trim();
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
  return safe || crypto.randomUUID();
}

export async function uploadDataUrl(
  kind: string,
  docId: string,
  file: Record<string, unknown>,
  dataUrl: string,
): Promise<string> {
  const existing = typeof file.storagePath === "string" ? file.storagePath : "";
  if (existing && !existing.startsWith("data:")) return existing;
  const path = `${kind}/${docId}/${storageId(file)}`;
  const { blob, mime } = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, blob, {
    contentType: String(file.type || mime || "application/octet-stream"),
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function downloadDataUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(FILE_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message || "Attachment is missing from storage.");
  }
  return blobToDataUrl(data);
}

export async function rewritePayloadFiles(
  kind: string,
  docId: string,
  payload: Json,
): Promise<Json> {
  const next = await walkFileListsAsync(payload, async (list) => {
    const out: unknown[] = [];
    for (const file of list) {
      if (!file || typeof file !== "object" || Array.isArray(file)) {
        out.push(file);
        continue;
      }
      const rec = { ...(file as Record<string, unknown>) };
      const body = fileBody(rec);
      let storagePath =
        typeof rec.storagePath === "string" && !rec.storagePath.startsWith("data:")
          ? rec.storagePath
          : "";
      if (!storagePath && body) {
        if (!rec.id) rec.id = crypto.randomUUID();
        storagePath = await uploadDataUrl(kind, docId, rec, body);
      }
      if (storagePath) {
        rec.storagePath = storagePath;
        rec.stored = true;
        delete rec.dataUrl;
        delete rec.url;
      }
      out.push(rec);
    }
    return out;
  });
  return next as Json;
}

export type StoredFileRef = {
  name: string;
  storagePath: string;
  mime: string | null;
  size: number | null;
  sheet: string | null;
};

export function listStoredFiles(payload: unknown): StoredFileRef[] {
  const found: StoredFileRef[] = [];
  walkFileLists(payload, (list, sheet) => {
    for (const file of list) {
      if (!file || typeof file !== "object" || Array.isArray(file)) continue;
      const rec = file as Record<string, unknown>;
      const storagePath = typeof rec.storagePath === "string" ? rec.storagePath : "";
      if (!storagePath || storagePath.startsWith("data:")) continue;
      const size = Number(rec.size);
      found.push({
        name: String(rec.name || "file"),
        storagePath,
        mime: rec.type == null ? null : String(rec.type),
        size: Number.isFinite(size) ? size : null,
        sheet,
      });
    }
    return list;
  });
  return found;
}

export async function rehydratePayloadFiles(
  payload: Json,
): Promise<{ payload: Json; errors: string[] }> {
  const errors: string[] = [];
  const next = await walkFileListsAsync(payload, async (list) => {
    const out: unknown[] = [];
    for (const file of list) {
      if (!file || typeof file !== "object" || Array.isArray(file)) {
        out.push(file);
        continue;
      }
      const rec = { ...(file as Record<string, unknown>) };
      if (fileBody(rec)) {
        out.push(rec);
        continue;
      }
      const storagePath = typeof rec.storagePath === "string" ? rec.storagePath : "";
      if (!storagePath || storagePath.startsWith("data:")) {
        out.push(rec);
        continue;
      }
      try {
        const body = await downloadDataUrl(storagePath);
        rec.dataUrl = body;
        rec.url = body;
        rec.stored = true;
      } catch (err) {
        errors.push(
          err instanceof Error ? err.message : "Could not download an attachment.",
        );
      }
      out.push(rec);
    }
    return out;
  });
  return { payload: next as Json, errors };
}
