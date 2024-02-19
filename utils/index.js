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
