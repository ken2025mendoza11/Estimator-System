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
import { loadAccountAccess, markWelcomeSeen, type AccountAccess } from "@/lib/supabase/account-role";
import { getSignInOptions } from "@/lib/auth/sign-in-options";
import { supabaseConfigError } from "@/lib/supabase/client";
import { ensureSupabaseAccess } from "@/lib/supabase/session";
import { AccessGate, WelcomeTour } from "@/components/AccessScreens";
import CostEstimatorApp from "@/components/CostEstimatorApp";
import { clearSaveError, isSigningOut, readSaveError, writeSaveError } from "@/lib/estimator/clientSession";
import { dropReadOnlyDirtyKeys } from "@/lib/estimator/viewOnlySave";

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
    profileComplete: true,
    welcomeSeen: true,
    duplicate: false,
  });
  const [accountRefresh, setAccountRefresh] = useState(0);
  const [testDeployment, setTestDeployment] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload>(() => defaultWorkspace());
  const [bootKey, setBootKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // A stored save error is read per user once the account is known (Step 24).
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
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
            clearSaveError(typeof sessionStorage === "undefined" ? null : sessionStorage);
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
                    clearSaveError(typeof sessionStorage === "undefined" ? null : sessionStorage);
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

  // Step 24: a different account (or none) starts with a clean save state.
  const lastUserRef = useRef("");
  useEffect(() => {
    if (lastUserRef.current === signedInId) return;
    const switched = lastUserRef.current !== "";
    lastUserRef.current = signedInId;
    if (timer.current) clearTimeout(timer.current);
    if (switched) {
      dirty.current = false;
      dirtyKeys.current = [];
      revisions.current = {};
      hydrated.current = false;
      conflictKeys.current = [];
      setConflictOpen(false);
      setSaveState("idle");
    }
    let stored: string | null = null;
    try {
      stored = signedInId ? readSaveError(sessionStorage, signedInId) : null;
    } catch {
      stored = null;
    }
    setSaveNotice(stored);
  }, [signedInId]);

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
        if (row.status !== "active" || row.profileComplete === false) {
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
  }, [signedInId, signedInName, isPending, accountRefresh]);

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
        // Never push a stale local copy of an estimate the server holds as sealed.
        const keys = dropReadOnlyDirtyKeys(data, local?.dirtyKeys || []);
        const chosen = stamp(jsonSafe(keepUploaded(data, local?.payload || null, keys)));
        latest.current = chosen;
        dirtyKeys.current = dropReadOnlyDirtyKeys(data, changedDocKeys(data, chosen));
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
    (next: WorkspacePayload, options?: { baseline?: boolean }) => {
      const safe = stamp(jsonSafe(next));
      if (options?.baseline) {
        // Step 25: the app's normalised first state is not an edit. Keep any
        // unsaved keys from load, mark nothing new as dirty, save nothing new.
        latest.current = safe;
        writeBackup(userIdRef.current, safe, dirtyKeys.current, revisions.current);
        return;
      }
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
      if (!dirty.current || isSigningOut()) return;
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
          if (isSigningOut()) return;
          try {
            writeSaveError(sessionStorage, userIdRef.current, message);
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

  if (account.status !== "active" || account.profileComplete === false) {
    return <AccessGate account={account} onChanged={() => setAccountRefresh((value) => value + 1)} />;
  }

  return (
    <>
      {(conflictOpen || saveNotice) && (
        <div role="alert" className="ce-save-banner">
          {conflictOpen ? (
            <span>
              This was changed by someone else —{" "}
              <button type="button" className="ce-save-banner-btn" onClick={reloadServer}>
                Reload
              </button>
              {" / "}
              <button type="button" className="ce-save-banner-btn" onClick={keepMine}>
                Keep mine
              </button>
            </span>
          ) : (
            <span>{saveNotice}</span>
          )}
        </div>
      )}
      {account.welcomeSeen === false ? (
        <WelcomeTour
          onDone={() => {
            markWelcomeSeen().finally(() => {
              setAccount((prev) => ({ ...prev, welcomeSeen: true }));
            });
          }}
        />
      ) : null}
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
