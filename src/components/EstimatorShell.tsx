import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { WorkspacePayload } from "@/lib/estimator/defaults";
import { defaultWorkspace, jsonSafe } from "@/lib/estimator/defaults";
import {
  loadWorkspaceFromSupabase,
  saveWorkspaceToSupabase,
} from "@/lib/estimator/supabase-workspace";
import CostEstimatorApp from "@/components/CostEstimatorApp";

export function EstimatorShell() {
  const currentUser = useCurrentUser();
  const [workspace, setWorkspace] = useState<WorkspacePayload>(() => defaultWorkspace());
  const [bootKey, setBootKey] = useState(0);
  const latest = useRef<WorkspacePayload>(workspace);
  const hydrated = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const write = useCallback((payload: WorkspacePayload) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveWorkspaceToSupabase(payload).catch(() => undefined);
    }, 650);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWorkspaceFromSupabase()
      .then((data) => {
        if (cancelled) return;
        if (dirty.current) {
          hydrated.current = true;
          write(latest.current);
          return;
        }
        latest.current = data;
        setWorkspace(data);
        setBootKey((n) => n + 1);
        hydrated.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        hydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [write]);

  const persist = useCallback(
    (next: WorkspacePayload) => {
      const safe = jsonSafe(next);
      latest.current = safe;
      dirty.current = true;
      if (!hydrated.current) return;
      write(safe);
    },
    [write],
  );

  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      void saveWorkspaceToSupabase(latest.current).catch(() => undefined);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <CostEstimatorApp
      key={bootKey}
      initialWorkspace={workspace}
      onPersist={persist}
      currentUserName={
        currentUser?.displayName ?? currentUser?.primaryEmail ?? "Estimator"
      }
    />
  );
}
