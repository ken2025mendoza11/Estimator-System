import type { JSX } from "react";
import type { WorkspacePayload } from "@/lib/estimator/defaults";

declare function CostEstimatorApp(props: {
  initialWorkspace?: WorkspacePayload;
  onPersist?: (workspace: WorkspacePayload) => void;
  saveState?: "idle" | "saving" | "saved" | "error";
  currentUserName?: string;
  accountUserId?: string;
  accountRole?: "admin" | "head" | "lead" | "staff";
  accountName?: string;
  testDeployment?: boolean;
}): JSX.Element;

export default CostEstimatorApp;
