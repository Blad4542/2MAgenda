import { SupabaseClient } from "@supabase/supabase-js";

interface LogParams {
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete";
  description?: string;
  user_email?: string;
}

export async function logAction(supabase: SupabaseClient, params: LogParams) {
  await supabase.from("audit_log").insert({
    table_name: params.table_name,
    record_id: params.record_id,
    action: params.action,
    description: params.description ?? null,
    user_email: params.user_email ?? null,
  });
}
