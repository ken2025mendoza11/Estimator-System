import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { MasterlistState, SaveState, WorkspacePayload } from "@/lib/estimator/defaults";
import { defaultWorkspace, jsonSafe } from "@/lib/estimator/defaults";
import {
  loadWorkspaceFromSupabase,
  saveWorkspaceToSupabase,
} from "@/lib/estimator/supabase-workspace";
import { docKey, WorkspaceSaveError, type RevisionMap } from "@/lib/estimator/workspace-docs";
import { loadAccountAccess, type AccountAccess } from "@/lib/supabase/account-role";
import { supabase } from "@/lib/supabase/client";
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
  const [account, setAccount] = useState<AccountAccess>({
    userId: "",
    role: "staff",
    name: "",
  });
  const [workspace, setWorkspace] = useState<WorkspacePayload>(
    () => readBackup()?.payload || defaultWorkspace(),
  );
  const [bootKey, setBootKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveNotice, setSaveNotice] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("estimator-save-error");
    } catch {
      return null;
    }
  });
  const [conflictOpen, setConflictOpen] = useState(false);
  const latest = useRef<WorkspacePayload>(workspace);
  const revisions = useRef<RevisionMap>({});
  const conflictKeys = useRef<string[]>([]);
  const saveBlocked = useRef(false);
  const hydrated = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const accountRef = useRef(account);
  accountRef.current = account;

  const noteFailure = useCallback((err: unknown, body: WorkspacePayload) => {
    if (err instanceof WorkspaceSaveError) revisions.current = err.revisions;
    if (latest.current !== body) return;
    dirty.current = true;
    setSaveState("error");
    if (err instanceof WorkspaceSaveError && err.conflicts.length) {
      conflictKeys.current = err.conflicts.map((item) => docKey(item.kind, item.id));
      setConflictOpen(true);
      setSaveNotice(null);
      return;
    }
    setConflictOpen(false);
    const message = err instanceof Error ? err.message : "Could not save. Your changes are still here.";
    setSaveNotice(message);
  }, []);

  const write = useCallback((payload: WorkspacePayload) => {
    latest.current = payload;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = latest.current;
      if (saveBlocked.current) {
        setSaveState("error");
        setSaveNotice(
          "The database is missing the document-save update. Run supabase/0003_document_safety.sql in the Supabase SQL editor. Your changes are still here.",
        );
        return;
      }
      setSaveState("saving");
      const attempt = (target: WorkspacePayload, allowRetry: boolean) => {
        saveWorkspaceToSupabase(target, {
          revisions: revisions.current,
          canWriteAdmin: accountRef.current.role === "admin",
        })
          .then((next) => {
            revisions.current = next;
            if (latest.current !== target) return;
            dirty.current = false;
            setConflictOpen(false);
            setSaveNotice(null);
            setSaveState("saved");
            try { sessionStorage.removeItem("estimator-save-error"); } catch { /* ignore */ }
          })
          .catch((err) => {
            const conflict = err instanceof WorkspaceSaveError && err.conflicts.length > 0;
            if (allowRetry && !conflict) {
              window.setTimeout(() => {
                const retry = latest.current;
                saveWorkspaceToSupabase(retry, {
                  revisions: revisions.current,
                  canWriteAdmin: accountRef.current.role === "admin",
                })
                  .then((next) => {
                    revisions.current = next;
                    if (latest.current !== retry) return;
                    dirty.current = false;
                    setConflictOpen(false);
                    setSaveNotice(null);
                    setSaveState("saved");
                    try { sessionStorage.removeItem("estimator-save-error"); } catch { /* ignore */ }
                  })
                  .catch((retryErr) => noteFailure(retryErr, retry));
              }, 700);
              return;
            }
            noteFailure(err, target);
          });
      };
      attempt(body, true);
    }, 80);
  }, [noteFailure]);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      loadAccountAccess().then((row) => {
        if (!cancelled) setAccount(row);
      });
    };
    pull();
    const { data } = supabase.auth.onAuthStateChange(() => {
      pull();
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWorkspaceFromSupabase()
      .then((loaded) => {
        if (cancelled) return;
        revisions.current = loaded.revisions;
        saveBlocked.current = Boolean(loaded.blocked);
        const data = loaded.workspace;
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
        if (loaded.warning) {
          setSaveState("error");
          setSaveNotice(loaded.warning);
        }
        if (
          !loaded.blocked &&
          (localNewer || masterlistRows(chosen.masterlist) !== masterlistRows(data.masterlist))
        ) {
          dirty.current = true;
          write(chosen);
        }
        setWorkspace(chosen);
        setBootKey((n) => n + 1);
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        hydrated.current = true;
        dirty.current = true;
        setSaveState("error");
        setSaveNotice(
          err instanceof Error
            ? err.message
            : "Could not load saved records. Your changes are still here.",
        );
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
      void saveWorkspaceToSupabase(latest.current, {
        revisions: revisions.current,
        canWriteAdmin: accountRef.current.role === "admin",
      })
        .then((next) => {
          revisions.current = next;
          dirty.current = false;
        })
        .catch((err) => {
          if (err instanceof WorkspaceSaveError) revisions.current = err.revisions;
          dirty.current = true;
          const message = err instanceof Error
            ? err.message
            : "Could not save. Your changes are still here.";
          try {
            sessionStorage.setItem("estimator-save-error", message);
          } catch {
            /* private mode */
          }
        });
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

  const reloadServer = useCallback(() => {
    setSaveState("saving");
    loadWorkspaceFromSupabase()
      .then((loaded) => {
        revisions.current = loaded.revisions;
        saveBlocked.current = Boolean(loaded.blocked);
        const next = stamp(jsonSafe(loaded.workspace));
        latest.current = next;
        writeBackup(next);
        dirty.current = false;
        setConflictOpen(false);
        setSaveNotice(loaded.warning || null);
        setSaveState(loaded.warning ? "error" : "saved");
        setWorkspace(next);
        setBootKey((key) => key + 1);
      })
      .catch((err) => noteFailure(err, latest.current));
  }, [noteFailure]);

  const keepMine = useCallback(() => {
    const body = latest.current;
    setSaveState("saving");
    saveWorkspaceToSupabase(body, {
      revisions: revisions.current,
      force: conflictKeys.current,
      canWriteAdmin: accountRef.current.role === "admin",
    })
      .then((next) => {
        revisions.current = next;
        if (latest.current !== body) return;
        dirty.current = false;
        setConflictOpen(false);
        setSaveNotice(null);
        setSaveState("saved");
      })
      .catch((err) => noteFailure(err, body));
  }, [noteFailure]);

  if (!ready) {
    return (
      <div className="ce-app" style={{ padding: "2rem" }}>
        <p className="wiz-hint">Loading saved database…</p>
      </div>
    );
  }

  return (
    <>
      {(conflictOpen || saveNotice) && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10000,
            background: "#7f1d1d",
            color: "#fff",
            padding: "10px 16px",
            textAlign: "center",
            font: "14px/1.4 system-ui, sans-serif",
          }}
        >
          {conflictOpen ? (
            <span>
              This was changed by someone else —{" "}
              <button type="button" onClick={reloadServer} style={{ font: "inherit", color: "#fff" }}>
                Reload
              </button>
              {" / "}
              <button type="button" onClick={keepMine} style={{ font: "inherit", color: "#fff" }}>
                Keep mine
              </button>
            </span>
          ) : (
            <span>{saveNotice}</span>
          )}
        </div>
      )}
      <CostEstimatorApp
      key={bootKey}
      initialWorkspace={workspace}
      onPersist={persist}
      saveState={saveState}
      currentUserName={
        currentUser?.displayName ?? currentUser?.primaryEmail ?? "Estimator"
      }
      accountUserId={account.userId}
      accountRole={account.role}
      accountName={account.name}
    />
    </>
  );
}
