import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AuthButton() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signOut = async () => {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    return redirect("/login");
  };

  return user ? (
    <div className="flex items-center justify-between bg-white shadow-md rounded-lg px-6 py-3 w-full max-w-md text-gray-700">
      <span className="text-base font-semibold">
        Hola, <span className="text-blue-600">{user.email}</span>!
      </span>
      <form action={signOut}>
        <button className="bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors">
          Cerrar sesión
        </button>
      </form>
    </div>
  ) : (
    <div className="w-full max-w-md">
      <Link
        href="/login"
        className="block text-center w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
      >
        Iniciar sesión
      </Link>
    </div>
  );
}
