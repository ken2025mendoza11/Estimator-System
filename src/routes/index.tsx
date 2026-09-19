import { createFileRoute } from "@tanstack/react-router";
import { EstimatorShell } from "@/components/EstimatorShell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <EstimatorShell />;
}
