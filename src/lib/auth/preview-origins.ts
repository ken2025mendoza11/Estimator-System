/**
 * Preview and Google origins the app must accept without a dashboard edit.
 * Vercel sets VERCEL_ENV and VERCEL_URL on each deployment. Production keeps
 * BETTER_AUTH_URL. A preview deployment uses its own host so Google's redirect
 * and Better Auth's origin check match the page the user is on.
 */

export type OriginEnv = Record<string, string | undefined>;

const PROJECT_PREVIEW_ORIGINS = [
  "https://estimator-system.vercel.app",
  "https://estimator-system-*.vercel.app",
  "https://estimator-system-git-*-ken-3817.vercel.app",
];

function clean(value: string | undefined): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

/** https origin of this deployment when Vercel is serving a branch preview. */
export function previewDeploymentOrigin(env: OriginEnv): string {
  if (clean(env.VERCEL_ENV) !== "preview") return "";
  const host = clean(env.VERCEL_URL).replace(/^https?:\/\//, "");
  if (!host || !/^[a-z0-9.-]+$/i.test(host)) return "";
  return `https://${host}`;
}

/**
 * Origins Better Auth should trust in addition to the local dev hosts.
 * Google's account host is included so a Google sign-in popup is not rejected.
 */
export function extraTrustedOrigins(env: OriginEnv): string[] {
  const out = new Set<string>(PROJECT_PREVIEW_ORIGINS);
  out.add("https://accounts.google.com");
  const preview = previewDeploymentOrigin(env);
  if (preview) out.add(preview);
  const explicit = clean(env.BETTER_AUTH_URL);
  if (explicit) out.add(explicit);
  return [...out];
}

/**
 * baseURL for this process. Preview uses the deployment host. Otherwise the
 * explicit BETTER_AUTH_URL, or "" when the caller should keep the dynamic one.
 */
export function resolvedAuthBaseURL(env: OriginEnv): string {
  const preview = previewDeploymentOrigin(env);
  if (preview) return preview;
  return clean(env.BETTER_AUTH_URL);
}
