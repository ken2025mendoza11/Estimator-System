import { createFileRoute } from "@tanstack/react-router";
import { EstimatorShell } from "@/components/EstimatorShell";

export const Route = createFileRoute("/view/$kind/$id")({
  component: MobileViewRoute,
});

function MobileViewRoute() {
  const { kind, id } = Route.useParams();
  return <EstimatorShell mobileView={{ kind, id }} />;
}
