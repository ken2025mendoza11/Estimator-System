import { createFileRoute } from "@tanstack/react-router";
import { routeFuelHttp } from "@/lib/estimator/routeFuel.server";

export const Route = createFileRoute("/api/route-fuel")({
  server: {
    handlers: {
      GET: ({ request }) => routeFuelHttp(request),
    },
  },
});
