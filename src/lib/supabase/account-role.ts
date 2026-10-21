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
  profileComplete: boolean;
  welcomeSeen: boolean;
  duplicate: boolean;
};

export type AccessAccount = {
  userKey: string;
  email: string;
  role: string;
  status: AccountStatus;
  requestedAt: string;
};

const LEVELS = ["admin", "head", "lead", "staff"] as const;

const EMPTY: AccountAccess = {
  userId: "",
  role: "staff",
  name: "",
  status: "active",
  note: "",
  profileComplete: true,
  welcomeSeen: true,
  duplicate: false,
};

type RoleRow = {
  role?: string | null;
  email?: string | null;
  status?: string | null;
  user_key?: string | null;
  display_name?: string | null;
  profile_complete?: boolean | null;
  welcome_seen_at?: string | null;
  decline_reason?: string | null;
  duplicate_of?: string | null;
};

const RICH_COLUMNS = "role, email, status, user_key, display_name, profile_complete, welcome_seen_at, decline_reason, duplicate_of";

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

function missingColumn(message: string): boolean {
  return /profile_complete|welcome_seen_at|display_name|decline_reason|column|schema cache|does not exist|could not find/i.test(message);
}

function openAccount(userId: string, name: string, extra: Partial<AccountAccess> = {}): AccountAccess {
  return {
    userId,
    role: "staff",
    name,
    status: "active",
    note: "",
    profileComplete: true,
    welcomeSeen: true,
    duplicate: false,
    ...extra,
  };
}

function fromRich(userId: string, fallbackName: string, row: RoleRow, note = ""): AccountAccess {
  const status = pickStatus([row]);
  const reason = note || (status === "declined" ? String(row.decline_reason || "") : "");
  return {
    userId,
    role: pickRole([row]),
    name: String(row.display_name || fallbackName || "").trim(),
    status,
    note: reason,
    profileComplete: status === "active" ? row.profile_complete !== false : row.profile_complete === true,
    welcomeSeen: status === "active" ? Boolean(row.welcome_seen_at) : true,
    duplicate: Boolean(row.duplicate_of) || /duplicate/i.test(reason),
  };
}

function missingAccessUpdate(message: string): boolean {
  return /register_pending|status|schema cache|does not exist|could not find|PGRST202|42883/i.test(message);
}

type RegisterResult = {
  status?: string;
  role?: string;
  reason?: string;
  ok?: boolean;
  duplicate?: boolean;
  user_key?: string;
  profileComplete?: boolean;
  welcomeSeen?: boolean;
};

function fromRegister(userId: string, name: string, result: RegisterResult): AccountAccess {
  const otherKey = Boolean(result.user_key && result.user_key !== userId);
  const duplicate = result.duplicate === true || otherKey;
  const statusText = String(result.status || "pending").toLowerCase();
  const status = statusText === "active" || statusText === "declined" || statusText === "disabled" ? statusText : "pending";
  const role = LEVELS.includes(result.role as AccountAccess["role"])
    ? (result.role as AccountAccess["role"])
    : "staff";
  if (otherKey || (duplicate && status !== "pending")) {
    return {
      userId,
      role: "staff",
      name,
      status: "declined",
      note: String(result.reason || "Duplicate. This email already has an account."),
      profileComplete: true,
      welcomeSeen: true,
      duplicate: true,
    };
  }
  if (duplicate) {
    return {
      userId,
      role: "staff",
      name,
      status: "pending",
      note: String(result.reason || "Duplicate. This email already has an account."),
      profileComplete: result.profileComplete === true,
      welcomeSeen: true,
      duplicate: true,
    };
  }
  return {
    userId,
    role,
    name,
    status,
    note: result.ok === false ? String(result.reason || "") : "",
    profileComplete: status === "active" ? result.profileComplete !== false : result.profileComplete === true,
    welcomeSeen: status === "active" ? result.welcomeSeen === true : true,
    duplicate: false,
  };
}

/**
 * Role comes from app_user_roles, keyed by the stable user id.
 * Before the sign-up columns exist, an email match still opens the app.
 * After those columns exist, a different user id with the same email is a
 * duplicate: it is not admitted and the other row is not rewritten.
 */
export async function loadAccountAccess(hint?: { name?: string }): Promise<AccountAccess> {
  if (supabaseConfigError) return EMPTY;
  try {
    await ensureSupabaseAccess();
    const identity = readSupabaseIdentity();
    if (!identity) return EMPTY;
    const name = String(hint?.name || identity.email || "").trim();
    const rich = await supabase
      .from("app_user_roles")
      .select(RICH_COLUMNS)
      .eq("user_key", identity.userKey)
      .maybeSingle();
    if (rich.error) {
      if (missingColumn(rich.error.message) || missingAccessUpdate(rich.error.message)) {
        return legacyAccount(identity.userKey, name, identity.email);
      }
      return openAccount(identity.userKey, name);
    }
    if (rich.data) return fromRich(identity.userKey, name, rich.data as RoleRow);
    const email = identity.email?.trim();
    let other = false;
    if (email && !/[,()]/.test(email)) {
      const byEmail = await supabase
        .from("app_user_roles")
        .select("user_key, email")
        .ilike("email", email)
        .limit(5);
      if (!byEmail.error && byEmail.data?.some((row) => row.user_key && row.user_key !== identity.userKey)) {
        other = true;
      }
    }
    const registered = await supabase.rpc("register_pending", {
      p_profile: { name, email: email || "" },
    });
    if (registered.error) {
      if (missingAccessUpdate(registered.error.message)) return openAccount(identity.userKey, name);
      return {
        ...openAccount(identity.userKey, name, { status: "pending", note: registered.error.message, profileComplete: false }),
      };
    }
    const result = (registered.data || {}) as RegisterResult;
    if (other && result.ok !== false && result.user_key === identity.userKey) {
      return fromRegister(identity.userKey, name, result);
    }
    return fromRegister(identity.userKey, name, other ? { ...result, duplicate: true } : result);
  } catch {
    return EMPTY;
  }
}

async function legacyAccount(userId: string, name: string, email: string | null): Promise<AccountAccess> {
  const byKey = await supabase
    .from("app_user_roles")
    .select("role, email, status")
    .eq("user_key", userId)
    .maybeSingle();
  if (byKey.error) return openAccount(userId, name);
  const rows: RoleRow[] = byKey.data ? [byKey.data] : [];
  const cleanEmail = email?.trim();
  if (cleanEmail && !/[,()]/.test(cleanEmail)) {
    const byEmail = await supabase
      .from("app_user_roles")
      .select("role, email, status")
      .ilike("email", cleanEmail)
      .limit(5);
    if (!byEmail.error && byEmail.data) rows.push(...byEmail.data);
  }
  if (rows.length) {
    return {
      userId,
      role: pickRole(rows),
      name,
      status: pickStatus(rows),
      note: "",
      profileComplete: true,
      welcomeSeen: true,
      duplicate: false,
    };
  }
  const registered = await supabase.rpc("register_pending", {
    p_profile: { name, email: cleanEmail || "" },
  });
  if (registered.error) {
    if (missingAccessUpdate(registered.error.message)) return openAccount(userId, name);
    return openAccount(userId, name, { status: "pending", note: registered.error.message });
  }
  const result = (registered.data || {}) as RegisterResult;
  const statusText = String(result.status || "pending").toLowerCase();
  const status = statusText === "active" || statusText === "declined" || statusText === "disabled" ? statusText : "pending";
  const role = LEVELS.includes(result.role as AccountAccess["role"]) ? (result.role as AccountAccess["role"]) : "staff";
  return {
    userId,
    role,
    name,
    status,
    note: result.ok === false ? String(result.reason || "") : "",
    profileComplete: true,
    welcomeSeen: true,
    duplicate: false,
  };
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

async function accessRpc(name: string, args: Record<string, unknown>) {
  await ensureSupabaseAccess();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (missingAccessUpdate(error.message)) return { ok: false, reason: "The access update is not on this database yet." };
    throw error;
  }
  return (data || { ok: false }) as { ok?: boolean; reason?: string; linked?: boolean };
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

export type ProfileInput = { name: string; department: string; mobile: string; signature: string };

export function updatePendingProfile(profile: ProfileInput) {
  return accessRpc("update_pending_profile", { p_profile: profile });
}

export function markWelcomeSeen() {
  return accessRpc("mark_welcome_seen", {});
}

export function declineUserWithReason(userKey: string, reason: string) {
  return accessRpc("decline_user_with_reason", { p_user_key: userKey, p_reason: reason }).then(async (result) => {
    if (result?.ok === false && /not on this database/i.test(result.reason || "")) return declineUser(userKey);
    return result;
  });
}

export function declineAsDuplicate(userKey: string, otherKey: string) {
  return accessRpc("decline_as_duplicate", { p_user_key: userKey, p_other_key: otherKey });
}

export function approveInstead(userKey: string, role: string) {
  return accessRpc("approve_instead", { p_user_key: userKey, p_role: role });
}

export async function listPossibleDuplicates(): Promise<Array<Record<string, string>>> {
  await ensureSupabaseAccess();
  const { data, error } = await supabase.rpc("possible_duplicates");
  if (error) {
    if (missingAccessUpdate(error.message)) return [];
    throw error;
  }
  return Array.isArray(data) ? (data as Array<Record<string, string>>) : [];
}

export function requestAccountLink(userKey = "") {
  if (userKey) return accessRpc("request_account_link", { p_user_key: userKey });
  return accessRpc("request_account_link", {});
}

export function declineAccountLink(id: number) {
  return accessRpc("decline_account_link", { p_id: id });
}

export function markAccessReminded(userKey: string) {
  return accessRpc("mark_access_reminded", { p_user_key: userKey });
}

export async function listAllowlist(): Promise<string[]> {
  await ensureSupabaseAccess();
  const { data, error } = await supabase.rpc("list_email_allowlist");
  if (error) {
    if (missingAccessUpdate(error.message)) return [];
    throw error;
  }
  return Array.isArray(data) ? data.map((item) => String(item)) : [];
}

export function addAllowlistEntry(entry: string) {
  return accessRpc("add_email_allowlist", { p_entry: entry });
}

export function removeAllowlistEntry(entry: string) {
  return accessRpc("remove_email_allowlist", { p_entry: entry });
}

export async function loadPublicBranding(): Promise<{ name: string; logo: string; contact: string }> {
  const fallback = { name: "Estimator System", logo: "", contact: "" };
  try {
    const { data, error } = await supabase.rpc("get_public_branding");
    if (error || !data || typeof data !== "object") return fallback;
    const row = data as { name?: string; logo?: string; contact?: string };
    return {
      name: String(row.name || fallback.name),
      logo: String(row.logo || ""),
      contact: String(row.contact || ""),
    };
  } catch {
    return fallback;
  }
}

export function setPublicBranding(input: { name: string; logo: string; contact: string }) {
  return accessRpc("set_public_branding", {
    p_name: input.name,
    p_logo: input.logo,
    p_contact: input.contact,
  });
}
