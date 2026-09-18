"use client";

import { memo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  Home, Calendar, FileText, ShoppingCart, LogOut, Droplets, Menu, X, Users, HardHat, ChevronLeft, ChevronRight,
} from "lucide-react";

const baseNavItems = [
  { href: "/dashboard",              icon: Home,         label: "Inicio",                   adminOnly: false },
  { href: "/dashboard/agenda",       icon: Calendar,     label: "Agenda",                   adminOnly: false },
  { href: "/dashboard/orders",       icon: ShoppingCart, label: "Pedidos",                  adminOnly: false },
  { href: "/dashboard/tasks",        icon: FileText,     label: "Cotizaciones pendientes",   adminOnly: false },
  { href: "/dashboard/botaguas",     icon: Droplets,     label: "Inventario Botaguas",      adminOnly: false },
  { href: "/dashboard/clientes",     icon: Users,        label: "Clientes",                 adminOnly: false },
  { href: "/dashboard/instaladores", icon: HardHat,      label: "Instaladores",             adminOnly: true  },
];

const SidebarNav = memo(function SidebarNav({
  pathname,
  isAdmin,
  onNav,
  collapsed,
}: {
  pathname: string;
  isAdmin: boolean;
  onNav?: () => void;
  collapsed?: boolean;
}) {
  const items = baseNavItems.filter(item => !item.adminOnly || isAdmin);
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-0.5 p-2 flex-1">
      {items.map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            title={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
            } ${
              active
                ? "bg-[#07C3F8]/10 text-[#07C3F8]"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
});

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata;
      setDisplayName(meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "");
      supabase
        .from("user_roles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()
        .then(({ data: roleData }) => {
          setIsAdmin(roleData?.role === "admin");
        });
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
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

        <div className="flex items-center gap-3">
          {displayName && (
            <span className="hidden sm:block text-sm font-medium text-gray-700">Hola, {displayName}!</span>
          )}
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline font-medium">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar ── */}
        <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all duration-200 ${collapsed ? "w-14" : "w-56"}`}>
          <SidebarNav pathname={pathname} isAdmin={isAdmin} collapsed={collapsed} />
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {collapsed
                ? <ChevronRight className="w-4 h-4" aria-hidden="true" />
                : <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              }
            </button>
          </div>
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
              <SidebarNav pathname={pathname} isAdmin={isAdmin} onNav={() => setMobileOpen(false)} />
            </div>
          </>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
