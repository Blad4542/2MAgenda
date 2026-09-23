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
import { lookupCustomer, findOrCreateCustomer, getCustomerVehicles, findOrCreateVehicle, buildVehicleDescription, vehicleLabel, type VehicleRecord } from "@/utils/customers";

type OrderStatus = "Por pedir" | "Pedido" | "En local" | "Entregado";

interface Order {
  id: string; order_date: string; customer_name: string; phone?: string;
  product_description?: string; total_amount: number; initial_payment: number;
  remaining: number; status?: OrderStatus; customer_id?: string;
  vehicle?: string; vehicle_id?: string;
}

interface AuditEntry {
  id: string; action: string; description: string | null; user_email: string | null; created_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  description: string;
  price?: number | null;
  completed?: boolean;
}

const PAGE_SIZE = 10;

const actionLabel: Record<string, string> = { create: "Creado", update: "Editado", delete: "Eliminado" };

const STATUS_STYLES: Record<OrderStatus, string> = {
  "Por pedir": "bg-amber-50 text-amber-700 border border-amber-200",
  "Pedido":    "bg-blue-50 text-blue-700 border border-blue-200",
  "En local":  "bg-violet-50 text-violet-700 border border-violet-200",
  "Entregado": "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const STATUSES: OrderStatus[] = ["Por pedir", "Pedido", "En local", "Entregado"];
const ACTIVE_STATUSES: OrderStatus[] = ["Por pedir", "Pedido", "En local"];

const emptyForm = {
  customer_name: "", phone: "", product_description: "",
  total_amount: 0, initial_payment: 0, status: "Por pedir" as OrderStatus,
  customer_id: "", vehicle: "", vehicle_id: "",
};

function OrderTable({ list, title, orderItemDescriptions, onEdit, onDelete, onHistory }: {
  list: Order[]; title: string;
  orderItemDescriptions: Record<string, string[]>;
  onEdit: (o: Order) => void; onDelete: (o: Order) => void; onHistory: (o: Order) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const paginated = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [list.length]);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-400 bg-white">
          Sin pedidos en esta sección
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Fecha", "Nombre", "Teléfono", "Vehículo", "Tareas", "Estado", "Monto", "Abono", "Restante", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{format(new Date(o.order_date), "dd/MM/yyyy", { locale: es })}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{o.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <span className="whitespace-nowrap">{o.phone}</span>
                        {o.phone && (
                          <a href={waUrl(o.phone)} target="_blank" rel="noopener noreferrer" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                            <WaIcon />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[120px] truncate">{o.vehicle || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                      {(orderItemDescriptions[o.id] ?? []).length > 0 ? (
                        <div className="space-y-0.5">
                          {(orderItemDescriptions[o.id] ?? []).slice(0, 3).map((d, i) => (
                            <div key={i} className="flex items-start gap-1 text-xs text-gray-600">
                              <span className="text-gray-400 shrink-0">•</span>
                              <span className="truncate">{d}</span>
                            </div>
                          ))}
                          {(orderItemDescriptions[o.id] ?? []).length > 3 && (
                            <span className="text-xs text-[#07C3F8]">+{(orderItemDescriptions[o.id] ?? []).length - 3} más</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">{o.product_description || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {o.status && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[o.status] ?? "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                          {o.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap">₡{o.total_amount.toLocaleString("es-CR")}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap">₡{o.initial_payment.toLocaleString("es-CR")}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#07C3F8] font-mono whitespace-nowrap">₡{o.remaining.toLocaleString("es-CR")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onHistory(o)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"><Clock size={14} /></button>
                        <button onClick={() => onEdit(o)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors"><Edit size={14} /></button>
                        <button onClick={() => onDelete(o)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-400">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, list.length)} de {list.length}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  useRequireRole(["admin", "asistente"]);
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [customerVehicles, setCustomerVehicles] = useState<VehicleRecord[]>([]);
  const [isNewVehicle, setIsNewVehicle] = useState(true);
  const [vehicleFields, setVehicleFields] = useState({ make: "", model: "", year: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [orderItemDescriptions, setOrderItemDescriptions] = useState<Record<string, string[]>>({});

  const fetchOrders = useCallback(async (s = search, owb = onlyWithBalance) => {
    let q = supabase.from("orders").select("*").order("order_date", { ascending: false });
    if (s.trim()) q = q.or(`customer_name.ilike.%${s.trim()}%,phone.ilike.%${s.trim()}%,vehicle.ilike.%${s.trim()}%`);
    if (owb) q = q.gt("remaining", 0);
    const { data } = await q;
    if (data) {
      setOrders(data as Order[]);
      const ids = (data as Order[]).map(o => o.id);
      if (ids.length > 0) {
        const { data: items } = await supabase.from("order_items").select("order_id, description").in("order_id", ids);
        if (items) {
          const descs: Record<string, string[]> = {};
          for (const item of items) {
            if (!descs[item.order_id]) descs[item.order_id] = [];
            descs[item.order_id].push(item.description);
          }
          setOrderItemDescriptions(descs);
        }
      }
    }
    setIsLoading(false);
  }, [supabase, search, onlyWithBalance]);

  useEffect(() => {
    fetchOrders();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserEmail(session.user.email);
    });
  }, []);

  const handleSearch = (value: string) => { setSearch(value); fetchOrders(value, onlyWithBalance); };
  const handleBalanceFilter = (checked: boolean) => { setOnlyWithBalance(checked); fetchOrders(search, checked); };

  const onPhoneBlur = async () => {
    const digits = form.phone.replace(/\D/g, "");
    if (!digits || digits.length < 6) return;
    const match = await lookupCustomer(supabase, form.phone);
    if (!match) { setCustomerVehicles([]); setIsNewVehicle(true); return; }
    const vehicles = await getCustomerVehicles(supabase, match.id);
    setCustomerVehicles(vehicles);
    setIsNewVehicle(vehicles.length === 0);
    const firstV = vehicles[0];
    if (firstV) setVehicleFields({ make: firstV.make ?? "", model: firstV.model ?? "", year: firstV.year ? String(firstV.year) : "" });
    setForm(f => ({
      ...f,
      customer_name: f.customer_name || match.name,
      customer_id: match.id,
      vehicle_id: firstV?.id ?? "",
      vehicle: firstV ? vehicleLabel(firstV) : f.vehicle,
    }));
  };

  const onVehicleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") {
      setIsNewVehicle(true);
      setVehicleFields({ make: "", model: "", year: "" });
      setForm(f => ({ ...f, vehicle: "", vehicle_id: "" }));
    } else {
      const found = customerVehicles.find(v => v.id === val);
      if (found) {
        setIsNewVehicle(false);
        setVehicleFields({ make: found.make ?? "", model: found.model ?? "", year: found.year ? String(found.year) : "" });
        setForm(f => ({ ...f, vehicle: vehicleLabel(found), vehicle_id: found.id }));
      }
    }
  };

  const addItem = async (orderId?: string) => {
    if (!newItemText.trim()) return;
    const id = uuidv4();
    const desc = newItemText.trim();
    const price = newItemPrice !== "" ? parseFloat(newItemPrice) : null;
    if (orderId) {
      await supabase.from("order_items").insert({ id, order_id: orderId, description: desc, price });
      setOrderItemDescriptions(prev => ({ ...prev, [orderId]: [...(prev[orderId] ?? []), desc] }));
    }
    setDetailItems(prev => [...prev, { id, order_id: orderId ?? "", description: desc, price }]);
    setNewItemText("");
    setNewItemPrice("");
  };

  const updateItemPrice = async (itemId: string, price: number | null, orderId?: string) => {
    setDetailItems(prev => prev.map(i => i.id === itemId ? { ...i, price } : i));
    if (orderId) await supabase.from("order_items").update({ price }).eq("id", itemId);
  };

  const toggleItemCompleted = async (itemId: string, completed: boolean, orderId?: string) => {
    setDetailItems(prev => prev.map(i => i.id === itemId ? { ...i, completed } : i));
    if (orderId) await supabase.from("order_items").update({ completed }).eq("id", itemId);
  };

  const removeItem = async (itemId: string, orderId?: string) => {
    if (orderId) {
      const removed = detailItems.find(i => i.id === itemId);
      await supabase.from("order_items").delete().eq("id", itemId);
      if (removed) {
        setOrderItemDescriptions(prev => {
          const arr = [...(prev[orderId] ?? [])];
          const idx = arr.indexOf(removed.description);
          if (idx > -1) arr.splice(idx, 1);
          return { ...prev, [orderId]: arr };
        });
      }
    }
    setDetailItems(prev => prev.filter(i => i.id !== itemId));
  };

  const openEdit = async (o: Order) => {
    setEditing(o);
    setForm({
      customer_name: o.customer_name, phone: o.phone || "",
      product_description: o.product_description || "",
      total_amount: o.total_amount, initial_payment: o.initial_payment,
      status: o.status ?? "Por pedir", customer_id: o.customer_id || "",
      vehicle: o.vehicle || "", vehicle_id: o.vehicle_id || "",
    });
    setVehicleFields({ make: "", model: "", year: "" });
    setCustomerVehicles([]);
    setIsNewVehicle(true);
    setDetailItems([]);
    setNewItemText("");
    setNewItemPrice("");
    const { data: items } = await supabase.from("order_items").select("id, order_id, description, price, completed").eq("order_id", o.id);
    setDetailItems((items ?? []) as OrderItem[]);
    if (o.customer_id) {
      const vehicles = await getCustomerVehicles(supabase, o.customer_id);
      setCustomerVehicles(vehicles);
      if (o.vehicle_id) {
        const veh = vehicles.find(v => v.id === o.vehicle_id);
        if (veh) {
          setIsNewVehicle(false);
          setVehicleFields({ make: veh.make ?? "", model: veh.model ?? "", year: veh.year ? String(veh.year) : "" });
        } else {
          setIsNewVehicle(true);
        }
      } else {
        setIsNewVehicle(vehicles.length === 0);
      }
    }
    setFormError("");
    setIsOpen(true);
  };

  const save = async () => {
    const name = form.customer_name.trim();
    if (!name) { setFormError("Nombre es obligatorio."); return; }
    setFormError("");
    setSaving(true);
    try {
      let customerId = form.customer_id || undefined;
      let vehicleId = form.vehicle_id || undefined;
      const phone = form.phone.trim();
      if (phone && name) {
        const c = await findOrCreateCustomer(supabase, phone, name);
        if (c) customerId = c;
        const vDesc = buildVehicleDescription(vehicleFields.make, vehicleFields.model, vehicleFields.year) || form.vehicle || "";
        if (customerId && vDesc.trim()) {
          vehicleId = await findOrCreateVehicle(supabase, customerId, { make: vehicleFields.make, model: vehicleFields.model, year: vehicleFields.year, description: vDesc });
        }
      }
      const vehicleText = buildVehicleDescription(vehicleFields.make, vehicleFields.model, vehicleFields.year) || form.vehicle || "";
      const payload = {
        customer_name: name, phone, product_description: form.product_description?.trim() || null,
        total_amount: Number(form.total_amount) || 0, initial_payment: Number(form.initial_payment) || 0,
        status: form.status, customer_id: customerId || null,
        vehicle: vehicleText || null, vehicle_id: vehicleId || null,
      };
      if (editing) {
        const { error } = await supabase.from("orders").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
        await logAction(supabase, { table_name: "orders", record_id: editing.id, action: "update", description: `Pedido de ${name}`, user_email: userEmail });
      } else {
        const id = uuidv4();
        const { error } = await supabase.from("orders").insert({ id, order_date: new Date().toISOString().split("T")[0], ...payload });
        if (error) throw new Error(error.message);
        if (detailItems.length > 0) {
          await supabase.from("order_items").insert(detailItems.map(item => ({ id: item.id, order_id: id, description: item.description, price: item.price ?? null })));
        }
        await logAction(supabase, { table_name: "orders", record_id: id, action: "create", description: `Pedido de ${name}`, user_email: userEmail });
      }
      setIsOpen(false);
      setForm(emptyForm);
      setEditing(null);
      setCustomerVehicles([]);
      setVehicleFields({ make: "", model: "", year: "" });
      setDetailItems([]);
      setNewItemText("");
      setNewItemPrice("");
      fetchOrders();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const deleteOne = async (o: Order) => {
    await supabase.from("orders").delete().eq("id", o.id);
    await logAction(supabase, { table_name: "orders", record_id: o.id, action: "delete", description: `Pedido de ${o.customer_name}`, user_email: userEmail });
    fetchOrders();
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter(o => {
      if (onlyWithBalance && o.remaining <= 0) return false;
      if (!term) return true;
      return (
        o.customer_name.toLowerCase().includes(term) ||
        (o.phone ?? "").toLowerCase().includes(term) ||
        (o.vehicle ?? "").toLowerCase().includes(term)
      );
    });
  }, [orders, search, onlyWithBalance]);

  const activeOrders = filtered.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus));
  const deliveredOrders = filtered.filter(o => o.status === "Entregado");

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
            {[...Array(6)].map((_, i) => (
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
          <button
            onClick={() => exportCsv(orders.map(o => ({ Fecha: o.order_date, Nombre: o.customer_name, Teléfono: o.phone ?? "", Vehículo: o.vehicle ?? "", Descripción: o.product_description ?? "", Estado: o.status ?? "", Monto: o.total_amount, Abono: o.initial_payment, Restante: o.remaining })), "pedidos.csv")}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Download size={16} /> Exportar
          </button>
          <button
            onClick={() => { setEditing(null); setForm(emptyForm); setCustomerVehicles([]); setVehicleFields({ make: "", model: "", year: "" }); setIsNewVehicle(true); setFormError(""); setDetailItems([]); setNewItemText(""); setNewItemPrice(""); setIsOpen(true); }}
            className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus size={16} /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search" placeholder="Buscar por nombre, teléfono o vehículo..."
            value={search} onChange={e => handleSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
          />
          {search && (
            <button onClick={() => handleSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={onlyWithBalance} onChange={e => handleBalanceFilter(e.target.checked)} className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]" />
          Solo con saldo pendiente
        </label>
        <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <OrderTable list={activeOrders} title="Activos" orderItemDescriptions={orderItemDescriptions} onEdit={openEdit} onDelete={deleteOne} onHistory={openHistory} />
      <OrderTable list={deliveredOrders} title="Entregados" orderItemDescriptions={orderItemDescriptions} onEdit={openEdit} onDelete={deleteOne} onHistory={openHistory} />

      {/* Modal */}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => { setIsOpen(false); setFormError(""); }} title={editing ? "Editar pedido" : "Nuevo pedido"}>
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
              <label className={lbl}>Vehículo</label>
              {customerVehicles.length > 0 && (
                <select className={inp} value={isNewVehicle ? "__new__" : (form.vehicle_id ?? "")} onChange={onVehicleSelect}>
                  {customerVehicles.map(v => <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}
                  <option value="__new__">+ Nuevo vehículo</option>
                </select>
              )}
              {(customerVehicles.length === 0 || isNewVehicle) && (
                <div className={`grid grid-cols-3 gap-2 ${customerVehicles.length > 0 ? "mt-2" : ""}`}>
                  <input className={inp} placeholder="Marca" value={vehicleFields.make} onChange={e => { const u = { ...vehicleFields, make: e.target.value }; setVehicleFields(u); setForm(f => ({ ...f, vehicle: buildVehicleDescription(u.make, u.model, u.year) })); }} />
                  <input className={inp} placeholder="Modelo" value={vehicleFields.model} onChange={e => { const u = { ...vehicleFields, model: e.target.value }; setVehicleFields(u); setForm(f => ({ ...f, vehicle: buildVehicleDescription(u.make, u.model, u.year) })); }} />
                  <input className={inp} placeholder="Año" value={vehicleFields.year} onChange={e => { const u = { ...vehicleFields, year: e.target.value }; setVehicleFields(u); setForm(f => ({ ...f, vehicle: buildVehicleDescription(u.make, u.model, u.year) })); }} />
                </div>
              )}
            </div>
            {/* Tareas */}
            {(() => {
              const subtotal = detailItems.reduce((s, i) => s + (i.price ?? 0), 0);
              return (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tareas</h3>
                  {detailItems.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">Sin tareas aún</p>
                  ) : (
                    <ul className="space-y-1.5 mb-3">
                      {detailItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 group">
                          <input
                            type="checkbox"
                            checked={item.completed ?? false}
                            onChange={e => toggleItemCompleted(item.id, e.target.checked, editing?.id)}
                            className="w-4 h-4 rounded accent-[#07C3F8] cursor-pointer shrink-0"
                          />
                          <span className={`flex-1 text-sm min-w-0 break-words ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}>{item.description}</span>
                          <input
                            type="number"
                            value={item.price ?? ""}
                            onChange={e => updateItemPrice(item.id, e.target.value !== "" ? parseFloat(e.target.value) : null, editing?.id)}
                            placeholder="₡"
                            min="0"
                            className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                          />
                          <button onClick={() => removeItem(item.id, editing?.id)} aria-label="Eliminar tarea" className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-all shrink-0">
                            <X size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {subtotal > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-gray-700 mb-3 px-0.5">
                      <span>Subtotal tareas</span>
                      <span>₡{subtotal.toLocaleString("es-CR")}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      className={`${inp} flex-1`}
                      placeholder="Nueva tarea..."
                      value={newItemText}
                      onChange={e => setNewItemText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(editing?.id); } }}
                    />
                    <input
                      type="number"
                      value={newItemPrice}
                      onChange={e => setNewItemPrice(e.target.value)}
                      placeholder="₡ Precio"
                      min="0"
                      className="w-24 text-sm border border-gray-300 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#07C3F8]"
                    />
                    <button onClick={() => addItem(editing?.id)} disabled={!newItemText.trim()} className="px-3 py-2 rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white text-sm font-semibold disabled:opacity-40 transition-colors shrink-0">
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              );
            })()}
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as OrderStatus })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Monto total</label><input type="number" className={inp} value={form.total_amount} onChange={e => setForm({ ...form, total_amount: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={lbl}>Abono</label><input type="number" className={inp} value={form.initial_payment} onChange={e => setForm({ ...form, initial_payment: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end pt-2">
              <button onClick={save} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar"}
              </button>
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
            <ul className="divide-y divide-gray-100">
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
