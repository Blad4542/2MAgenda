import { createClient } from "./supabase/client";
// Función para agregar una nueva nota a Supabase

const supabase = createClient();

export const addNoteToSupabase = async (appointment) => {
  const { data, error } = await supabase
    .from("appointments")
    .insert([appointment]);

  if (error) {
    console.error("Error al guardar la nota:", error.message);
    return { data: null, error }; // Retorna un objeto con el error
  }

  return { data, error: null }; // Retorna los datos y un error nulo si la operación fue exitosa
};

export const updateNoteInSupabase = async (task) => {
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
    })
    .match({ id: task.id });

  return { data, error };
};
