import { createClient } from "@supabase/supabase-js";
import { readSupabaseAccessToken } from "./access-token";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

/** Shown on screen when the browser keys are missing. Importing this file must not throw. */
export const supabaseConfigError =
  supabaseUrl && supabaseAnonKey
    ? null
    : "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and set the project URL and the publishable (anon) key. Never put the service-role key in browser code.";

/**
 * The Authorization header is the short-lived JWT minted for the better-auth
 * session. supabase.auth.setSession is not used: it asks Supabase Auth to
 * confirm the token, and this app does not sign in there.
 */
export const supabase = createClient(
  supabaseUrl || "https://example.invalid",
  supabaseAnonKey || "missing-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => readSupabaseAccessToken(),
  },
);

export const COMPANY_WORKSPACE_ID = "company";
