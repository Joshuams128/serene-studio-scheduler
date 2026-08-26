import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. RLS is enabled with no
// policies on every table, so this key is the only thing that can read or
// write — never import this file from a "use client" component.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
