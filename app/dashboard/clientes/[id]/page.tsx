"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, Car, Calendar, ShoppingBag, Pencil, Check, X, Plus, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { waUrl, WaIcon } from "@/utils/wa";
import { inp, lbl } from "@/utils/styles";
import { buildVehicleDescription } from "@/utils/customers";

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
  make?: string | null;
  model?: string | null;
  year?: number | null;
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
  status: "pending" | "confirmed" | "active" | "done" | "delivered" | "cancelled";
  placa?: string;
  abono?: number;
  cancel_reason?: string;
}

interface ApptTask {
  id: string;
  description: string;
  completed: boolean;
  price?: number | null;
  photo_urls?: string[];
}

interface Order {
  id: string;
  order_date: string;
  product_description?: string;
  total_amount: number;
  remaining: number;
  status?: string;
}

interface PendingQuote {
  id: string;
  description: string;
  status: "Pending" | "Quoting" | "Quoted";
  vehicle?: string;
}

function fmtTime(t: string): string {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

const statusStyle: Record<string, string> = {
  pending:   "bg-sky-50 text-sky-700 border border-sky-200",
  confirmed: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  active:    "bg-amber-50 text-amber-700 border border-amber-200",
  done:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  delivered: "bg-rose-50 text-rose-700 border border-rose-200",
  cancelled: "bg-red-50 text-red-400 border border-red-200",
};
const statusLabel: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  active:    "En proceso",
  done:      "Completada",
  delivered: "Entregado",
  cancelled: "Cancelada",
};

function ApptDetailModal({
  appt,
  onClose,
}: {
  appt: Appointment;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<ApptTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("appointment_tasks")
      .select("id,description,completed,price,photo_urls")
      .eq("appointment_id", appt.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setTasks((data ?? []) as ApptTask[]); setLoading(false); });
  }, [appt.id, supabase]);

  const total = tasks.reduce((s, t) => s + (t.price ?? 0), 0);

  return (
    <>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
            <div>
              <p className="text-xs text-gray-400 font-mono">
                {format(new Date(appt.appointment_date), "dd/MM/yyyy", { locale: es })}
              </p>
              <h2 className="text-base font-semibold text-gray-900 mt-0.5">{appt.assigned_person}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle[appt.status] ?? "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                {statusLabel[appt.status] ?? appt.status}
              </span>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 overflow-y-auto space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {appt.vehicle && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Vehículo</p>
                  <p className="font-medium text-gray-900">{appt.vehicle}</p>
                </div>
              )}
              {appt.placa && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Placa</p>
                  <p className="font-medium text-gray-900 font-mono">{appt.placa}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Hora</p>
                <p className="font-medium text-gray-900">
                  {fmtTime(appt.start_time)}–{fmtTime(appt.end_time)}
                </p>
              </div>
            </div>

            {appt.description && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Notas</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">{appt.description}</p>
              </div>
            )}

            {appt.cancel_reason && (
              <div className="bg-red-50 rounded-xl px-3 py-2">
                <p className="text-xs text-red-400 mb-0.5">Razón de cancelación</p>
                <p className="text-sm text-red-700">{appt.cancel_reason}</p>
              </div>
            )}

            {/* Tasks */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Tareas</p>
              {loading && <p className="text-xs text-gray-400 animate-pulse">Cargando...</p>}
              {!loading && tasks.length === 0 && <p className="text-xs text-gray-400">Sin tareas registradas</p>}
              {!loading && tasks.length > 0 && (
                <>
                  <ul className="space-y-2">
                    {tasks.map(t => (
                      <li key={t.id} className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${t.completed ? "bg-emerald-400 border-emerald-400" : "border-gray-300"}`}>
                          {t.completed && (
                            <svg viewBox="0 0 8 8" width="8" height="8" fill="white"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none"/></svg>
                          )}
                        </span>
                        <span className={`flex-1 text-sm ${t.completed ? "line-through text-gray-400" : "text-gray-800"}`}>{t.description}</span>
                        {t.price != null && t.price > 0 && (
                          <span className="text-xs font-semibold text-emerald-600 shrink-0">₡{t.price.toLocaleString("es-CR")}</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {total > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200 space-y-0.5 text-right">
                      <p className="text-sm font-bold text-gray-800">Total: ₡{total.toLocaleString("es-CR")}</p>
                      {(appt.abono ?? 0) > 0 && (
                        <>
                          <p className="text-xs text-gray-500">Abono: ₡{appt.abono!.toLocaleString("es-CR")}</p>
                          <p className="text-xs font-semibold text-amber-600">Saldo: ₡{(total - appt.abono!).toLocaleString("es-CR")}</p>
                        </>
                      )}
                    </div>
                  )}

                  {tasks.some(t => t.photo_urls && t.photo_urls.length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tasks.flatMap(t => t.photo_urls ?? []).map((url, i) => (
                        <button key={i} onClick={() => setLightboxUrl(url)} className="shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`foto ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

export default function CustomerProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer]         = useState<Customer | null>(null);
  const [vehicles, setVehicles]         = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders]             = useState<Order[]>([]);
  const [quotes, setQuotes]             = useState<PendingQuote[]>([]);
  const [loading, setLoading]           = useState(true);
  const [notFound, setNotFound]         = useState(false);

  // Edit customer inline
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "" });

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Add vehicle
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ make: "", model: "", year: "", plate: "" });
  const [savingVehicle, setSavingVehicle] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [{ data: cust }, { data: vehs }, { data: appts }, { data: ords }, { data: qts }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("vehicles").select("*").eq("customer_id", id).order("created_at", { ascending: true }),
      supabase.from("appointments").select("*").eq("customer_id", id).order("appointment_date", { ascending: false }),
      supabase.from("orders").select("*").eq("customer_id", id).order("order_date", { ascending: false }),
      supabase.from("pending_tasks").select("id,description,status,vehicle").eq("customer_id", id).order("id", { ascending: false }),
    ]);

    if (!cust) { setNotFound(true); setLoading(false); return; }

    setCustomer(cust as Customer);
    setEditForm({ name: cust.name, phone: cust.phone, notes: cust.notes ?? "" });
    setVehicles((vehs ?? []) as Vehicle[]);
    setAppointments((appts ?? []) as Appointment[]);
    setOrders((ords ?? []) as Order[]);
    setQuotes((qts ?? []) as PendingQuote[]);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveCustomer = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim()) return;
    const name = editForm.name.trim();
    const phone = editForm.phone.trim();
    const { error } = await supabase.from("customers").update({ name, phone, notes: editForm.notes.trim() || null }).eq("id", id);
    if (error) return;
    setCustomer(prev => prev ? { ...prev, name, phone, notes: editForm.notes.trim() } : prev);
    setEditing(false);
  };

  const saveVehicle = async () => {
    const desc = buildVehicleDescription(vehicleForm.make, vehicleForm.model, vehicleForm.year);
    if (!desc.trim()) return;
    setSavingVehicle(true);
    const { data } = await supabase
      .from("vehicles")
      .insert({
        customer_id: id,
        description: desc,
        make: vehicleForm.make.trim() || null,
        model: vehicleForm.model.trim() || null,
        year: vehicleForm.year ? Number(vehicleForm.year) : null,
        plate: vehicleForm.plate.trim() || null,
      })
      .select("*")
      .single();
    setSavingVehicle(false);
    if (data) setVehicles(prev => [...prev, data as Vehicle]);
    setVehicleFormOpen(false);
    setVehicleForm({ make: "", model: "", year: "", plate: "" });
  };

  const deleteVehicle = async (vehicleId: string) => {
    await supabase.from("vehicles").delete().eq("id", vehicleId);
    setVehicles(prev => prev.filter(v => v.id !== vehicleId));
  };

  const deleteCustomer = async () => {
    await supabase.from("customers").delete().eq("id", id);
    router.push("/dashboard/clientes");
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
    <>
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
            <div className="shrink-0 flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Editar cliente"
              >
                <Pencil size={15} />
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                  <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                  <button onClick={deleteCustomer} className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors" title="Confirmar">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Cancelar">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Eliminar cliente"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
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
              <label className={lbl}>Vehículo</label>
              <div className="grid grid-cols-3 gap-2">
                <input className={inp} placeholder="Marca" value={vehicleForm.make} onChange={e => setVehicleForm({ ...vehicleForm, make: e.target.value })} />
                <input className={inp} placeholder="Modelo" value={vehicleForm.model} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
                <input className={inp} placeholder="Año" value={vehicleForm.year} onChange={e => setVehicleForm({ ...vehicleForm, year: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={lbl}>Placa (opcional)</label>
              <input className={inp} placeholder="Ej: ABC-123" value={vehicleForm.plate} onChange={e => setVehicleForm({ ...vehicleForm, plate: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveVehicle}
                disabled={savingVehicle || !buildVehicleDescription(vehicleForm.make, vehicleForm.model, vehicleForm.year).trim()}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors disabled:opacity-50"
              >
                {savingVehicle ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => { setVehicleFormOpen(false); setVehicleForm({ make: "", model: "", year: "", plate: "" }); }} className="px-3 py-1.5 text-sm font-medium rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
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
              const label = v.make || v.model ? [v.make, v.model, v.year].filter(Boolean).join(" ") : v.description;
              const apptCount = appointments.filter(a => a.vehicle === v.description || a.vehicle === label).length;
              return (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <Car size={14} className="text-gray-300 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{label}</p>
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
          <ul className="divide-y divide-gray-100">
            {appointments.map(a => (
              <li key={a.id}>
                <button
                  onClick={() => setSelectedAppt(a)}
                  className="w-full px-5 py-3 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left"
                >
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
                      <span className="text-xs text-gray-400 font-mono">{fmtTime(a.start_time)}–{fmtTime(a.end_time)}</span>
                      {a.placa && <span className="text-xs text-gray-400 font-mono">{a.placa}</span>}
                    </div>
                    {a.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{a.description}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusStyle[a.status] ?? "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                    {statusLabel[a.status] ?? a.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quotes */}
      {quotes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <FileText size={15} className="text-amber-500" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900">Cotizaciones</h2>
            <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{quotes.length}</span>
          </div>
          <ul className="divide-y divide-gray-50">
            {quotes.map(q => {
              const qStyle = q.status === "Quoted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : q.status === "Quoting" ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-amber-50 text-amber-700 border border-amber-200";
              const qLabel = q.status === "Quoted" ? "Cotizado" : q.status === "Quoting" ? "Cotizando" : "Pendiente";
              return (
                <li key={q.id} className="px-5 py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{q.description || "—"}</p>
                    {q.vehicle && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Car size={10} aria-hidden="true" /> {q.vehicle}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${qStyle}`}>{qLabel}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
                {o.status && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    o.status === "Entregado" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : o.status === "En local" ? "bg-violet-50 text-violet-700 border border-violet-200"
                    : o.status === "Pedido"   ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>{o.status}</span>
                )}
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

      {selectedAppt && (
        <ApptDetailModal appt={selectedAppt} onClose={() => setSelectedAppt(null)} />
      )}
    </>
  );
}
