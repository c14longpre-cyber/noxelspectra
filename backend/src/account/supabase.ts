import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

// Même projet Supabase que NOXEL SEO et NOXEL FORGE (table users partagée)
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws as any },
    });
  }
  return client;
}
