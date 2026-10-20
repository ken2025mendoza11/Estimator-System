/**
 * Test-deployment guard (Phase 0).
 *
 * True only when ESTIMATOR_TEST_LOGIN is exactly "1", VERCEL_ENV is not
 * "production", and ESTIMATOR_TEST_SUPABASE_URL is set and equals
 * VITE_SUPABASE_URL. Unset VERCEL_ENV is allowed. Empty strings are not set.
 * URLs are compared after trim. Never true on production.
 */

export type TestEnv = Record<string, string | undefined>;

export type TestRole = "staff" | "lead" | "head" | "admin";

export type TestUser = {
  role: TestRole;
  label: string;
  name: string;
  email: string;
  /** Better Auth user id. A UUID, so the Supabase user key stays this id. */
  userId: string;
};

/** Fake users for the test picker and scripts/seed-test.mjs. Not real people. */
export const TEST_USERS: readonly TestUser[] = [
  {
    role: "staff",
    label: "Staff",
    name: "Test Staff",
    email: "staff@estimator-test.invalid",
    userId: "11111111-1111-4111-8111-111111111111",
  },
  {
    role: "lead",
    label: "Lead",
    name: "Test Lead",
    email: "lead@estimator-test.invalid",
    userId: "22222222-2222-4222-8222-222222222222",
  },
  {
    role: "head",
    label: "Head",
    name: "Test Head",
    email: "head@estimator-test.invalid",
    userId: "33333333-3333-4333-8333-333333333333",
  },
  {
    role: "admin",
    label: "Admin",
    name: "Test Admin",
    email: "admin@estimator-test.invalid",
    userId: "44444444-4444-4444-8444-444444444444",
  },
];

const SEED_SECRETS = [
  "ESTIMATOR_TEST_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

function filled(value: string | undefined): string {
  return (value ?? "").trim();
}

export function isTestDeployment(env: TestEnv): boolean {
  if (env.ESTIMATOR_TEST_LOGIN !== "1") return false;
  if (env.VERCEL_ENV === "production") return false;
  const testUrl = filled(env.ESTIMATOR_TEST_SUPABASE_URL);
  const appUrl = filled(env.VITE_SUPABASE_URL);
  if (!testUrl || !appUrl) return false;
  return testUrl === appUrl;
}

/** Why scripts/seed-test.mjs must stop, or null when it may write. */
export function seedRefusal(env: TestEnv): string | null {
  if (!isTestDeployment(env)) {
    return "Refusing to seed. ESTIMATOR_TEST_LOGIN must be 1, VERCEL_ENV must not be production, and ESTIMATOR_TEST_SUPABASE_URL must equal VITE_SUPABASE_URL.";
  }
  const missing = SEED_SECRETS.filter((key) => !filled(env[key]));
  if (missing.length) return `Refusing to seed. Missing ${missing.join(", ")}.`;
  return null;
}

/**
 * When email/password is off, answer 404 for the email sign-in path.
 * Better Auth itself returns 400 once the request reaches it.
 */
export function emailSignInGate(request: Request, enabled: boolean): Response | null {
  if (enabled) return null;
  let path = "";
  try {
    path = new URL(request.url).pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
  if (path === "/api/auth/sign-in/email") return new Response(null, { status: 404 });
  return null;
}
