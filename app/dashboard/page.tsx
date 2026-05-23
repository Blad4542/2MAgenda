import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { Calendar, ClipboardList, ShoppingBag, Package, AlertCircle } from "lucide-react";

export default async function DashboardHome() {
  const supabase = await createClient();

  const today = new Date();
  const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(today); endOfDay.setHours(23, 59, 59, 999);

  const [
    { data: appointments },
    { data: tasks },
    { data: orders },
    { data: lowStock },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, name, phone, vehicle, start_time, status, assigned_person")
      .gte("appointment_date", startOfDay.toISOString())
      .lt("appointment_date",  endOfDay.toISOString())
      .order("start_time", { ascending: true }),

    supabase.from("pending_tasks").select("id, status"),

    supabase
      .from("orders")
      .select("id, customer_name, remaining, order_date")
      .gt("remaining", 0)
      .order("order_date", { ascending: false }),

    supabase
      .from("botaguas")
      .select("id, brand, model, year_start, quantity")
      .eq("quantity", 0),
  ]);

  const appts      = appointments ?? [];
  const taskList   = tasks        ?? [];
  const orderList  = orders       ?? [];
  const lowList    = lowStock     ?? [];

  const apptPending = appts.filter(a => a.status === "pending").length;
  const apptActive  = appts.filter(a => a.status === "active").length;
  const apptDone    = appts.filter(a => a.status === "done").length;

  const taskPending = taskList.filter(t => t.status === "Pending").length;
  const taskQuoting = taskList.filter(t => t.status === "Quoting").length;

  const totalRemaining = orderList.reduce((sum, o) => sum + (o.remaining ?? 0), 0);

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const upcoming = appts
    .filter(a => {
      const [h, m] = a.start_time.split(":").map(Number);
      return h * 60 + m >= nowMinutes && a.status !== "done";
    })
    .slice(0, 5);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Resumen del día</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">
          {today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/dashboard/agenda" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Citas hoy</span>
            <div className="w-9 h-9 rounded-xl bg-[#07C3F8]/10 flex items-center justify-center">
              <Calendar size={18} className="text-[#07C3F8]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{appts.length}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-sky-500">{apptPending} pendiente{apptPending !== 1 ? "s" : ""}</span>
            <span className="text-amber-500">{apptActive} activa{apptActive !== 1 ? "s" : ""}</span>
            <span className="text-emerald-500">{apptDone} {apptDone !== 1 ? "listas" : "lista"}</span>
          </div>
        </Link>

        <Link href="/dashboard/tasks" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Cotizaciones</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <ClipboardList size={18} className="text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{taskPending + taskQuoting}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-amber-600">{taskPending} pendiente{taskPending !== 1 ? "s" : ""}</span>
            <span className="text-blue-500">{taskQuoting} cotizando</span>
          </div>
        </Link>

        <Link href="/dashboard/orders" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Saldo por cobrar</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShoppingBag size={18} className="text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 font-mono">
            ₡{totalRemaining.toLocaleString("es-CR", { minimumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-gray-500">{orderList.length} pedido{orderList.length !== 1 ? "s" : ""} con saldo</p>
        </Link>

        <Link href="/dashboard/botaguas" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Sin inventario</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${lowList.length > 0 ? "bg-red-50" : "bg-gray-100"}`}>
              {lowList.length > 0
                ? <AlertCircle size={18} className="text-red-500" />
                : <Package size={18} className="text-gray-400" />
              }
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{lowList.length}</p>
          <p className="mt-2 text-xs text-gray-500">
            {lowList.length > 0 ? "Referencias agotadas" : "Todo en stock"}
          </p>
        </Link>
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming appointments */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Próximas citas</h2>
            <Link href="/dashboard/agenda" className="text-xs text-[#07C3F8] font-medium hover:underline">
              Ver agenda
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">No hay citas próximas para hoy</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {upcoming.map(a => (
                <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="mt-0.5 text-xs font-mono text-gray-400 w-10 shrink-0">{a.start_time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                    <p className="text-xs text-gray-400 truncate">{a.vehicle} · {a.assigned_person}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.status === "pending" ? "bg-sky-50 text-sky-600"
                    : a.status === "active" ? "bg-amber-50 text-amber-600"
                    : "bg-emerald-50 text-emerald-600"
                  }`}>
                    {a.status === "pending" ? "Pendiente" : a.status === "active" ? "Activa" : "Lista"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Orders with remaining balance */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pedidos con saldo</h2>
            <Link href="/dashboard/orders" className="text-xs text-[#07C3F8] font-medium hover:underline">
              Ver pedidos
            </Link>
          </div>
          {orderList.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">No hay pedidos con saldo pendiente</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {orderList.slice(0, 5).map(o => (
                <li key={o.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{o.customer_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(o.order_date + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#07C3F8] font-mono shrink-0">
                    ₡{o.remaining.toLocaleString("es-CR", { minimumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
