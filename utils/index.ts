import { createClient } from "./supabase/client";

interface Appointment {
  id?: string | number;
  start_time: string;
  end_time: string;
  assigned_person: string;
  name: string;
  phone: string;
  description: string;
  vehicle: string;
  status: "pending" | "active" | "done";
  appointment_date: string;
}

interface SupabaseResponse<T = any> {
  data: T | null;
  error: {
    message: string;
  } | null;
}

// Función para agregar una nueva nota a Supabase
export const addNoteToSupabase = async (
  appointment: Appointment
): Promise<SupabaseResponse> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert([appointment]);

  if (error) {
    console.error("Error al guardar la nota:", error.message);
    return { data: null, error };
  }

  return { data, error: null };
};

export const updateNoteInSupabase = async (
  task: Appointment
): Promise<SupabaseResponse> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      name: task.name,
      phone: task.phone,
      description: task.description,
      vehicle: task.vehicle,
      status: task.status,
      start_time: task.start_time,
      end_time: task.end_time,
      assigned_person: task.assigned_person,
      appointment_date: task.appointment_date,
    })
    .match({ id: task.id });

  return { data, error };
};

export const deleteNoteFromSupabase = async (
  id: number | string
): Promise<SupabaseResponse> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .delete()
    .match({ id });

  return { data, error };
};
