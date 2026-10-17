import { createServerFn } from "@tanstack/react-start";

export type SignInOption = { providerId: string; label: string; kind: "grok" | "social" };
export type SignInOptions = { providers: SignInOption[]; setupError: string | null };

/**
 * Which sign-in buttons /login should show. Reads server-only env; returns
 * provider ids/labels and a friendly setup message only (never secrets).
 */
export const getSignInOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<SignInOptions> => {
    const { resolveAuthMode } = await import("./auth-mode");
    const { GROK_PROVIDERS } = await import("./providers");
    const { mode, setupError } = resolveAuthMode(process.env);
    const providers: SignInOption[] =
      mode === "grok"
        ? GROK_PROVIDERS.map((p) => ({ providerId: p.providerId, label: p.label, kind: "grok" as const }))
        : mode === "google"
          ? [{ providerId: "google", label: "Google", kind: "social" }]
          : [];
    return { providers: setupError ? [] : providers, setupError };
  },
);
