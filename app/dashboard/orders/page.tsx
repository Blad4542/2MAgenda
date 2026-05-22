"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { createClient } from "@/utils/supabase/client";
import { Plus, Trash2, Edit } from "lucide-react";
import Modal from "@/components/Modal";
import { v4 as uuidv4 } from "uuid";

interface Order {
  id: string; order_date: string; customer_name: string; phone?: string;
  product_description?: string; total_amount: number; initial_payment: number;
  remaining: number; provider?: string; created_by?: string;
}

const inp = "w-full border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors";
const lbl = "block text-sm font-medium text-gray-700 mb-1.5";

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState({ customer_name: "", phone: "", product_description: "", total_amount: 0, initial_payment: 0, provider: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("order_date", { ascending: false });
    if (data) setOrders(data as Order[]);
  };
  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("user_roles").select("role").eq("id", session.user.id).single();
    if (data?.role === "admin") setIsAdmin(true);
  };
  useEffect(() => { fetchOrders(); checkAdmin(); }, []);

  const save = async () => {
    const remaining = Number(form.total_amount) - Number(form.initial_payment);
    if (editing) {
      await supabase.from("orders").update({ ...form, total_amount: Number(form.total_amount), initial_payment: Number(form.initial_payment), remaining }).eq("id", editing.id);
    } else {
      await supabase.from("orders").insert({ id: uuidv4(), order_date: new Date().toISOString().split("T")[0], ...form, total_amount: Number(form.total_amount), initial_payment: Number(form.initial_payment), remaining });
    }
    setIsOpen(false); setForm({ customer_name: "", phone: "", product_description: "", total_amount: 0, initial_payment: 0, provider: "" }); setEditing(null); fetchOrders();
  };

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (all: boolean) => setSelected(all ? new Set() : new Set(orders.map(o => o.id)));
  const bulkDel = async () => {
    await supabase.from("orders").delete().in("id", Array.from(selected));
    setSelected(new Set()); fetchOrders();
  };

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const colCount = 9 + (isAdmin ? 1 : 0);

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
            onClick={() => { setEditing(null); setForm({ customer_name: "", phone: "", product_description: "", total_amount: 0, initial_payment: 0, provider: "" }); setIsOpen(true); }}
            className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus size={16} /> Nuevo pedido
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={() => toggleAll(allSelected)} className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]" />
                </th>
                {["Fecha", "Nombre", "Teléfono", "Descripción", "Monto", "Abono", "Restante", ...(isAdmin ? ["Proveedor"] : []), ""].map(h => (
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
                  <td className="px-4 py-3 text-sm text-gray-500">{o.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{o.product_description}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap">₡{o.total_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap">₡{o.initial_payment.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#07C3F8] font-mono whitespace-nowrap">₡{o.remaining.toFixed(2)}</td>
                  {isAdmin && <td className="px-4 py-3 text-sm text-gray-500">{o.provider}</td>}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(o); setForm({ customer_name: o.customer_name, phone: o.phone || "", product_description: o.product_description || "", total_amount: o.total_amount, initial_payment: o.initial_payment, provider: o.provider || "" }); setIsOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors">
                        <Edit size={14} />
                      </button>
                      <button onClick={async () => { await supabase.from("orders").delete().eq("id", o.id); fetchOrders(); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-gray-400 text-sm">No hay pedidos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? "Editar pedido" : "Nuevo pedido"}>
          <div className="space-y-4">
            <div><label className={lbl}>Nombre</label><input className={inp} value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><label className={lbl}>Teléfono</label><input className={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className={lbl}>Descripción</label><input className={inp} value={form.product_description} onChange={e => setForm({ ...form, product_description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Monto total</label><input type="number" className={inp} value={form.total_amount} onChange={e => setForm({ ...form, total_amount: parseFloat(e.target.value) })} /></div>
              <div><label className={lbl}>Abono</label><input type="number" className={inp} value={form.initial_payment} onChange={e => setForm({ ...form, initial_payment: parseFloat(e.target.value) })} /></div>
            </div>
            {isAdmin && <div><label className={lbl}>Proveedor</label><input className={inp} value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} /></div>}
            <div className="flex justify-end pt-2">
              <button onClick={save} className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
