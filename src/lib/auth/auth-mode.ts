/**
 * Decide which sign-in method the server offers, from env only (pure, testable).
 *
 * - "grok":   per-app Grok broker client present (GROK_AUTH_CLIENT_ID + SECRET),
 *             or a non-deployed sandbox/local run (shared preview client).
 * - "google": Grok vars absent and GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set
 *             (better-auth built-in Google provider; e.g. Vercel).
 * - "none":   auth disabled, or deployed with no usable provider.
 *
 * `setupError` is a friendly message shown on /login when a deployed server is
 * missing something it needs (never a secret value).
 */
export type AuthMode = "grok" | "google" | "none";

export type AuthModeResult = {
  mode: AuthMode;
  deployed: boolean;
  setupError: string | null;
};

type Env = Record<string, string | undefined>;

const val = (env: Env, key: string): string | undefined => {
  const v = env[key]?.trim();
  return v ? v : undefined;
};

export function resolveAuthMode(env: Env): AuthModeResult {
  const deployed = Boolean(val(env, "VERCEL") || val(env, "BETTER_AUTH_URL"));
  if (val(env, "VITE_AUTH_ENABLED") === "false") {
    return { mode: "none", deployed, setupError: null };
  }
  const grok = Boolean(val(env, "GROK_AUTH_CLIENT_ID") && val(env, "GROK_AUTH_CLIENT_SECRET"));
  const google = Boolean(val(env, "GOOGLE_CLIENT_ID") && val(env, "GOOGLE_CLIENT_SECRET"));
  const mode: AuthMode = grok ? "grok" : google ? "google" : deployed ? "none" : "grok";

  const problems: string[] = [];
  if (deployed && !val(env, "BETTER_AUTH_SECRET")) problems.push("BETTER_AUTH_SECRET");
  if (deployed && !val(env, "DATABASE_URL")) problems.push("DATABASE_URL");
  if (deployed && mode === "none") problems.push("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  const setupError = problems.length
    ? `Sign-in is not set up on this server yet. Missing server setting: ${problems.join(", ")}. Ask the site owner to add it in the hosting settings and redeploy.`
    : null;
  return { mode, deployed, setupError };
}
