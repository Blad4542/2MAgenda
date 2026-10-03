"use client";

import { memo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  Home, Calendar, FileText, ShoppingCart, LogOut, Droplets, Menu, X, Users, HardHat, ChevronLeft, ChevronRight, ClipboardList, Bell,
} from "lucide-react";
import { RoleContext, type Role } from "@/contexts/RoleContext";

const baseNavItems = [
  { href: "/dashboard",              icon: Home,         label: "Inicio",                  roles: ["admin"] as Role[] },
  { href: "/dashboard/agenda",       icon: Calendar,     label: "Agenda",                  roles: ["admin", "tecnico", "asistente", "botaguas"] as Role[] },
  { href: "/dashboard/orders",       icon: ShoppingCart, label: "Pedidos",                 roles: ["admin", "asistente"] as Role[] },
  { href: "/dashboard/tasks",        icon: FileText,     label: "Cotizaciones",            roles: ["admin", "asistente"] as Role[] },
  { href: "/dashboard/botaguas",     icon: Droplets,     label: "Inventario Botaguas",     roles: ["admin", "asistente", "botaguas"] as Role[] },
  { href: "/dashboard/clientes",     icon: Users,        label: "Clientes",                roles: ["admin", "asistente"] as Role[] },
  { href: "/dashboard/instaladores", icon: HardHat,      label: "Instaladores",            roles: ["admin"] as Role[] },
  { href: "/dashboard/auditoria",    icon: ClipboardList, label: "Auditoría",               roles: ["admin"] as Role[] },
];

const SidebarNav = memo(function SidebarNav({
  pathname,
  role,
  onNav,
  collapsed,
}: {
  pathname: string;
  role: Role | null;
  onNav?: () => void;
  collapsed?: boolean;
}) {
  const items = baseNavItems.filter(item => !role || item.roles.includes(role));
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

interface Notif {
  id: string;
  type: "order" | "quote";
  message: string;
  record_id: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return "ayer";
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [roleData, setRoleData] = useState<{ role: Role; staffId: string | null }>({ role: "asistente", staffId: null });
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [navigating, setNavigating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    setNavigating(true);
    const t = setTimeout(() => setNavigating(false), 400);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata;
      setDisplayName(meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "");
      setUserId(data.user.id);
      supabase
        .from("user_roles")
        .select("role, staff_id")
        .eq("id", data.user.id)
        .maybeSingle()
        .then(({ data: rd }) => {
          setRoleData({ role: (rd?.role as Role) ?? "asistente", staffId: rd?.staff_id ?? null });
          setRoleLoaded(true);
        });
    });
  }, []);

  // Fetch initial notifications (admin only)
  useEffect(() => {
    if (!userId || roleData.role !== "admin") return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setNotifications(data as Notif[]);
      });
  }, [userId, roleData.role]);

  // Realtime subscription (admin only)
  useEffect(() => {
    if (!userId || roleData.role !== "admin") return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        ({ new: n }) => setNotifications(prev => [n as Notif, ...prev])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, roleData.role]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const openNotifications = async () => {
    setNotifOpen(v => !v);
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

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

      {/* ── Nav progress bar ── */}
      <div className={`fixed top-0 left-0 z-[999] h-0.5 bg-[#07C3F8] transition-all duration-300 ease-out ${navigating ? "w-3/4 opacity-100" : "w-full opacity-0"}`} />

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

          {/* Bell — admin only */}
          {roleData.role === "admin" && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={openNotifications}
                aria-label="Notificaciones"
                className="relative p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-9 z-[200] w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-[#07C3F8] hover:underline">
                        Marcar todo como leído
                      </button>
                    )}
                  </div>
                  <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 && (
                      <li className="px-4 py-6 text-center text-sm text-gray-400">Sin notificaciones</li>
                    )}
                    {notifications.map(n => (
                      <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.read ? "bg-white" : "bg-blue-50"}`}>
                        <span className="text-lg shrink-0">{n.type === "order" ? "📦" : "📋"}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
          {roleLoaded && <SidebarNav pathname={pathname} role={roleData.role} collapsed={collapsed} />}
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
              {roleLoaded && <SidebarNav pathname={pathname} role={roleData.role} onNav={() => setMobileOpen(false)} />}
            </div>
          </>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          <RoleContext.Provider value={roleData}>
            {children}
          </RoleContext.Provider>
        </main>
      </div>
    </div>
  );
}
