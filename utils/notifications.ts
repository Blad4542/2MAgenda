import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifyAdmin(
  supabase: SupabaseClient,
  { type, message, record_id }: { type: "order" | "quote"; message: string; record_id?: string }
) {
  await supabase.rpc("notify_admin", {
    p_type: type,
    p_message: message,
    p_record_id: record_id ?? null,
  });
}
