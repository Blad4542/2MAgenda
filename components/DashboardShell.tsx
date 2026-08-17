"use client";

import { memo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  Home, Calendar, FileText, ShoppingCart, LogOut, Droplets, Menu, X, Users,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",           icon: Home,         label: "Inicio" },
  { href: "/dashboard/agenda",    icon: Calendar,     label: "Agenda" },
  { href: "/dashboard/orders",    icon: ShoppingCart, label: "Pedidos" },
  { href: "/dashboard/tasks",     icon: FileText,     label: "Cotizaciones pendientes" },
  { href: "/dashboard/botaguas",  icon: Droplets,     label: "Inventario Botaguas" },
  { href: "/dashboard/clientes",  icon: Users,        label: "Clientes" },
];

const SidebarNav = memo(function SidebarNav({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-0.5 p-3 flex-1">
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-[#07C3F8]/10 text-[#07C3F8]"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
});

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          {/* Hamburger — only on mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileOpen}
            aria-controls="mobile-sidebar"
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-7 bg-[#07C3F8] rounded-full" aria-hidden="true" />
            <span className="font-bold text-gray-900 text-sm">
              Auto<span className="text-[#07C3F8]">decoración</span> 2M
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline font-medium">Cerrar sesión</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar — always visible with labels ── */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">
          <SidebarNav pathname={pathname} />
        </aside>

        {/* ── Mobile sidebar overlay ── */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 top-14 z-[70] bg-black/40 md:hidden"
              aria-hidden="true"
              onClick={() => setMobileOpen(false)}
            />
            <div
              id="mobile-sidebar"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
              className="fixed top-14 bottom-0 left-0 z-[80] w-64 bg-white border-r border-gray-200 flex flex-col md:hidden"
            >
              <div className="flex items-center justify-end px-3 pt-3">
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Cerrar menú de navegación"
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <SidebarNav pathname={pathname} onNav={() => setMobileOpen(false)} />
            </div>
          </>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
