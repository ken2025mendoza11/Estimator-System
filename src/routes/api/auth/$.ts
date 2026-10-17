import { createFileRoute } from "@tanstack/react-router";
import { auth, authSetupError } from "@/lib/auth/server";

// A deployed server missing required auth settings answers 503 with a friendly
// message instead of signing sessions with a per-instance random secret.
function handle(request: Request) {
  if (authSetupError) {
    return Response.json({ error: authSetupError }, { status: 503 });
  }
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
