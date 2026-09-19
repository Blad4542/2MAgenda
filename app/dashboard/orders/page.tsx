"use client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { createClient } from "@/utils/supabase/client";
import { Plus, Trash2, Edit, ChevronLeft, ChevronRight, Search, X, Download, Clock } from "lucide-react";
import { exportCsv } from "@/utils/exportCsv";
import { logAction } from "@/utils/auditLog";
import Modal from "@/components/Modal";
import { v4 as uuidv4 } from "uuid";
import { waUrl, WaIcon } from "@/utils/wa";
import { inp, lbl } from "@/utils/styles";
import { lookupCustomer, findOrCreateCustomer } from "@/utils/customers";

type OrderStatus = "Por pedir" | "Pedido" | "En local" | "Entregado";

interface Order {
  id: string; order_date: string; customer_name: string; phone?: string;
  product_description?: string; total_amount: number; initial_payment: number;
  remaining: number; status?: OrderStatus; customer_id?: string;
}

interface AuditEntry {
  id: string; action: string; description: string | null; user_email: string | null; created_at: string;
}

const PAGE_SIZE = 20;

const actionLabel: Record<string, string> = { create: "Creado", update: "Editado", delete: "Eliminado" };

const STATUS_STYLES: Record<OrderStatus, string> = {
  "Por pedir": "bg-amber-50 text-amber-700 border border-amber-200",
  "Pedido":    "bg-blue-50 text-blue-700 border border-blue-200",
  "En local":  "bg-violet-50 text-violet-700 border border-violet-200",
  "Entregado": "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const STATUSES: OrderStatus[] = ["Por pedir", "Pedido", "En local", "Entregado"];

const emptyForm = { customer_name: "", phone: "", product_description: "", total_amount: 0, initial_payment: 0, status: "Por pedir" as OrderStatus, customer_id: "" };

export default function OrdersPage() {
  useRequireRole(["admin", "asistente"]);
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");

  const fetchOrders = useCallback(async (p = 0, s = search, owb = onlyWithBalance, sf = statusFilter) => {
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("order_date", { ascending: false })
      .range(from, to);
    if (s.trim()) q = q.or(`customer_name.ilike.%${s.trim()}%,phone.ilike.%${s.trim()}%`);
    if (owb) q = q.gt("remaining", 0);
    if (sf) q = q.eq("status", sf);
    const { data, count } = await q;
    if (data) setOrders(data as Order[]);
    if (count !== null) setTotal(count);
    setIsLoading(false);
  }, [supabase, search, onlyWithBalance, statusFilter]);

  useEffect(() => {
    fetchOrders();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserEmail(session.user.email);
    });
  }, []);

  const goToPage = (p: number) => { setPage(p); setSelected(new Set()); fetchOrders(p); };

  const handleSearch = (value: string) => { setSearch(value); setPage(0); setSelected(new Set()); fetchOrders(0, value, onlyWithBalance, statusFilter); };
  const handleBalanceFilter = (checked: boolean) => { setOnlyWithBalance(checked); setPage(0); setSelected(new Set()); fetchOrders(0, search, checked, statusFilter); };
  const handleStatusFilter = (sf: OrderStatus | "") => { setStatusFilter(sf); setPage(0); setSelected(new Set()); fetchOrders(0, search, onlyWithBalance, sf); };

  const onPhoneBlur = async () => {
    const digits = form.phone.replace(/\D/g, "");
    if (!digits || digits.length < 6) return;
    const match = await lookupCustomer(supabase, form.phone);
    if (match) setForm(f => ({ ...f, customer_name: f.customer_name || match.name, customer_id: match.id }));
  };

  const save = async () => {
    const remaining = Number(form.total_amount) - Number(form.initial_payment);
    let customerId = form.customer_id;
    const phone = String(form.phone || "").trim();
    if (phone && form.customer_name) {
      const c = await findOrCreateCustomer(supabase, phone, form.customer_name);
      if (c) customerId = c;
    }
    const payload = {
      customer_name: form.customer_name,
      phone: form.phone,
      product_description: form.product_description,
      total_amount: Number(form.total_amount),
      initial_payment: Number(form.initial_payment),
      remaining,
      status: form.status,
      customer_id: customerId || null,
    };
    if (editing) {
      await supabase.from("orders").update(payload).eq("id", editing.id);
      await logAction(supabase, { table_name: "orders", record_id: editing.id, action: "update", description: `Pedido de ${form.customer_name}`, user_email: userEmail });
    } else {
      const id = uuidv4();
      await supabase.from("orders").insert({ id, order_date: new Date().toISOString().split("T")[0], ...payload });
      await logAction(supabase, { table_name: "orders", record_id: id, action: "create", description: `Pedido de ${form.customer_name}`, user_email: userEmail });
    }
    setIsOpen(false); setForm(emptyForm); setEditing(null); fetchOrders(0);
  };

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (all: boolean) => setSelected(all ? new Set() : new Set(orders.map(o => o.id)));

  const bulkDel = async () => {
    const ids = Array.from(selected);
    await supabase.from("orders").delete().in("id", ids);
    await Promise.all(ids.map(id => {
      const o = orders.find(x => x.id === id);
      return logAction(supabase, { table_name: "orders", record_id: id, action: "delete", description: o ? `Pedido de ${o.customer_name}` : undefined, user_email: userEmail });
    }));
    setSelected(new Set()); fetchOrders(0);
  };

  const deleteOne = async (o: Order) => {
    await supabase.from("orders").delete().eq("id", o.id);
    await logAction(supabase, { table_name: "orders", record_id: o.id, action: "delete", description: `Pedido de ${o.customer_name}`, user_email: userEmail });
    fetchOrders(0);
  };

  const openHistory = async (o: Order) => {
    setHistoryOrder(o);
    setHistoryLoading(true);
    const { data } = await supabase.from("audit_log")
      .select("id, action, description, user_email, created_at")
      .eq("table_name", "orders").eq("record_id", o.id)
      .order("created_at", { ascending: false }).limit(20);
    setHistoryLogs((data as AuditEntry[]) ?? []);
    setHistoryLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const allSelected = orders.length > 0 && selected.size === orders.length;

  if (isLoading) return (
    <div className="p-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex justify-between items-center mb-8">
        <div><div className="h-7 w-24 bg-gray-200 rounded-lg mb-2" /><div className="h-4 w-48 bg-gray-100 rounded-lg" /></div>
        <div className="h-10 w-36 bg-gray-200 rounded-xl" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {[...Array(9)].map((_, i) => <th key={i} className="px-4 py-3"><div className="h-3 w-16 bg-gray-200 rounded" /></th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[...Array(8)].map((_, i) => (
              <tr key={i}>{[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-gray-100 w-20" /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de pedidos y abonos</p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button onClick={bulkDel} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <Trash2 size={16} /> Eliminar ({selected.size})
            </button>
          )}
          <button
            onClick={() => exportCsv(orders.map(o => ({ Fecha: o.order_date, Nombre: o.customer_name, Teléfono: o.phone ?? "", Descripción: o.product_description ?? "", Estado: o.status ?? "", Monto: o.total_amount, Abono: o.initial_payment, Restante: o.remaining })), "pedidos.csv")}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Download size={16} /> Exportar
          </button>
          <button
            onClick={() => { setEditing(null); setForm(emptyForm); setIsOpen(true); }}
            className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus size={16} /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search" placeholder="Buscar por nombre o teléfono..."
            value={search} onChange={e => handleSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
          />
          {search && (
            <button onClick={() => handleSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => handleStatusFilter(e.target.value as OrderStatus | "")}
          className="text-sm border border-gray-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8]"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={onlyWithBalance} onChange={e => handleBalanceFilter(e.target.checked)} className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]" />
          Solo con saldo pendiente
        </label>
        <span className="text-sm text-gray-400 ml-auto">{total} resultado{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={() => toggleAll(allSelected)} className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]" />
                </th>
                {["Fecha", "Nombre", "Teléfono", "Descripción", "Estado", "Monto", "Abono", "Restante", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(o => (
                <tr key={o.id} className={`transition-colors ${selected.has(o.id) ? "bg-[#07C3F8]/5" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]" />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{format(new Date(o.order_date), "dd/MM/yyyy", { locale: es })}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <span>{o.phone}</span>
                      {o.phone && (
                        <a href={waUrl(o.phone)} target="_blank" rel="noopener noreferrer" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                          <WaIcon />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{o.product_description}</td>
                  <td className="px-4 py-3">
                    {o.status && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[o.status] ?? "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                        {o.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap">₡{o.total_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap">₡{o.initial_payment.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#07C3F8] font-mono whitespace-nowrap">₡{o.remaining.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openHistory(o)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors">
                        <Clock size={14} />
                      </button>
                      <button
                        onClick={() => { setEditing(o); setForm({ customer_name: o.customer_name, phone: o.phone || "", product_description: o.product_description || "", total_amount: o.total_amount, initial_payment: o.initial_payment, status: o.status ?? "Por pedir", customer_id: o.customer_id || "" }); setIsOpen(true); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors"
                      >
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deleteOne(o)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">No hay pedidos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => goToPage(page - 1)} disabled={page === 0} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-sm text-gray-700 font-medium">{page + 1} / {totalPages}</span>
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? "Editar pedido" : "Nuevo pedido"}>
          <div className="space-y-4">
            <div>
              <label className={lbl}>Teléfono</label>
              <input className={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} onBlur={onPhoneBlur} placeholder="Ej: 85282245" />
            </div>
            <div>
              <label className={lbl}>Nombre</label>
              <input className={inp} value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Descripción</label>
              <input className={inp} value={form.product_description} onChange={e => setForm({ ...form, product_description: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as OrderStatus })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Monto total</label><input type="number" className={inp} value={form.total_amount} onChange={e => setForm({ ...form, total_amount: parseFloat(e.target.value) })} /></div>
              <div><label className={lbl}>Abono</label><input type="number" className={inp} value={form.initial_payment} onChange={e => setForm({ ...form, initial_payment: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={save} className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">Guardar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* History modal */}
      {historyOrder && (
        <Modal isOpen={!!historyOrder} onClose={() => setHistoryOrder(null)} title={`Historial — ${historyOrder.customer_name}`}>
          {historyLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Cargando...</div>
          ) : historyLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">Sin registros de cambios</div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {historyLogs.map(log => (
                <li key={log.id} className="py-3 flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${log.action === "create" ? "bg-emerald-50 text-emerald-600" : log.action === "update" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}>
                    {actionLabel[log.action] ?? log.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{log.description ?? "—"}</p>
                    <p className="text-xs text-gray-400">{log.user_email ?? "—"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: es })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
