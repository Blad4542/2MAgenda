"use server";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });
  if (error) redirect("/login?message=Correo o contraseña incorrectos.");
  redirect("/dashboard/agenda");
}

export async function signUp(formData: FormData) {
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect("/login?message=No se pudo registrar el usuario.");
  redirect("/login?message=Revisa tu correo para confirmar el registro.");
}
