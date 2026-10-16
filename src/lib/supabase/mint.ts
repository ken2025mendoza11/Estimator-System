import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Mint a short-lived Supabase JWT for the current better-auth session.
 * The signing secret stays on the server.
 */
export const mintSupabaseAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context as { userId: string; bearerToken?: string };
    const { issueSupabaseAccess } = await import("./issue-access.server");
    return issueSupabaseAccess(ctx.bearerToken, ctx.userId);
  });
