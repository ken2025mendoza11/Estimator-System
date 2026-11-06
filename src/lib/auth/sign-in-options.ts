import { createServerFn } from "@tanstack/react-start";
import { isTestDeployment, TEST_USERS, type TestRole } from "./test-login";

export type SignInOption = { providerId: string; label: string; kind: "grok" | "social" };

export type TestLoginUser = { role: TestRole; label: string; email: string };

export type SignInOptions = {
  providers: SignInOption[];
  setupError: string | null;
  /**
   * Fake-user picker. Null unless this process is a test deployment.
   * `password` is ESTIMATOR_TEST_PASSWORD (empty string when unset).
   */
  testLogin: { users: TestLoginUser[]; password: string } | null;
};

/**
 * Which sign-in buttons /login should show. Reads server-only env; returns
 * provider ids/labels and a friendly setup message only (never secrets),
 * plus the test picker when the test-deployment guard is on.
 */
export const getSignInOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<SignInOptions> => {
    const { resolveAuthMode } = await import("./auth-mode");
    const { GROK_PROVIDERS } = await import("./providers");
    const { mode, setupError, microsoft } = resolveAuthMode(process.env);
    const providers: SignInOption[] =
      mode === "grok"
        ? GROK_PROVIDERS.map((p) => ({ providerId: p.providerId, label: p.label, kind: "grok" as const }))
        : mode === "google"
          ? [{ providerId: "google", label: "Google", kind: "social" }]
          : [];
    if (microsoft) providers.push({ providerId: "microsoft", label: "Microsoft", kind: "social" });
    const testLogin = isTestDeployment(process.env)
      ? {
          users: TEST_USERS.map((user) => ({
            role: user.role,
            label: user.label,
            email: user.email,
          })),
          password: process.env.ESTIMATOR_TEST_PASSWORD ?? "",
        }
      : null;
    return { providers: setupError ? [] : providers, setupError, testLogin };
  },
);
