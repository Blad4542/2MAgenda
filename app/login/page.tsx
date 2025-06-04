import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default function Login({
  searchParams,
}: {
  searchParams: { message: string };
}) {
  const signIn = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect("/login?message=Correo o contraseña incorrectos.");
    }

    return redirect("/");
  };

  const signUp = async (formData: FormData) => {
    "use server";

    const origin = headers().get("origin");
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      return redirect("/login?message=No se pudo registrar el usuario.");
    }

    return redirect(
      "/login?message=Revisa tu correo para confirmar el registro."
    );
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-r from-blue-50 to-blue-100 flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg mx-4">
        <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">
          Inicia sesión en tu cuenta
        </h2>
        {searchParams?.message && (
          <p className="text-red-500 text-center mb-4">
            {searchParams.message}
          </p>
        )}
        <form className="space-y-4" method="POST" action={signIn}>
          <div>
            <label
              htmlFor="email-address"
              className="block text-sm font-semibold text-gray-600"
            >
              Correo electrónico
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full mt-1 px-4 py-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ingresa tu correo"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-gray-600"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full mt-1 px-4 py-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ingresa tu contraseña"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
