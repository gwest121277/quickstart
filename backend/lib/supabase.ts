import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function currentUserId() {
  const id = process.env.QUICKSTART_USER_ID;
  if (!id) throw new Error("QUICKSTART_USER_ID missing");
  return id;
}
