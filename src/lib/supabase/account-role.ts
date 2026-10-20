import { readSupabaseIdentity } from "./access-token";
import { supabase, supabaseConfigError } from "./client";
import { ensureSupabaseAccess } from "./session";

export type AccountStatus = "active" | "pending" | "declined" | "disabled";

export type AccountAccess = {
  userId: string;
  role: "admin" | "head" | "lead" | "staff";
  name: string;
  status: AccountStatus;
  note: string;
};

export type AccessAccount = {
  userKey: string;
  email: string;
  role: string;
  status: AccountStatus;
  requestedAt: string;
};

const LEVELS = ["admin", "head", "lead", "staff"] as const;

const EMPTY: AccountAccess = { userId: "", role: "staff", name: "", status: "active", note: "" };

type RoleRow = { role?: string | null; email?: string | null; status?: string | null };

function pickRole(rows: RoleRow[]): AccountAccess["role"] {
  const found = new Set(rows.map((row) => String(row.role || "").toLowerCase()));
  for (const level of LEVELS) {
    if (found.has(level)) return level;
  }
  return "staff";
}

function pickStatus(rows: RoleRow[]): AccountStatus {
  const values = rows.map((row) => String(row.status || "").toLowerCase());
  if (values.includes("active")) return "active";
  if (values.includes("pending")) return "pending";
  if (values.includes("disabled")) return "disabled";
  if (values.includes("declined")) return "declined";
  return rows.length ? "active" : "pending";
}

function missingTable(message: string): boolean {
  return /app_user_roles|schema cache|does not exist|could not find/i.test(message);
}

function missingAccessUpdate(message: string): boolean {
  return /register_pending|status|schema cache|does not exist|could not find|PGRST202|42883/i.test(message);
}

function accessFrom(userId: string, name: string, rows: RoleRow[], note = ""): AccountAccess {
  return {
    userId,
    role: pickRole(rows),
    name,
    status: pickStatus(rows),
    note,
  };
}

/**
 * Role comes from app_user_roles, keyed by the stable user id or email.
 * Before the access columns exist, everyone stays active and the app still loads.
 * A signed-in account with no row is registered as pending.
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
      .select("role, email, status")
      .eq("user_key", identity.userKey)
      .maybeSingle();
    if (byKey.error) {
      if (missingTable(byKey.error.message) || missingAccessUpdate(byKey.error.message)) {
        return { userId: identity.userKey, role: "staff", name, status: "active", note: "" };
      }
      return { userId: identity.userKey, role: "staff", name, status: "active", note: "" };
    }
    const rows: RoleRow[] = byKey.data ? [byKey.data] : [];
    const email = identity.email?.trim();
    if (email && !/[,()]/.test(email)) {
      const byEmail = await supabase
        .from("app_user_roles")
        .select("role, email, status")
        .ilike("email", email)
        .limit(5);
      if (!byEmail.error && byEmail.data) rows.push(...byEmail.data);
    }
    if (rows.length) return accessFrom(identity.userKey, name, rows);
    const registered = await supabase.rpc("register_pending", {
      p_profile: { name, email: email || "" },
    });
    if (registered.error) {
      if (missingAccessUpdate(registered.error.message)) {
        return { userId: identity.userKey, role: "staff", name, status: "active", note: "" };
      }
      return { userId: identity.userKey, role: "staff", name, status: "pending", note: registered.error.message };
    }
    const result = (registered.data || {}) as { status?: string; role?: string; reason?: string; ok?: boolean };
    const status = String(result.status || "pending").toLowerCase();
    const role = LEVELS.includes(result.role as AccountAccess["role"])
      ? (result.role as AccountAccess["role"])
      : "staff";
    return {
      userId: identity.userKey,
      role,
      name,
      status: status === "active" || status === "declined" || status === "disabled" ? status : "pending",
      note: result.ok === false ? String(result.reason || "") : "",
    };
  } catch {
    return EMPTY;
  }
}

export async function listUserAccess(): Promise<AccessAccount[]> {
  await ensureSupabaseAccess();
  const { data, error } = await supabase.rpc("list_user_access");
  if (error) {
    if (missingAccessUpdate(error.message)) return [];
    throw error;
  }
  return Array.isArray(data) ? (data as AccessAccount[]) : [];
}

async function accessRpc(name: "grant_role" | "decline_user" | "disable_user", args: Record<string, string>) {
  await ensureSupabaseAccess();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (missingAccessUpdate(error.message)) return { ok: false, reason: "The access update is not on this database yet." };
    throw error;
  }
  return (data || { ok: false }) as { ok?: boolean; reason?: string };
}

export function grantUserRole(userKey: string, role: string) {
  return accessRpc("grant_role", { p_user_key: userKey, p_role: role });
}

export function declineUser(userKey: string) {
  return accessRpc("decline_user", { p_user_key: userKey });
}

export function disableUser(userKey: string) {
  return accessRpc("disable_user", { p_user_key: userKey });
}
