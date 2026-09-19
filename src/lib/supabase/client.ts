import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rgppzzwitldwbfkgezoz.supabase.co";
const supabasePublishableKey =
  "sb_publishable_HVw6j79YziCzJfYOheC27g_nTPZz0Jd";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const COMPANY_WORKSPACE_ID = "company";
