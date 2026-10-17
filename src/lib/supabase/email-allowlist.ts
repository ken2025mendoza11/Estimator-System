/** Server-only allowlist for who may receive a Supabase token. */

export const NOT_ALLOWED_MESSAGE =
  "Your account is not allowed to open the estimator. Ask an administrator to add your email.";

/** Split ESTIMATOR_ALLOWED_EMAILS into trimmed, lower-case entries. */
export function parseAllowlist(raw: string | undefined | null): string[] {
  return String(raw || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the email matches a full email entry or an "@domain" entry.
 * Case-insensitive. A missing email never matches.
 */
export function emailAllowed(email: string | null | undefined, entries: string[]): boolean {
  const value = String(email || "").trim().toLowerCase();
  if (!value || !value.includes("@")) return false;
  const domain = value.slice(value.lastIndexOf("@"));
  return entries.some((entry) => (entry.startsWith("@") ? entry === domain : entry === value));
}
