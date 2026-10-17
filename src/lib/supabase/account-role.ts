import { readSupabaseIdentity } from "./access-token";
import { supabase, supabaseConfigError } from "./client";
import { ensureSupabaseAccess } from "./session";

export type AccountAccess = {
  userId: string;
  role: "admin" | "head" | "lead" | "staff";
  name: string;
};

const LEVELS = ["admin", "head", "lead", "staff"] as const;

const EMPTY: AccountAccess = { userId: "", role: "staff", name: "" };

type RoleRow = { role?: string | null; email?: string | null };

function pickRole(rows: RoleRow[]): AccountAccess["role"] {
  const found = new Set(rows.map((row) => String(row.role || "").toLowerCase()));
  for (const level of LEVELS) {
    if (found.has(level)) return level;
  }
  return "staff";
}

function missingTable(message: string): boolean {
  return /app_user_roles|schema cache|does not exist|could not find/i.test(message);
}

/**
 * Role comes from app_user_roles, keyed by the stable user id or email.
 * Before that table exists, everyone is staff and the rest of the app still loads.
 */
export async function loadAccountAccess(hint?: { name?: string }): Promise<AccountAccess> {
  if (supabaseConfigError) return EMPTY;
  try {
    await ensureSupabaseAccess();
    const identity = readSupabaseIdentity();
    if (!identity) return EMPTY;
    const name = String(hint?.name || identity.email || "").trim();
    const byKey = await supabase
      .from("app_user_roles")
      .select("role, email")
      .eq("user_key", identity.userKey)
      .maybeSingle();
    if (byKey.error) {
      if (missingTable(byKey.error.message)) {
        return { userId: identity.userKey, role: "staff", name };
      }
      return { userId: identity.userKey, role: "staff", name };
    }
    const rows: RoleRow[] = byKey.data ? [byKey.data] : [];
    const email = identity.email?.trim();
    if (email && !/[,()]/.test(email)) {
      const byEmail = await supabase
        .from("app_user_roles")
        .select("role, email")
        .ilike("email", email)
        .limit(5);
      if (!byEmail.error && byEmail.data) rows.push(...byEmail.data);
    }
    return { userId: identity.userKey, role: pickRole(rows), name };
  } catch {
    return EMPTY;
  }
}
