"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { createClient } from "@/utils/supabase/client";
import { Plus, Trash2, Edit } from "lucide-react";
import Modal from "@/components/Modal";
import { v4 as uuidv4 } from "uuid";

interface Order {
  id: string;
  order_date: string;
  customer_name: string;
  phone?: string;
  product_description?: string;
  total_amount: number;
  initial_payment: number;
  remaining: number;
  provider?: string;
  created_by?: string;
}

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    product_description: "",
    total_amount: 0,
    initial_payment: 0,
    provider: "",
  });

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("order_date", { ascending: false });
    if (data) setOrders(data as Order[]);
  };

  const checkAdminRole = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    if (roleData?.role === "admin") setIsAdmin(true);
  };

  useEffect(() => {
    fetchOrders();
    checkAdminRole();
  }, []);

  const handleSubmit = async () => {
    const remaining = Number(form.total_amount) - Number(form.initial_payment);
    if (editingOrder) {
      await supabase
        .from("orders")
        .update({
          ...form,
          total_amount: Number(form.total_amount),
          initial_payment: Number(form.initial_payment),
        })
        .eq("id", editingOrder.id);
    } else {
      await supabase.from("orders").insert({
        id: uuidv4(),
        order_date: new Date().toISOString().split("T")[0],
        customer_name: form.customer_name,
        phone: form.phone,
        product_description: form.product_description,
        total_amount: Number(form.total_amount),
        initial_payment: Number(form.initial_payment),
        provider: form.provider,
      });
    }

    setIsOpen(false);
    setForm({
      customer_name: "",
      phone: "",
      product_description: "",
      total_amount: 0,
      initial_payment: 0,
      provider: "",
    });
    setEditingOrder(null);
    fetchOrders();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("orders").delete().eq("id", id);
    fetchOrders();
  };

  const openEdit = (order: Order) => {
    setEditingOrder(order);
    setForm({
      customer_name: order.customer_name,
      phone: order.phone || "",
      product_description: order.product_description || "",
      total_amount: order.total_amount,
      initial_payment: order.initial_payment,
      provider: order.provider || "",
    });
    setIsOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <button
          className="bg-[#07C3F8] hover:bg-[#06aad9] text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={() => {
            setEditingOrder(null);
            setForm({
              customer_name: "",
              phone: "",
              product_description: "",
              total_amount: 0,
              initial_payment: 0,
              provider: "",
            });
            setIsOpen(true);
          }}
        >
          <Plus size={18} />
          Nuevo pedido
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded shadow">
          <thead className="bg-[#DAF7FF] text-left">
            <tr>
              <th className="p-3 border-b">Fecha</th>
              <th className="p-3 border-b">Nombre</th>
              <th className="p-3 border-b">Teléfono</th>
              <th className="p-3 border-b">Descripción</th>
              <th className="p-3 border-b">Monto</th>
              <th className="p-3 border-b">Abono</th>
              <th className="p-3 border-b">Restante</th>
              {isAdmin && <th className="p-3 border-b">Proveedor</th>}
              <th className="p-3 border-b">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="p-3 border-b">
                  {format(new Date(order.order_date), "dd/MM/yyyy", {
                    locale: es,
                  })}
                </td>
                <td className="p-3 border-b">{order.customer_name}</td>
                <td className="p-3 border-b">{order.phone}</td>
                <td className="p-3 border-b">{order.product_description}</td>
                <td className="p-3 border-b">
                  ₡{order.total_amount.toFixed(2)}
                </td>
                <td className="p-3 border-b">
                  ₡{order.initial_payment.toFixed(2)}
                </td>
                <td className="p-3 border-b">₡{order.remaining.toFixed(2)}</td>
                {isAdmin && <td className="p-3 border-b">{order.provider}</td>}
                <td className="p-3 border-b flex gap-2">
                  <button
                    onClick={() => openEdit(order)}
                    className="text-blue-600 hover:underline"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(order.id)}
                    className="text-red-600 hover:underline"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={editingOrder ? "Editar pedido" : "Nuevo pedido"}
        >
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-1">Nombre</label>
              <input
                className="w-full border border-gray-300 rounded p-2"
                value={form.customer_name}
                onChange={(e) =>
                  setForm({ ...form, customer_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Teléfono</label>
              <input
                className="w-full border border-gray-300 rounded p-2"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Descripción</label>
              <input
                className="w-full border border-gray-300 rounded p-2"
                value={form.product_description}
                onChange={(e) =>
                  setForm({ ...form, product_description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Monto total</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded p-2"
                value={form.total_amount}
                onChange={(e) =>
                  setForm({ ...form, total_amount: parseFloat(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Abono</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded p-2"
                value={form.initial_payment}
                onChange={(e) =>
                  setForm({
                    ...form,
                    initial_payment: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block font-medium mb-1">Proveedor</label>
                <input
                  className="w-full border border-gray-300 rounded p-2"
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value })
                  }
                />
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button
                className="bg-[#07C3F8] hover:bg-[#06aad9] text-white px-4 py-2 rounded"
                onClick={handleSubmit}
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
