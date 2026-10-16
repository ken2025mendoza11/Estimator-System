/** In-memory Supabase access token. The browser never stores the signing secret. */

export type SupabaseAccess = {
  accessToken: string;
  /** Unix seconds. */
  expiresAt: number;
  userKey: string;
  email: string | null;
};

let current: SupabaseAccess | null = null;

export function readSupabaseAccessToken(): string | null {
  if (!current) return null;
  if (current.expiresAt * 1000 <= Date.now() + 5_000) return null;
  return current.accessToken;
}

export function readSupabaseIdentity(): SupabaseAccess | null {
  return current;
}

export function setSupabaseAccess(next: SupabaseAccess | null): void {
  current = next;
}
