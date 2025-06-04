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
    <div className="flex flex-col md:flex-row w-screen h-screen bg-white md:bg-gradient-to-r md:from-blue-50 md:to-blue-100">
      {/* Columna izquierda: Logo */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white shadow-lg order-1 md:order-none p-6">
        <img
          src="https://igzxgawkalsqyydqxbqf.supabase.co/storage/v1/object/public/public-assets//3132f1d1-9cac-4b6b-993b-0bc6022d64bd.png"
          alt="Logo 2M"
          className="max-w-xs w-3/4 md:w-2/3"
        />
      </div>

      {/* Columna derecha: Formulario */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 bg-white md:bg-[#DAF7FF] order-2 md:order-none">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-center text-[#07C3F8] mb-6">
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
                className="w-full mt-1 px-4 py-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#07C3F8]"
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
                className="w-full mt-1 px-4 py-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#07C3F8]"
                placeholder="Ingresa tu contraseña"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#07C3F8] text-white py-2 px-4 rounded-lg font-semibold hover:bg-[#06A9D8] transition-colors"
            >
              Iniciar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
