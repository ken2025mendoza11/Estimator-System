import type { JSX } from "react";
import type { WorkspacePayload } from "@/lib/estimator/defaults";

declare function CostEstimatorApp(props: {
  initialWorkspace?: WorkspacePayload;
  onPersist?: (workspace: WorkspacePayload) => void;
  saveState?: "idle" | "saving" | "saved" | "error";
  currentUserName?: string;
}): JSX.Element;

export default CostEstimatorApp;
