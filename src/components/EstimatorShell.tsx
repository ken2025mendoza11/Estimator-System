import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { SaveState, WorkspacePayload } from "@/lib/estimator/defaults";
import { defaultWorkspace, jsonSafe } from "@/lib/estimator/defaults";
import {
  loadWorkspaceFromSupabase,
  saveWorkspaceToSupabase,
} from "@/lib/estimator/supabase-workspace";
import { docKey, changedDocKeys, mergeServerWithDirty, revisionsForDirtyPush, WorkspaceSaveError, type RevisionMap } from "@/lib/estimator/workspace-docs";
import { loadAccountAccess, type AccountAccess } from "@/lib/supabase/account-role";
import { getSignInOptions } from "@/lib/auth/sign-in-options";
import { supabaseConfigError } from "@/lib/supabase/client";
import { ensureSupabaseAccess } from "@/lib/supabase/session";
import CostEstimatorApp from "@/components/CostEstimatorApp";

const LEGACY_BACKUP_KEY = "estimator-workspace-backup";

function backupKey(userId: string) {
  return `estimator-workspace-backup:${userId}`;
}

type BackupFile = {
  at: number;
  userId: string;
  payload: WorkspacePayload;
  dirtyKeys: string[];
  revisions: RevisionMap;
};

function readBackup(userId: string): BackupFile | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(backupKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      at?: number;
      userId?: string;
      payload?: WorkspacePayload;
      dirtyKeys?: unknown;
      revisions?: RevisionMap;
    };
    if (!parsed?.payload || typeof parsed.payload !== "object") return null;
    if (parsed.userId && parsed.userId !== userId) return null;
    const dirtyKeys = Array.isArray(parsed.dirtyKeys)
      ? parsed.dirtyKeys.filter((key): key is string => typeof key === "string")
      : [];
    const revisions = parsed.revisions && typeof parsed.revisions === "object" ? parsed.revisions : {};
    return { at: Number(parsed.at) || 0, userId, payload: parsed.payload, dirtyKeys, revisions };
  } catch {
    return null;
  }
}

function writeBackup(userId: string, payload: WorkspacePayload, dirtyKeys: string[], revisions: RevisionMap) {
  if (!userId) return;
  try {
    localStorage.setItem(
      backupKey(userId),
      JSON.stringify({ at: Date.now(), userId, payload, dirtyKeys, revisions }),
    );
  } catch {
    /* quota — keep the in-memory copy */
  }
}

function clearBackup(userId: string) {
  try {
    if (userId) localStorage.removeItem(backupKey(userId));
    localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch {
    /* private mode */
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

function keepUploaded(
  server: WorkspacePayload,
  local: WorkspacePayload | null,
  dirtyKeys: string[],
): WorkspacePayload {
  return mergeServerWithDirty(server, local, dirtyKeys);
}

export function EstimatorShell({ mobileView = null }: { mobileView?: { kind: string; id: string } | null }) {
  const { user: currentUser, isPending } = useCurrentUserState();
  const [account, setAccount] = useState<AccountAccess>({
    userId: "",
    role: "staff",
    name: "",
    status: "active",
    note: "",
  });
  const [testDeployment, setTestDeployment] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload>(() => defaultWorkspace());
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
  const dirtyKeys = useRef<string[]>([]);
  const userIdRef = useRef("");
  const wasSignedIn = useRef(false);
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

  const write = useCallback((payload: WorkspacePayload, allowTombstones = true) => {
    latest.current = payload;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = latest.current;
      if (saveBlocked.current) {
        setSaveState("error");
        setSaveNotice(
          "The database is missing the document-save update. Run supabase/apply-v2.sql in the Supabase SQL editor. Your changes are still here.",
        );
        return;
      }
      setSaveState("saving");
      const attempt = (target: WorkspacePayload, allowRetry: boolean) => {
        saveWorkspaceToSupabase(target, {
          revisions: revisions.current,
          canWriteAdmin: accountRef.current.role === "admin",
          tombstones: allowTombstones,
        })
          .then((next) => {
            revisions.current = next;
            if (latest.current !== target) return;
            dirty.current = false;
            dirtyKeys.current = [];
            writeBackup(userIdRef.current, target, [], next);
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
                  tombstones: allowTombstones,
                })
                  .then((next) => {
                    revisions.current = next;
                    if (latest.current !== retry) return;
                    dirty.current = false;
                    dirtyKeys.current = [];
                    writeBackup(userIdRef.current, retry, [], next);
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

  const signedInId = currentUser?.id ?? "";
  const signedInName = currentUser?.displayName || currentUser?.primaryEmail || "";

  useEffect(() => {
    if (signedInId) {
      wasSignedIn.current = true;
      userIdRef.current = signedInId;
      return;
    }
    if (!wasSignedIn.current) return;
    clearBackup(userIdRef.current);
    dirtyKeys.current = [];
    wasSignedIn.current = false;
    userIdRef.current = "";
  }, [signedInId]);

  useEffect(() => {
    if (!signedInId) {
      setTestDeployment(false);
      return;
    }
    let cancelled = false;
    getSignInOptions()
      .then((options) => {
        if (!cancelled) setTestDeployment(Boolean(options.testLogin));
      })
      .catch(() => {
        if (!cancelled) setTestDeployment(false);
      });
    return () => {
      cancelled = true;
    };
  }, [signedInId]);

  useEffect(() => {
    if (supabaseConfigError || isPending || !signedInId) return;
    let cancelled = false;
    ensureSupabaseAccess()
      .then(() => loadAccountAccess({ name: signedInName }))
      .then((row) => {
        if (cancelled) return;
        setAccount(row);
        if (row.status !== "active") {
          setSessionReady(false);
          setReady(true);
          return;
        }
        setSessionError(null);
        setSessionReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionReady(false);
        setSessionError(
          err instanceof Error ? err.message : "Could not open the database session.",
        );
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedInId, signedInName, isPending]);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    loadWorkspaceFromSupabase()
      .then((loaded) => {
        if (cancelled) return;
        revisions.current = loaded.revisions;
        saveBlocked.current = Boolean(loaded.blocked);
        clearBackup("");
        const data = loaded.workspace;
        const local = readBackup(signedInId);
        const keys = local?.dirtyKeys || [];
        const chosen = stamp(jsonSafe(keepUploaded(data, local?.payload || null, keys)));
        latest.current = chosen;
        dirtyKeys.current = changedDocKeys(data, chosen);
        revisions.current = revisionsForDirtyPush(loaded.revisions, local?.revisions, dirtyKeys.current);
        userIdRef.current = signedInId;
        writeBackup(signedInId, chosen, dirtyKeys.current, revisions.current);
        hydrated.current = true;
        if (loaded.warning) {
          setSaveState("error");
          setSaveNotice(loaded.warning);
        }
        if (!loaded.blocked && dirtyKeys.current.length) {
          dirty.current = true;
          write(chosen, false);
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
  }, [write, sessionReady, signedInId]);

  const persist = useCallback(
    (next: WorkspacePayload) => {
      const safe = stamp(jsonSafe(next));
      const keys = changedDocKeys(latest.current, safe);
      for (const key of keys) {
        if (!dirtyKeys.current.includes(key)) dirtyKeys.current.push(key);
      }
      latest.current = safe;
      if (!hydrated.current) {
        writeBackup(userIdRef.current, safe, dirtyKeys.current, revisions.current);
        return;
      }
      dirty.current = dirtyKeys.current.length > 0;
      writeBackup(userIdRef.current, safe, dirtyKeys.current, revisions.current);
      if (dirty.current) write(safe);
    },
    [write],
  );

  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      writeBackup(userIdRef.current, latest.current, dirtyKeys.current, revisions.current);
      void saveWorkspaceToSupabase(latest.current, {
        revisions: revisions.current,
        canWriteAdmin: accountRef.current.role === "admin",
      })
        .then((next) => {
          revisions.current = next;
          dirty.current = false;
          dirtyKeys.current = [];
          writeBackup(userIdRef.current, latest.current, [], next);
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

  // Offline-first (conservative): every change is already written to the local
  // backup first. When the browser comes back online, push any unsaved change
  // through the normal per-document save (same revisions / conflict handling).
  const conflictOpenRef = useRef(false);
  conflictOpenRef.current = conflictOpen;
  useEffect(() => {
    const onOnline = () => {
      if (!hydrated.current || !dirty.current || conflictOpenRef.current) return;
      write(latest.current);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [write]);

  const reloadServer = useCallback(() => {
    setSaveState("saving");
    loadWorkspaceFromSupabase()
      .then((loaded) => {
        revisions.current = loaded.revisions;
        saveBlocked.current = Boolean(loaded.blocked);
        const next = stamp(jsonSafe(loaded.workspace));
        latest.current = next;
        dirtyKeys.current = [];
        writeBackup(userIdRef.current, next, [], revisions.current);
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

  if (!supabaseConfigError && !sessionError && !isPending && !currentUser) {
    return <Navigate to="/login" />;
  }

  if (supabaseConfigError || sessionError || (!isPending && !currentUser)) {
    const message =
      supabaseConfigError ||
      sessionError ||
      "Sign in to open the estimator.";
    return (
      <div className="ce-app" style={{ padding: "2rem", maxWidth: "40rem" }}>
        <p className="wiz-hint">{message}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="ce-app" style={{ padding: "2rem" }}>
        <p className="wiz-hint">Loading saved database…</p>
      </div>
    );
  }

  if (account.status !== "active") {
    const heading = account.status === "pending"
      ? "Waiting for admin approval"
      : "This account cannot open the estimator";
    const copy = account.note
      || (account.status === "pending"
        ? "An administrator has to grant your role before any records are loaded."
        : account.status === "declined"
          ? "An administrator declined this account."
          : "An administrator disabled this account.");
    return (
      <main className="ce-app ce-login">
        <div className="ce-login-card">
          <p className="ce-login-kicker">Estimator System</p>
          <h1 className="ce-serif ce-login-title">{heading}</h1>
          <p className="ce-login-copy">{copy}</p>
        </div>
      </main>
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
      mobileView={mobileView}
      currentUserName={
        currentUser?.displayName ?? currentUser?.primaryEmail ?? "Estimator"
      }
      accountUserId={account.userId}
      accountRole={account.role}
      accountName={account.name}
      testDeployment={testDeployment}
    />
    </>
  );
}
