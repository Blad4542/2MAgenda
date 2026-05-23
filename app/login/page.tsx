import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const LOGO_URL =
  "https://igzxgawkalsqyydqxbqf.supabase.co/storage/v1/object/public/public-assets//3132f1d1-9cac-4b6b-993b-0bc6022d64bd.png";

export default function Login({ searchParams }: { searchParams: { message: string } }) {
  const signIn = async (formData: FormData) => {
    "use server";
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });
    if (error) return redirect("/login?message=Correo o contraseña incorrectos.");
    return redirect("/dashboard/agenda");
  };

  const signUp = async (formData: FormData) => {
    "use server";
    const origin = headers().get("origin");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return redirect("/login?message=No se pudo registrar el usuario.");
    return redirect("/login?message=Revisa tu correo para confirmar el registro.");
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left panel */}
      <div className="hidden md:flex md:w-1/2 flex-col items-center justify-center bg-white border-r border-gray-200 p-12">
        <div className="w-1.5 h-12 bg-[#07C3F8] rounded-full mb-8" aria-hidden="true" />
        <Image
          src={LOGO_URL}
          alt="Logo Autodecoración 2M"
          width={208}
          height={208}
          priority
          className="mb-6"
        />
        <p className="text-gray-400 text-sm text-center">Sistema de gestión interna</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-gray-100">
            <div className="flex justify-center mb-4 md:hidden">
              <Image
                src={LOGO_URL}
                alt="Logo Autodecoración 2M"
                width={112}
                height={112}
                priority
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Bienvenido</h2>
            <p className="text-sm text-gray-500 mt-1">Inicia sesión para continuar</p>
          </div>

          <div className="px-8 py-6">
            {searchParams?.message && (
              <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {searchParams.message}
              </div>
            )}
            <form className="space-y-4" action={signIn} method="POST">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="email-address" name="email" type="email" autoComplete="email" required
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <input
                  id="password" name="password" type="password" autoComplete="current-password" required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold py-2.5 rounded-xl transition-colors shadow-sm mt-2"
              >
                Iniciar sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
