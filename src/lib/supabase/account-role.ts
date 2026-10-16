import { supabase } from "./client";

export type AccountAccess = {
  userId: string;
  role: "admin" | "head" | "lead" | "staff";
  name: string;
};

const LEVELS = new Set(["admin", "head", "lead", "staff"]);

const EMPTY: AccountAccess = { userId: "", role: "staff", name: "" };

/** Role comes from profiles (server-side). A missing or unknown role is staff. */
export async function loadAccountAccess(): Promise<AccountAccess> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return EMPTY;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, display_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const raw = String(profile?.role || "").toLowerCase();
    const role = LEVELS.has(raw) ? (raw as AccountAccess["role"]) : "staff";
    const name = String(profile?.display_name || user.email || "").trim();
    return { userId: user.id, role, name };
  } catch {
    return EMPTY;
  }
}
