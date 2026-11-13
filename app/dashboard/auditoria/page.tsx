"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { Search, ChevronLeft, ChevronRight, X, ArrowRight } from "lucide-react";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete";
  description: string | null;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  before_data: Record<string, unknown> | null;
}

const ACTION_LABEL: Record<string, { label: string; style: string }> = {
  create: { label: "Creación",      style: "bg-green-50 text-green-700 border border-green-200" },
  update: { label: "Actualización", style: "bg-blue-50 text-blue-700 border border-blue-200" },
  delete: { label: "Eliminación",   style: "bg-red-50 text-red-600 border border-red-200" },
};

const TABLE_LABEL: Record<string, string> = {
  appointments:  "Citas",
  orders:        "Pedidos",
  customers:     "Clientes",
  vehicles:      "Vehículos",
  staff:         "Instaladores",
  pending_tasks: "Cotizaciones",
};

const FIELD_LABELS: Record<string, string> = {
  customer_name: "Cliente", phone: "Teléfono", vehicle: "Vehículo",
  status: "Estado", total_amount: "Monto total", initial_payment: "Abono",
  remaining: "Saldo pendiente", product_description: "Descripción",
  name: "Nombre", description: "Descripción", notes: "Notas",
  image_url: "Imagen", order_date: "Fecha pedido",
  assigned_person: "Asignado a", start_time: "Hora inicio",
  end_time: "Hora fin", appointment_date: "Fecha cita",
  placa: "Placa", cancel_reason: "Razón cancelación",
  abono: "Abono",
};

const HIDDEN_FIELDS = ["id", "customer_id", "vehicle_id", "created_at", "updated_at", "image_urls", "image_url"];

const PAGE_SIZE = 10;

function isDiffData(data: Record<string, unknown>): data is { _before: Record<string, unknown>; _after: Record<string, unknown> } {
  return "_before" in data && "_after" in data;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "number") return val.toLocaleString("es-CR");
  if (typeof val === "boolean") return val ? "Sí" : "No";
  return String(val);
}

function getChangedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return allKeys
    .filter(k => !HIDDEN_FIELDS.includes(k))
    .filter(k => {
      const b = before[k] ?? null;
      const a = after[k] ?? null;
      return String(b) !== String(a);
    });
}

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
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);

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
    if (search.trim()) q = q.or(`description.ilike.%${search.trim()}%,user_email.ilike.%${search.trim()}%,user_name.ilike.%${search.trim()}%`);

    const { data, count } = await q;
    setLogs((data ?? []) as AuditEntry[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, filterAction, filterTable]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(0); }, [search, filterAction, filterTable]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Auditoría</h1>
        <p className="text-sm text-gray-500 mt-0.5">Historial completo de acciones del sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por usuario, descripción…"
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
          <option value="">Todos los módulos</option>
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
                  <th className="px-4 py-3 text-left w-36">Fecha</th>
                  <th className="px-4 py-3 text-left w-32">Usuario</th>
                  <th className="px-4 py-3 text-left w-28">Acción</th>
                  <th className="px-4 py-3 text-left w-24">Módulo</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-left w-24">Cambios</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const action = ACTION_LABEL[log.action] ?? { label: log.action, style: "bg-gray-100 text-gray-600" };
                  const hasDiff = !!log.before_data && isDiffData(log.before_data);
                  const hasFlat = !!log.before_data && !hasDiff;
                  const changedCount = hasDiff
                    ? getChangedFields(
                        (log.before_data as { _before: Record<string, unknown> })._before,
                        (log.before_data as { _after: Record<string, unknown> })._after
                      ).length
                    : 0;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="transition-colors cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {format(new Date(log.created_at), "dd MMM yyyy", { locale: es })}
                        <span className="block text-gray-400">{format(new Date(log.created_at), "HH:mm")}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[128px] truncate text-xs" title={log.user_email ?? ""}>
                        <span className="font-medium">{log.user_name ?? log.user_email?.split("@")[0] ?? "—"}</span>
                        {log.user_email && <span className="block text-gray-400 truncate">{log.user_email}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${action.style}`}>
                          {action.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-medium">
                        {TABLE_LABEL[log.table_name] ?? log.table_name}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs">
                        <span className="line-clamp-2 text-xs" title={log.description ?? ""}>{log.description ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {hasDiff && changedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                            {changedCount} campo{changedCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {hasFlat && (
                          <span className="text-xs text-gray-400">Ver datos</span>
                        )}
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

      {/* Detail modal */}
      {selectedLog && (() => {
        const action = ACTION_LABEL[selectedLog.action] ?? { label: selectedLog.action, style: "bg-gray-100 text-gray-600" };
        const hasDiff = !!selectedLog.before_data && isDiffData(selectedLog.before_data);
        const before = hasDiff ? (selectedLog.before_data as { _before: Record<string, unknown> })._before : null;
        const after  = hasDiff ? (selectedLog.before_data as { _after: Record<string, unknown> })._after : null;
        const flatEntries = !hasDiff && selectedLog.before_data
          ? Object.entries(selectedLog.before_data).filter(([k, v]) => v !== null && v !== "" && !HIDDEN_FIELDS.includes(k))
          : [];
        const changedFields = hasDiff && before && after ? getChangedFields(before, after) : [];
        const unchangedFields = hasDiff && before
          ? Object.keys(before).filter(k => !HIDDEN_FIELDS.includes(k) && !changedFields.includes(k) && before[k] !== null && before[k] !== "")
          : [];

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${action.style}`}>
                    {action.label}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {TABLE_LABEL[selectedLog.table_name] ?? selectedLog.table_name}
                  </span>
                  {hasDiff && changedFields.length > 0 && (
                    <span className="text-xs text-gray-400">{changedFields.length} campo{changedFields.length !== 1 ? "s" : ""} modificado{changedFields.length !== 1 ? "s" : ""}</span>
                  )}
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Fecha y hora</p>
                    <p className="text-gray-800 font-medium">{format(new Date(selectedLog.created_at), "dd MMM yyyy, HH:mm:ss", { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Usuario</p>
                    <p className="text-gray-800 font-medium">{selectedLog.user_name ?? "—"}</p>
                    {selectedLog.user_email && <p className="text-xs text-gray-400">{selectedLog.user_email}</p>}
                  </div>
                  {selectedLog.description && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-0.5">Descripción</p>
                      <p className="text-gray-800">{selectedLog.description}</p>
                    </div>
                  )}
                </div>

                {/* Diff view for updates */}
                {hasDiff && before && after && (
                  <div>
                    {changedFields.length > 0 ? (
                      <>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Campos modificados</p>
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-3 py-2 text-left text-gray-500 font-semibold w-1/4">Campo</th>
                                <th className="px-3 py-2 text-left text-gray-500 font-semibold w-[37.5%]">Antes</th>
                                <th className="px-3 py-2 text-left text-gray-500 font-semibold w-[37.5%]">Después</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {changedFields.map(k => (
                                <tr key={k}>
                                  <td className="px-3 py-2 text-gray-500">{FIELD_LABELS[k] ?? k}</td>
                                  <td className="px-3 py-2 text-red-600 line-through break-words">{formatValue(before[k])}</td>
                                  <td className="px-3 py-2 text-green-700 font-medium break-words">
                                    <span className="flex items-center gap-1">
                                      <ArrowRight size={10} className="text-gray-400 shrink-0" />
                                      {formatValue(after[k])}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">Sin cambios detectados en los campos registrados</p>
                    )}

                    {unchangedFields.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600">
                          Ver campos sin cambios ({unchangedFields.length})
                        </summary>
                        <div className="mt-2 bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-x-6 gap-y-2">
                          {unchangedFields.map(k => (
                            <div key={k} className="text-xs">
                              <p className="text-gray-400">{FIELD_LABELS[k] ?? k}</p>
                              <p className="text-gray-700 break-words">{formatValue(before[k])}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Flat snapshot (delete or old-format logs) */}
                {flatEntries.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {selectedLog.action === "delete" ? "Datos eliminados" : "Estado anterior"}
                    </p>
                    <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-x-6 gap-y-2">
                      {flatEntries.map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <p className="text-gray-400">{FIELD_LABELS[k] ?? k}</p>
                          <p className="text-gray-800 font-medium break-words">{formatValue(v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasDiff && flatEntries.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">Sin datos adicionales registrados</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
