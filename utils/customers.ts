import { SupabaseClient } from "@supabase/supabase-js";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export interface VehicleRecord {
  id: string;
  description: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
}

export function buildVehicleDescription(make: string, model: string, year: string | number): string {
  return [make.trim(), model.trim(), String(year).trim()].filter(Boolean).join(" ");
}

export function vehicleLabel(v: VehicleRecord): string {
  if (v.make || v.model) {
    return [v.make, v.model, v.year].filter(Boolean).join(" ");
  }
  return v.description;
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
  data: string | { make?: string; model?: string; year?: string | number; description?: string }
): Promise<string> {
  const isString = typeof data === "string";
  const make = isString ? "" : (data.make?.trim() ?? "");
  const model = isString ? "" : (data.model?.trim() ?? "");
  const year = isString ? "" : (data.year ? String(data.year) : "");
  const desc = isString
    ? data
    : (data.description ?? buildVehicleDescription(make, model, year));

  if (!desc.trim()) throw new Error("Vehicle description is empty");

  const { data: found } = await supabase
    .from("vehicles")
    .select("id")
    .eq("customer_id", customerId)
    .ilike("description", desc)
    .limit(1)
    .maybeSingle();

  if (found?.id) return found.id as string;

  const { data: created, error } = await supabase
    .from("vehicles")
    .insert({
      customer_id: customerId,
      description: desc,
      make: make || null,
      model: model || null,
      year: year ? Number(year) : null,
    })
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
): Promise<VehicleRecord[]> {
  const { data } = await supabase
    .from("vehicles")
    .select("id, description, make, model, year")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  return (data ?? []) as VehicleRecord[];
}
