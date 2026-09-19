"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Dialog } from "@headlessui/react";
import { X, Camera, Trash2, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { waUrl } from "@/utils/wa";
import { inp, lbl } from "@/utils/styles";
import { TIME_OPTIONS } from "@/utils/timeOptions";
import { lookupCustomer, getCustomerVehicles } from "@/utils/customers";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TaskFormState {
  id?: string | number;
  start_time: string;
  end_time: string;
  assigned_person: string;
  staff_id?: string;
  name: string;
  phone: string;
  description: string;
  vehicle: string;
  placa?: string;
  status: "pending" | "confirmed" | "active" | "done" | "delivered" | "cancelled";
  appointment_date: string;
  customer_id?: string;
  vehicle_id?: string;
  abono?: number;
}

interface AppointmentTask {
  id: string;
  description: string;
  completed: boolean;
  photo_url: string | null;
  photo_urls: string[];
  price?: number | null;
  uploading?: boolean;
}

type PendingTask = { text: string; price?: number };

function fmtTime12(time: string): string {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

const buildWaHref = (task: TaskFormState, appointmentDate: Date, tasksList: string[]) => {
  if (!task.phone) return "";
  const dateStr = format(appointmentDate, "EEEE d 'de' MMMM", { locale: es });
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const hora = task.start_time ? fmtTime12(task.start_time) : "";
  const trabajo = tasksList.length > 0
    ? tasksList.map(t => ` ${t}`).join("\n")
    : task.description?.trim() || "—";

  const msg =
`☀️Buenas tardes de parte de Autodecoracion 2M es un gusto saludarle, para confirmar su cita el día de mañana

📅Día: ${dateCapitalized}
🕜Hora: ${hora}
✅Trabajo a realizar:
${trabajo}
🚗Vehiculo: ${task.vehicle || "—"}

Quedo atenta a su confirmación`;

  return `${waUrl(task.phone)}?text=${encodeURIComponent(msg)}`;
};

const TaskModal = ({
  isOpen, onClose, onSave, onDelete, task, setTask, isNewTask, errorMessage,
  businessPhone = "", appointmentDate, supabase, initialPendingTasks = [], onMoveToWaiting, staffList = [], onCancel,
  hideFinancials = false, readOnly = false,
}: {
  isOpen: boolean; onClose: () => void; onSave: (pendingTasks?: PendingTask[]) => void;
  onDelete?: (id: number | string) => void; task: TaskFormState; setTask: (t: TaskFormState) => void;
  isNewTask: boolean; errorMessage?: string;
  businessPhone?: string; appointmentDate?: Date;
  supabase?: SupabaseClient;
  initialPendingTasks?: PendingTask[];
  onMoveToWaiting?: () => void;
  staffList?: string[];
  onCancel?: (reason: string) => void;
  hideFinancials?: boolean;
  readOnly?: boolean;
}) => {
  const [customerVehicles, setCustomerVehicles] = useState<{ id: string; description: string }[]>([]);
  const [isNewVehicle, setIsNewVehicle] = useState(true);
  const [phoneError, setPhoneError] = useState("");
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Task checklist state
  const [apptTasks, setApptTasks] = useState<AppointmentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskPrice, setNewTaskPrice] = useState<string>("");
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>(initialPendingTasks ?? []);

  useEffect(() => {
    if (isOpen) { setCancelMode(false); setCancelReason(""); setDeleteConfirm(false); }
    if (isOpen && isNewTask) { setPendingTasks(initialPendingTasks ?? []); setNewTaskText(""); setNewTaskPrice(""); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isNewTask]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setTask({ ...task, [e.target.name]: e.target.value } as TaskFormState);

  const onPhoneBlur = useCallback(async () => {
    const digits = task.phone.replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 8) {
      setPhoneError("El teléfono debe tener al menos 8 dígitos.");
      return;
    }
    setPhoneError("");
    if (!supabase || !isNewTask || digits.length < 6) return;
    const match = await lookupCustomer(supabase, task.phone);
    if (!match) {
      setCustomerVehicles([]);
      setIsNewVehicle(true);
      return;
    }
    const vehicles = await getCustomerVehicles(supabase, match.id);
    setCustomerVehicles(vehicles);
    setIsNewVehicle(vehicles.length === 0);
    setTask({
      ...task,
      name: task.name || match.name,
      customer_id: match.id,
      vehicle_id: vehicles[0]?.id ?? undefined,
      vehicle: vehicles[0]?.description ?? task.vehicle,
    });
  }, [supabase, isNewTask, task, setTask]);

  const onVehicleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") {
      setIsNewVehicle(true);
      setTask({ ...task, vehicle: "", vehicle_id: undefined });
    } else {
      const found = customerVehicles.find(v => v.id === val);
      if (found) {
        setIsNewVehicle(false);
        setTask({ ...task, vehicle: found.description, vehicle_id: found.id });
      }
    }
  };

  // Load tasks when modal opens for existing appointment
  useEffect(() => {
    if (!isOpen || isNewTask || !task.id || !supabase) {
      setApptTasks([]);
      return;
    }
    setTasksLoading(true);
    supabase
      .from("appointment_tasks")
      .select("id, description, completed, photo_url, photo_urls, price")
      .eq("appointment_id", task.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("appointment_tasks query failed:", error.message);
        setApptTasks((data ?? []).map(t => ({ ...t, photo_urls: t.photo_urls ?? [] })) as AppointmentTask[]);
        setTasksLoading(false);
      });
  }, [isOpen, isNewTask, task.id, supabase]);

  const addTask = async () => {
    const text = newTaskText.trim();
    if (!text || !supabase || !task.id) return;
    const price = newTaskPrice !== "" ? parseFloat(newTaskPrice) : null;
    setNewTaskText("");
    setNewTaskPrice("");
    const { data, error } = await supabase
      .from("appointment_tasks")
      .insert({ appointment_id: task.id, description: text, price })
      .select("id, description, completed, photo_url, photo_urls, price")
      .single();
    if (!error && data) {
      setApptTasks(prev => [...prev, { ...data, photo_urls: data.photo_urls ?? [] } as AppointmentTask]);
    }
  };

  const updateTaskPrice = async (taskId: string, price: number | null) => {
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, price } : t));
    await supabase?.from("appointment_tasks").update({ price }).eq("id", taskId);
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t));
    await supabase?.from("appointment_tasks").update({ completed }).eq("id", taskId);
  };

  const deleteTask = async (taskId: string) => {
    setApptTasks(prev => prev.filter(t => t.id !== taskId));
    await supabase?.from("appointment_tasks").delete().eq("id", taskId);
  };

  const uploadPhotos = async (taskId: string, files: File[]) => {
    if (!supabase || !task.id || files.length === 0) return;
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, uploading: true } : t));
    const urls = await Promise.all(
      files.map(async file => {
        const path = `${task.id}/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { error } = await supabase.storage.from("appointment-photos").upload(path, file, { upsert: false });
        if (error) return null;
        return supabase.storage.from("appointment-photos").getPublicUrl(path).data.publicUrl;
      })
    );
    const uploaded = urls.filter((u): u is string => u !== null);
    const current = apptTasks.find(t => t.id === taskId);
    const allUrls = [...(current?.photo_urls ?? []), ...uploaded];
    await supabase.from("appointment_tasks").update({ photo_urls: allUrls }).eq("id", taskId);
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, photo_urls: allUrls, uploading: false } : t));
  };

  const deletePhoto = async (taskId: string, url: string) => {
    const current = apptTasks.find(t => t.id === taskId);
    const newUrls = (current?.photo_urls ?? []).filter(u => u !== url);
    await supabase?.from("appointment_tasks").update({ photo_urls: newUrls }).eq("id", taskId);
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, photo_urls: newUrls } : t));
  };

  const taskLabels = isNewTask
    ? pendingTasks.map(t => t.text)
    : apptTasks.map(t => t.description);

  const subtotal = isNewTask
    ? pendingTasks.reduce((s, t) => s + (t.price ?? 0), 0)
    : apptTasks.reduce((s, t) => s + (t.price ?? 0), 0);
  const waHref = buildWaHref(task, appointmentDate ?? new Date(), taskLabels);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[100]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <Dialog.Panel className={`bg-white rounded-2xl w-full shadow-2xl overflow-hidden ${isNewTask ? "max-w-sm" : "max-w-md"}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {isNewTask ? "Nueva cita" : readOnly ? "Ver cita" : "Editar cita"}
            </Dialog.Title>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
            <div className="mb-3">
              <label htmlFor="task-phone" className={lbl}>Teléfono</label>
              <div className="flex items-center gap-2">
                <input
                  id="task-phone"
                  type="text"
                  name="phone"
                  placeholder="Teléfono"
                  className={inp}
                  value={task.phone}
                  onChange={onChange}
                  onBlur={onPhoneBlur}
                  disabled={readOnly}
                />
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Enviar WhatsApp"
                    title="Confirmar cita por WhatsApp"
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                )}
              </div>
              {phoneError && (
                <span className="text-xs text-red-500 mt-1 block">{phoneError}</span>
              )}
            </div>
            <div className="mb-3">
              <label htmlFor="task-name" className={lbl}>Nombre</label>
              <input id="task-name" type="text" name="name" placeholder="Nombre" className={inp} value={task.name} onChange={onChange} disabled={readOnly} />
            </div>
            <div className="mb-3">
              <label htmlFor="task-vehicle" className={lbl}>Vehículo</label>
              {isNewTask && customerVehicles.length > 0 ? (
                <select
                  id="task-vehicle-select"
                  className={inp}
                  value={isNewVehicle ? "__new__" : (task.vehicle_id ?? "")}
                  onChange={onVehicleSelect}
                >
                  {customerVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.description}</option>
                  ))}
                  <option value="__new__">+ Nuevo vehículo</option>
                </select>
              ) : null}
              {(!isNewTask || customerVehicles.length === 0 || isNewVehicle) && (
                <input
                  id="task-vehicle"
                  type="text"
                  name="vehicle"
                  placeholder="Vehículo"
                  className={`${inp} ${isNewTask && customerVehicles.length > 0 ? "mt-2" : ""}`}
                  value={task.vehicle}
                  onChange={onChange}
                  disabled={readOnly}
                />
              )}
            </div>
            <div className="mb-3">
              <label htmlFor="task-placa" className={lbl}>Placa</label>
              <input
                id="task-placa"
                type="text"
                name="placa"
                placeholder="Ej: ABC-123"
                className={inp}
                value={task.placa ?? ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            {/* Task checklist */}
            <div className="mb-3 border-t border-gray-100 pt-3">
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tareas</p>
                  {readOnly && <span className="text-xs text-green-600 font-medium">· Se guardan automáticamente</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key !== "Enter") return;
                      if (isNewTask) {
                        const text = newTaskText.trim();
                        if (text) { setPendingTasks(prev => [...prev, { text, price: newTaskPrice !== "" ? parseFloat(newTaskPrice) : undefined }]); setNewTaskText(""); setNewTaskPrice(""); }
                      } else { addTask(); }
                    }}
                    placeholder="Descripción…"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                  />
                  {!hideFinancials && (
                  <input
                    type="number"
                    value={newTaskPrice}
                    onChange={e => setNewTaskPrice(e.target.value)}
                    placeholder="₡ Precio"
                    min="0"
                    className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                  />
                  )}
                  <button
                    onClick={() => {
                      if (isNewTask) {
                        const text = newTaskText.trim();
                        if (text) { setPendingTasks(prev => [...prev, { text, price: newTaskPrice !== "" ? parseFloat(newTaskPrice) : undefined }]); setNewTaskText(""); setNewTaskPrice(""); }
                      } else { addTask(); }
                    }}
                    disabled={!newTaskText.trim()}
                    className="p-1.5 rounded-lg bg-[#07C3F8] text-white hover:bg-[#06aad9] disabled:opacity-40 transition-colors shrink-0"
                    aria-label="Agregar tarea"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isNewTask ? (
                pendingTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Sin tareas aún</p>
                ) : (
                  <>
                    <ul className="space-y-1.5">
                      {pendingTasks.map((pt, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="flex-1 text-sm text-gray-700 truncate">{pt.text}</span>
                          {!hideFinancials && (
                          <input
                            type="number"
                            value={pt.price ?? ""}
                            onChange={e => setPendingTasks(prev => prev.map((t, i) => i === idx ? { ...t, price: e.target.value !== "" ? parseFloat(e.target.value) : undefined } : t))}
                            placeholder="₡"
                            min="0"
                            className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                          />
                          )}
                          <button
                            onClick={() => setPendingTasks(prev => prev.filter((_, i) => i !== idx))}
                            className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            aria-label="Eliminar tarea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {subtotal > 0 && !hideFinancials && (
                      <div className="mt-2 pr-9 space-y-1">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Total</span>
                          <span className="font-semibold">₡{subtotal.toLocaleString("es-CR")}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Abono</span>
                          <input
                            type="number" min="0"
                            value={task.abono ?? ""}
                            onChange={e => setTask({ ...task, abono: e.target.value !== "" ? parseFloat(e.target.value) : undefined })}
                            placeholder="0"
                            className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                          />
                        </div>
                        {(task.abono ?? 0) > 0 && (
                          <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-1">
                            <span>Saldo</span>
                            <span className={(subtotal - (task.abono ?? 0)) <= 0 ? "text-emerald-600" : "text-gray-900"}>
                              ₡{Math.max(0, subtotal - (task.abono ?? 0)).toLocaleString("es-CR")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )
              ) : tasksLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : apptTasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">Sin tareas aún</p>
              ) : (
                <>
                <ul className="space-y-2">
                  {apptTasks.map(t => (
                    <React.Fragment key={t.id}>
                      <li className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={e => toggleTask(t.id, e.target.checked)}
                          className="w-4 h-4 rounded accent-[#07C3F8] cursor-pointer shrink-0"
                        />
                        <span className={`flex-1 text-sm truncate ${t.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {t.description}
                        </span>
                        {!hideFinancials && (
                        <input
                          type="number"
                          value={t.price ?? ""}
                          onChange={e => updateTaskPrice(t.id, e.target.value !== "" ? parseFloat(e.target.value) : null)}
                          placeholder="₡"
                          min="0"
                          className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                        />
                        )}
                        {t.uploading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />}
                        <input
                          type="file" accept="image/*" multiple className="hidden"
                          ref={el => { fileInputRefs.current[t.id] = el; }}
                          onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) uploadPhotos(t.id, files); e.target.value = ""; }}
                        />
                        <button
                          onClick={() => fileInputRefs.current[t.id]?.click()}
                          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-gray-100 transition-colors"
                          aria-label="Agregar foto"
                          disabled={t.uploading}
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="Eliminar tarea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                      {t.photo_urls && t.photo_urls.length > 0 && (
                        <li className="flex flex-wrap gap-2 pl-5 pb-1">
                          {t.photo_urls.map((url, idx) => (
                            <div key={idx} className="relative group/photo">
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`foto ${idx + 1}`} className="w-16 h-16 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                              </a>
                              <button
                                onClick={() => deletePhoto(t.id, url)}
                                className="absolute -top-1.5 -right-1.5 hidden group-hover/photo:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center shadow"
                                aria-label="Eliminar foto"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </li>
                      )}
                    </React.Fragment>
                  ))}
                </ul>
                {subtotal > 0 && !hideFinancials && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Total</span>
                      <span className="font-semibold">₡{subtotal.toLocaleString("es-CR")}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>Abono</span>
                      <input
                        type="number" min="0"
                        value={task.abono ?? ""}
                        onChange={e => setTask({ ...task, abono: e.target.value !== "" ? parseFloat(e.target.value) : undefined })}
                        placeholder="0"
                        className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                      />
                    </div>
                    {(task.abono ?? 0) > 0 && (
                      <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-1">
                        <span>Saldo</span>
                        <span className={(subtotal - (task.abono ?? 0)) <= 0 ? "text-emerald-600" : "text-gray-900"}>
                          ₡{Math.max(0, subtotal - (task.abono ?? 0)).toLocaleString("es-CR")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                </>
              )}
            </div>

            {!isNewTask && (
              <>
                <div className="mb-3">
                  <label htmlFor="task-date" className={lbl}>Fecha de la cita</label>
                  <input
                    id="task-date"
                    type="date"
                    className={inp}
                    value={task.appointment_date ? format(new Date(task.appointment_date), "yyyy-MM-dd") : ""}
                    onChange={e => {
                      if (!e.target.value) return;
                      const d = new Date(e.target.value + "T12:00:00");
                      setTask({ ...task, appointment_date: d.toISOString() });
                    }}
                    disabled={readOnly}
                  />
                </div>
                {staffList.length > 0 && (
                  <div className="mb-3">
                    <label htmlFor="task-technician" className={lbl}>Técnico</label>
                    <select
                      id="task-technician"
                      className={inp}
                      value={task.assigned_person}
                      onChange={e => setTask({ ...task, assigned_person: e.target.value })}
                      disabled={readOnly}
                    >
                      {staffList.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label htmlFor="task-start" className={lbl}>Hora inicio</label>
                <select id="task-start" name="start_time" className={inp} value={task.start_time?.slice(0, 5) ?? ""} onChange={onChange} disabled={readOnly}>
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="task-end" className={lbl}>Hora fin</label>
                <select id="task-end" name="end_time" className={inp} value={task.end_time?.slice(0, 5) ?? ""} onChange={onChange} disabled={readOnly}>
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="task-status" className={lbl}>Estado</label>
              <select id="task-status" name="status" className={inp} value={task.status} onChange={onChange} disabled={readOnly}>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmada</option>
                <option value="active">En proceso</option>
                <option value="done">Completada</option>
                <option value="delivered">Entregado</option>
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="task-description" className={lbl}>Notas</label>
              <textarea id="task-description" name="description" placeholder="Notas" rows={3} className={`${inp} resize-none`} value={task.description} onChange={onChange} disabled={readOnly} />
            </div>

            {cancelMode && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-red-700">Motivo de cancelación</p>
                <textarea
                  rows={2}
                  className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none bg-white"
                  placeholder="Ej: Cliente no pudo llegar, reagendar..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
              </div>
            )}
            {errorMessage && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
            {!readOnly && !isNewTask && !cancelMode && !deleteConfirm && (
              <>
                <button onClick={() => setDeleteConfirm(true)} className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                  Eliminar
                </button>
                {onMoveToWaiting && (
                  <button onClick={onMoveToWaiting} className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                    Mover a espera
                  </button>
                )}
                {onCancel && (
                  <button onClick={() => setCancelMode(true)} className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors">
                    Cancelar cita
                  </button>
                )}
              </>
            )}
            {deleteConfirm && (
              <>
                <span className="text-sm text-gray-600 mr-auto">¿Eliminar esta cita?</span>
                <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors">
                  Volver
                </button>
                <button onClick={() => task.id != null && onDelete && onDelete(task.id)} className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors">
                  Sí, eliminar
                </button>
              </>
            )}
            {cancelMode && (
              <>
                <button onClick={() => { setCancelMode(false); setCancelReason(""); }} className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors">
                  Volver
                </button>
                <button onClick={() => onCancel?.(cancelReason)} className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors">
                  Confirmar cancelación
                </button>
              </>
            )}
            {!readOnly && !cancelMode && !deleteConfirm && (
              <button onClick={() => onSave(isNewTask ? pendingTasks : undefined)} className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">
                Guardar
              </button>
            )}
            {readOnly && (
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors">
                Cerrar
              </button>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
export default TaskModal;
