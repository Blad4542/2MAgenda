import { createClient } from "./supabase/client";

export async function getAppSetting(key: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("app_settings").upsert({ key, value });
}
