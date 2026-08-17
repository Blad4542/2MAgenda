"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, Car, Calendar, ShoppingBag, Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { waUrl, WaIcon } from "@/utils/wa";
import { inp, lbl } from "@/utils/styles";

interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  created_at: string;
}

interface Vehicle {
  id: string;
  description: string;
  plate?: string;
  created_at: string;
}

interface Appointment {
  id: string | number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  assigned_person: string;
  vehicle: string;
  description: string;
  status: "pending" | "active" | "done";
}

interface Order {
  id: string;
  order_date: string;
  product_description?: string;
  total_amount: number;
  remaining: number;
}

const statusStyle: Record<string, string> = {
  pending: "bg-sky-50 text-sky-700 border border-sky-200",
  active:  "bg-amber-50 text-amber-700 border border-amber-200",
  done:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  active:  "Activo",
  done:    "Completado",
};

export default function CustomerProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer]         = useState<Customer | null>(null);
  const [vehicles, setVehicles]         = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders]             = useState<Order[]>([]);
  const [loading, setLoading]           = useState(true);
  const [notFound, setNotFound]         = useState(false);

  // Edit customer inline
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "" });

  // Add vehicle
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ description: "", plate: "" });
  const [savingVehicle, setSavingVehicle] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [{ data: cust }, { data: vehs }, { data: appts }, { data: ords }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("vehicles").select("*").eq("customer_id", id).order("created_at", { ascending: true }),
      supabase.from("appointments").select("*").eq("customer_id", id).order("appointment_date", { ascending: false }),
      supabase.from("orders").select("*").eq("customer_id", id).order("order_date", { ascending: false }),
    ]);

    if (!cust) { setNotFound(true); setLoading(false); return; }

    setCustomer(cust as Customer);
    setEditForm({ name: cust.name, phone: cust.phone, notes: cust.notes ?? "" });
    setVehicles((vehs ?? []) as Vehicle[]);
    setAppointments((appts ?? []) as Appointment[]);
    setOrders((ords ?? []) as Order[]);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveCustomer = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim()) return;
    await supabase
      .from("customers")
      .update({ name: editForm.name.trim(), phone: editForm.phone.trim(), notes: editForm.notes.trim() || null })
      .eq("id", id);
    setCustomer(prev => prev ? { ...prev, name: editForm.name.trim(), phone: editForm.phone.trim(), notes: editForm.notes.trim() } : prev);
    setEditing(false);
  };

  const saveVehicle = async () => {
    if (!vehicleForm.description.trim()) return;
    setSavingVehicle(true);
    const { data } = await supabase
      .from("vehicles")
      .insert({ customer_id: id, description: vehicleForm.description.trim(), plate: vehicleForm.plate.trim() || null })
      .select("*")
      .single();
    setSavingVehicle(false);
    if (data) setVehicles(prev => [...prev, data as Vehicle]);
    setVehicleFormOpen(false);
    setVehicleForm({ description: "", plate: "" });
  };

  const deleteVehicle = async (vehicleId: string) => {
    await supabase.from("vehicles").delete().eq("id", vehicleId);
    setVehicles(prev => prev.filter(v => v.id !== vehicleId));
  };

  if (loading) return (
    <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
      <div className="h-6 w-32 bg-gray-200 rounded" />
      <div className="h-24 bg-gray-100 rounded-2xl" />
      <div className="h-40 bg-gray-100 rounded-2xl" />
    </div>
  );

  if (notFound) return (
    <div className="p-6 max-w-3xl mx-auto text-center text-gray-400 py-20">
      Cliente no encontrado.{" "}
      <button onClick={() => router.push("/dashboard/clientes")} className="text-[#07C3F8] underline">Volver</button>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/clientes")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft size={16} /> Clientes
      </button>

      {/* Customer card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className={lbl}>Nombre</label>
              <input className={inp} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input className={inp} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Notas</label>
              <textarea className={inp} rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveCustomer} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">
                <Check size={14} /> Guardar
              </button>
              <button onClick={() => { setEditing(false); setEditForm({ name: customer!.name, phone: customer!.phone, notes: customer!.notes ?? "" }); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#07C3F8]/10 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-[#07C3F8]">{customer!.name[0]?.toUpperCase() ?? "?"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900">{customer!.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <span>{customer!.phone}</span>
                {customer!.phone && (
                  <a href={waUrl(customer!.phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="opacity-60 hover:opacity-100 transition-opacity">
                    <WaIcon />
                  </a>
                )}
              </div>
              {customer!.notes && <p className="text-xs text-gray-400 mt-1.5">{customer!.notes}</p>}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Editar cliente"
            >
              <Pencil size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Vehicles */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Car size={15} className="text-[#07C3F8]" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900">Vehículos</h2>
            <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{vehicles.length}</span>
          </div>
          <button
            onClick={() => setVehicleFormOpen(v => !v)}
            className="flex items-center gap-1.5 text-sm text-[#07C3F8] hover:text-[#06aad9] font-medium transition-colors"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>

        {vehicleFormOpen && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
            <div>
              <label className={lbl}>Descripción</label>
              <input className={inp} placeholder="Ej: Toyota Corolla 2019" value={vehicleForm.description} onChange={e => setVehicleForm({ ...vehicleForm, description: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Placa (opcional)</label>
              <input className={inp} placeholder="Ej: ABC-123" value={vehicleForm.plate} onChange={e => setVehicleForm({ ...vehicleForm, plate: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveVehicle}
                disabled={savingVehicle || !vehicleForm.description.trim()}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors disabled:opacity-50"
              >
                {savingVehicle ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => { setVehicleFormOpen(false); setVehicleForm({ description: "", plate: "" }); }} className="px-3 py-1.5 text-sm font-medium rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {vehicles.length === 0 && !vehicleFormOpen ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Sin vehículos registrados</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {vehicles.map(v => {
              const apptCount = appointments.filter(a => a.vehicle === v.description).length;
              return (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <Car size={14} className="text-gray-300 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{v.description}</p>
                    {v.plate && <p className="text-xs text-gray-400 font-mono">{v.plate}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{apptCount} cita{apptCount !== 1 ? "s" : ""}</span>
                  <button
                    onClick={() => deleteVehicle(v.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Eliminar vehículo"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Appointments */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Calendar size={15} className="text-[#07C3F8]" aria-hidden="true" />
          <h2 className="font-semibold text-gray-900">Historial de citas</h2>
          <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{appointments.length}</span>
        </div>
        {appointments.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Sin citas registradas</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {appointments.map(a => (
              <li key={a.id} className="px-5 py-3 flex items-start gap-4">
                <div className="text-xs text-gray-400 font-mono w-20 shrink-0 pt-0.5">
                  {format(new Date(a.appointment_date), "dd/MM/yyyy", { locale: es })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{a.assigned_person}</span>
                    {a.vehicle && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Car size={10} aria-hidden="true" /> {a.vehicle}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">{a.start_time}–{a.end_time}</span>
                  </div>
                  {a.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{a.description}</p>}
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle[a.status] ?? "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                  {statusLabel[a.status] ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Orders */}
      {orders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <ShoppingBag size={15} className="text-emerald-500" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900">Pedidos</h2>
            <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{orders.length}</span>
          </div>
          <ul className="divide-y divide-gray-50">
            {orders.map(o => (
              <li key={o.id} className="px-5 py-3 flex items-center gap-4">
                <div className="text-xs text-gray-400 font-mono w-20 shrink-0">
                  {format(new Date(o.order_date + "T12:00:00"), "dd/MM/yyyy", { locale: es })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{o.product_description || "—"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900 font-mono">₡{o.total_amount.toLocaleString("es-CR")}</p>
                  {o.remaining > 0 ? (
                    <p className="text-xs text-amber-600">Saldo: ₡{o.remaining.toLocaleString("es-CR")}</p>
                  ) : (
                    <p className="text-xs text-emerald-600 font-medium">Pagado</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
