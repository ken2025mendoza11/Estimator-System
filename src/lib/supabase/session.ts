import { setSupabaseAccess, readSupabaseIdentity } from "./access-token";
import { supabaseConfigError } from "./client";

const REFRESH_EARLY_MS = 60_000;

let inflight: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function stillFresh(): boolean {
  const current = readSupabaseIdentity();
  if (!current) return false;
  return current.expiresAt * 1000 - Date.now() > REFRESH_EARLY_MS;
}

async function mint(): Promise<void> {
  const { mintSupabaseAccess } = await import("./mint");
  const next = await mintSupabaseAccess();
  setSupabaseAccess(next);
  if (timer) clearTimeout(timer);
  const delay = Math.max(5_000, next.expiresAt * 1000 - Date.now() - REFRESH_EARLY_MS);
  timer = setTimeout(() => {
    void ensureSupabaseAccess();
  }, delay);
}

/** Attach a signed-in Supabase token before any database or storage call. */
export async function ensureSupabaseAccess(): Promise<void> {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  if (stillFresh()) return;
  if (!inflight) {
    inflight = mint().finally(() => {
      inflight = null;
    });
  }
  await inflight;
}
