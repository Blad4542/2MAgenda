import { SupabaseClient } from "@supabase/supabase-js";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function findOrCreateCustomer(
  supabase: SupabaseClient,
  phone: string,
  name: string
): Promise<string> {
  const digits = normalizePhone(phone);

  const { data } = await supabase
    .from("customers")
    .select("id")
    .ilike("phone", `%${digits}%`)
    .limit(1)
    .maybeSingle();

  if (data?.id) return data.id as string;

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name, phone })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function findOrCreateVehicle(
  supabase: SupabaseClient,
  customerId: string,
  description: string
): Promise<string> {
  const { data } = await supabase
    .from("vehicles")
    .select("id")
    .eq("customer_id", customerId)
    .ilike("description", description)
    .limit(1)
    .maybeSingle();

  if (data?.id) return data.id as string;

  const { data: created, error } = await supabase
    .from("vehicles")
    .insert({ customer_id: customerId, description })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function lookupCustomer(
  supabase: SupabaseClient,
  phone: string
): Promise<{ id: string; name: string } | null> {
  const digits = normalizePhone(phone);
  if (digits.length < 6) return null;

  const { data } = await supabase
    .from("customers")
    .select("id, name")
    .ilike("phone", `%${digits}%`)
    .limit(1)
    .maybeSingle();

  return data as { id: string; name: string } | null;
}

export async function getCustomerVehicles(
  supabase: SupabaseClient,
  customerId: string
): Promise<{ id: string; description: string }[]> {
  const { data } = await supabase
    .from("vehicles")
    .select("id, description")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  return (data ?? []) as { id: string; description: string }[];
}
