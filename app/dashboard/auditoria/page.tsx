"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete";
  description: string | null;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, { label: string; style: string }> = {
  create: { label: "Creación",     style: "bg-green-50 text-green-700 border border-green-200" },
  update: { label: "Actualización", style: "bg-blue-50 text-blue-700 border border-blue-200" },
  delete: { label: "Eliminación",  style: "bg-red-50 text-red-600 border border-red-200" },
};

const TABLE_LABEL: Record<string, string> = {
  appointments: "Citas",
  orders:       "Pedidos",
  customers:    "Clientes",
  vehicles:     "Vehículos",
  staff:        "Instaladores",
  pending_tasks:"Cotizaciones",
};

const PAGE_SIZE = 10;

export default function AuditoriaPage() {
  useRequireRole(["admin"]);

  const supabase = createClient();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterTable, setFilterTable] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filterAction) q = q.eq("action", filterAction);
    if (filterTable)  q = q.eq("table_name", filterTable);
    if (search.trim()) q = q.or(`description.ilike.%${search.trim()}%,user_email.ilike.%${search.trim()}%`);

    const { data, count } = await q;
    setLogs((data ?? []) as AuditEntry[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, filterAction, filterTable]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [search, filterAction, filterTable]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Auditoría</h1>
        <p className="text-sm text-gray-500 mt-0.5">Historial de acciones del sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por usuario o descripción…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#07C3F8]/30"
          />
        </div>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#07C3F8]/30 bg-white"
        >
          <option value="">Todas las acciones</option>
          <option value="create">Creación</option>
          <option value="update">Actualización</option>
          <option value="delete">Eliminación</option>
        </select>
        <select
          value={filterTable}
          onChange={e => setFilterTable(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#07C3F8]/30 bg-white"
        >
          <option value="">Todas las tablas</option>
          {Object.entries(TABLE_LABEL).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Cargando…</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">Sin registros</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Acción</th>
                  <th className="px-4 py-3 text-left">Módulo</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const action = ACTION_LABEL[log.action] ?? { label: log.action, style: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={log.user_email ?? ""}>
                        {log.user_name ?? log.user_email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${action.style}`}>
                          {action.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {TABLE_LABEL[log.table_name] ?? log.table_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={log.description ?? ""}>
                        {log.description ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{total} registros</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Página {page + 1} de {totalPages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
