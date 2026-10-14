import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { MasterlistState, SaveState, WorkspacePayload } from "@/lib/estimator/defaults";
import { defaultWorkspace, jsonSafe } from "@/lib/estimator/defaults";
import {
  loadWorkspaceFromSupabase,
  saveWorkspaceToSupabase,
} from "@/lib/estimator/supabase-workspace";
import CostEstimatorApp from "@/components/CostEstimatorApp";

const BACKUP_KEY = "estimator-workspace-backup";

function readBackup(): { at: number; payload: WorkspacePayload } | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; payload?: WorkspacePayload };
    if (!parsed?.payload || typeof parsed.payload !== "object") return null;
    return { at: Number(parsed.at) || 0, payload: parsed.payload };
  } catch {
    return null;
  }
}

function writeBackup(payload: WorkspacePayload) {
  try {
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ at: Date.now(), payload }),
    );
  } catch {
    /* quota — keep the in-memory copy */
  }
}

function stamp(payload: WorkspacePayload): WorkspacePayload {
  const schema =
    payload.schemaConfig && typeof payload.schemaConfig === "object"
      ? (payload.schemaConfig as Record<string, unknown>)
      : {};
  const app =
    schema.__app && typeof schema.__app === "object"
      ? (schema.__app as Record<string, unknown>)
      : {};
  return {
    ...payload,
    schemaConfig: {
      ...schema,
      __app: { ...app, savedAt: new Date().toISOString() },
    },
  };
}

function masterlistRows(ml: MasterlistState | undefined): number {
  if (!ml) return 0;
  let total = 0;
  (["manpower", "equipment", "consumables", "ppe", "misc", "clients"] as const).forEach(
    (key) => {
      if (Array.isArray(ml[key])) total += ml[key].length;
    },
  );
  (ml.customCategories || []).forEach((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const items = (raw as { items?: unknown }).items;
    if (Array.isArray(items)) total += items.length;
  });
  return total;
}

function keepUploaded(primary: WorkspacePayload, secondary: WorkspacePayload | null): WorkspacePayload {
  if (!secondary) return primary;
  const sheets = ["manpower", "equipment", "consumables", "ppe", "misc", "clients"] as const;
  const masterlist = {
    ...(secondary.masterlist || {}),
    ...(primary.masterlist || {}),
  } as MasterlistState;
  sheets.forEach((key) => {
    const primaryRows = Array.isArray(primary.masterlist?.[key]) ? primary.masterlist[key] : [];
    const secondaryRows = Array.isArray(secondary.masterlist?.[key]) ? secondary.masterlist[key] : [];
    masterlist[key] = primaryRows.length ? primaryRows : secondaryRows;
  });
  const primaryCustom = primary.masterlist?.customCategories || [];
  const secondaryCustom = secondary.masterlist?.customCategories || [];
  masterlist.customCategories = primaryCustom.length ? primaryCustom : secondaryCustom;
  return {
    ...secondary,
    ...primary,
    masterlist,
    rceList: (primary.rceList || []).length ? primary.rceList : secondary.rceList || [],
    ceList: (primary.ceList || []).length ? primary.ceList : secondary.ceList || [],
    documents: { ...(secondary.documents || {}), ...(primary.documents || {}) },
    schemaConfig: { ...(secondary.schemaConfig || {}), ...(primary.schemaConfig || {}) },
  };
}

export function EstimatorShell() {
  const currentUser = useCurrentUser();
  const [workspace, setWorkspace] = useState<WorkspacePayload>(
    () => readBackup()?.payload || defaultWorkspace(),
  );
  const [bootKey, setBootKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const latest = useRef<WorkspacePayload>(workspace);
  const hydrated = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const write = useCallback((payload: WorkspacePayload) => {
    latest.current = payload;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = latest.current;
      setSaveState("saving");
      const mark = (ok: boolean) => {
        if (latest.current !== body) return;
        dirty.current = !ok;
        setSaveState(ok ? "saved" : "error");
      };
      saveWorkspaceToSupabase(body)
        .then(() => mark(true))
        .catch(() => {
          window.setTimeout(() => {
            const retry = latest.current;
            saveWorkspaceToSupabase(retry)
              .then(() => {
                if (latest.current === retry) {
                  dirty.current = false;
                  setSaveState("saved");
                }
              })
              .catch(() => mark(false));
          }, 700);
        });
    }, 80);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWorkspaceFromSupabase()
      .then((data) => {
        if (cancelled) return;
        const local = readBackup();
        const remoteAt = Date.parse(
          String(
            (data?.schemaConfig as { __app?: { savedAt?: string } } | undefined)
              ?.__app?.savedAt || "",
          ),
        ) || 0;
        const localAt = local?.at || 0;
        const localNewer = !!(local && localAt > remoteAt + 1500);
        const newer = localNewer ? local.payload : data;
        const older = localNewer ? data : local?.payload || null;
        const chosen = stamp(jsonSafe(keepUploaded(newer, older)));
        latest.current = chosen;
        writeBackup(chosen);
        hydrated.current = true;
        if (localNewer || masterlistRows(chosen.masterlist) !== masterlistRows(data.masterlist)) {
          dirty.current = true;
          write(chosen);
        }
        setWorkspace(chosen);
        setBootKey((n) => n + 1);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        hydrated.current = true;
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [write]);

  const persist = useCallback(
    (next: WorkspacePayload) => {
      const safe = stamp(jsonSafe(next));
      latest.current = safe;
      if (!hydrated.current) {
        writeBackup(safe);
        return;
      }
      dirty.current = true;
      writeBackup(safe);
      write(safe);
    },
    [write],
  );

  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      writeBackup(latest.current);
      void saveWorkspaceToSupabase(latest.current).catch(() => undefined);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!ready) {
    return (
      <div className="ce-app" style={{ padding: "2rem" }}>
        <p className="wiz-hint">Loading saved database…</p>
      </div>
    );
  }

  return (
    <CostEstimatorApp
      key={bootKey}
      initialWorkspace={workspace}
      onPersist={persist}
      saveState={saveState}
      currentUserName={
        currentUser?.displayName ?? currentUser?.primaryEmail ?? "Estimator"
      }
    />
  );
}
