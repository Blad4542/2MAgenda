import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifyAdmin(
  supabase: SupabaseClient,
  { type, message, record_id }: { type: "order" | "quote"; message: string; record_id?: string }
) {
  const { data: admin } = await supabase
    .from("user_roles")
    .select("id")
    .eq("role", "admin")
    .maybeSingle();

  if (!admin?.id) return;

  await supabase.from("notifications").insert({
    user_id: admin.id,
    type,
    message,
    record_id: record_id ?? null,
  });
}
