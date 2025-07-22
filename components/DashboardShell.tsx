"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  Home,
  Calendar,
  FileText,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"; // añade íconos

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-[#07C3F8] text-white px-6 py-4 flex justify-between items-center">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Autodecoración 2M</h1>
        <button
          onClick={handleLogout}
          className="bg-white text-[#07C3F8] px-4 py-1 rounded hover:bg-blue-100"
        >
          Cerrar sesión
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`bg-[#DAF7FF] h-full p-4 transition-all duration-300 ease-in-out flex flex-col
    ${isSidebarOpen ? "w-64" : "w-16"}`}
        >
          {/* Botón de colapsar/expandir */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-blue-700 hover:text-blue-900"
            >
              {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
            </button>
          </div>

          <nav className="space-y-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-blue-700 font-medium"
            >
              <Home className="w-5 h-5" />
              {isSidebarOpen && <span>Inicio</span>}
            </Link>
            <Link
              href="/dashboard/agenda"
              className="flex items-center gap-2 text-blue-700 font-medium"
              onClick={() => setIsSidebarOpen(false)} // Cierra el menú
            >
              <Calendar className="w-5 h-5" />
              {isSidebarOpen && <span>Agenda</span>}
            </Link>
            <Link
              href="/dashboard/payments"
              className="flex items-center gap-2 text-blue-700 font-medium"
              onClick={() => setIsSidebarOpen(false)}
            >
              <FileText className="w-5 h-5" />
              {isSidebarOpen && <span>Cuentas por pagar</span>}
            </Link>
            <Link
              href="/dashboard/orders"
              className="flex items-center gap-2 text-blue-700 font-medium"
              onClick={() => setIsSidebarOpen(false)}
            >
              <ShoppingCart className="w-5 h-5" />
              {isSidebarOpen && <span>Pedidos</span>}
            </Link>
            <Link
              href="/dashboard/tasks"
              className="flex items-center gap-2 text-blue-700 font-medium"
              onClick={() => setIsSidebarOpen(false)}
            >
              <FileText className="w-5 h-5" />
              {isSidebarOpen && <span>Cotizaciones pendientes</span>}
            </Link>
            <a
              href="https://botaguas2m.netlify.app/inventory"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-700 font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405M20 12a8 8 0 11-16 0 8 8 0 0116 0z"
                />
              </svg>
              {isSidebarOpen && <span>Inventario Botaguas</span>}
            </a>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 bg-white">{children}</main>
      </div>
    </div>
  );
}
