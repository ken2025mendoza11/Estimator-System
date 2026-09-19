import type { JSX } from "react";
import type { WorkspacePayload } from "@/lib/estimator/defaults";

declare function CostEstimatorApp(props: {
  initialWorkspace?: WorkspacePayload;
  onPersist?: (workspace: WorkspacePayload) => void;
  currentUserName?: string;
}): JSX.Element;

export default CostEstimatorApp;
