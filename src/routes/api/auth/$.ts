import { createFileRoute } from "@tanstack/react-router";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { auth, authSetupError } from "@/lib/auth/server";
import { emailSignInGate } from "@/lib/auth/test-login";

// A deployed server missing required auth settings answers 503 with a friendly
// message instead of signing sessions with a per-instance random secret.
// Email/password is a test-deployment feature: when the guard is off, that
// one path is 404 before Better Auth can answer 400.
function handle(request: Request) {
  const blocked = emailSignInGate(request, emailAndPasswordEnabled);
  if (blocked) return blocked;
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
