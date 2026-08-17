"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Dialog } from "@headlessui/react";
import { X, Camera, Trash2, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { waUrl } from "@/utils/wa";
import { inp, lbl } from "@/utils/styles";
import { lookupCustomer, getCustomerVehicles } from "@/utils/customers";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TaskFormState {
  id?: string | number;
  start_time: string;
  end_time: string;
  assigned_person: string;
  name: string;
  phone: string;
  description: string;
  vehicle: string;
  status: "pending" | "active" | "done";
  appointment_date: string;
  customer_id?: string;
  vehicle_id?: string;
}

interface AppointmentTask {
  id: string;
  description: string;
  completed: boolean;
  photo_url: string | null;
  uploading?: boolean;
}

const buildWaHref = (task: TaskFormState, appointmentDate: Date, businessPhone: string) => {
  if (!task.phone) return "";
  const dateStr = format(appointmentDate, "EEEE d 'de' MMMM", { locale: es });
  let msg = `Hola ${task.name}, le confirmamos su cita programada para el ${dateStr} a las ${task.start_time}.`;
  if (businessPhone) msg += ` Para cualquier consulta contáctenos al ${businessPhone}.`;
  return `${waUrl(task.phone)}?text=${encodeURIComponent(msg)}`;
};

const TaskModal = ({
  isOpen, onClose, onSave, onDelete, task, setTask, isNewTask, errorMessage,
  businessPhone = "", appointmentDate, supabase,
}: {
  isOpen: boolean; onClose: () => void; onSave: () => void;
  onDelete: (id: number | string) => void; task: TaskFormState; setTask: (t: TaskFormState) => void;
  isNewTask: boolean; errorMessage?: string;
  businessPhone?: string; appointmentDate?: Date;
  supabase?: SupabaseClient;
}) => {
  const [customerVehicles, setCustomerVehicles] = useState<{ id: string; description: string }[]>([]);
  const [isNewVehicle, setIsNewVehicle] = useState(true);

  // Task checklist state
  const [apptTasks, setApptTasks] = useState<AppointmentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setTask({ ...task, [e.target.name]: e.target.value } as TaskFormState);

  const onPhoneBlur = useCallback(async () => {
    if (!supabase || !isNewTask || task.phone.replace(/\D/g, "").length < 6) return;
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
      vehicle_id: undefined,
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
      .select("id, description, completed, photo_url")
      .eq("appointment_id", task.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setApptTasks((data ?? []) as AppointmentTask[]);
        setTasksLoading(false);
      });
  }, [isOpen, isNewTask, task.id, supabase]);

  const addTask = async () => {
    const text = newTaskText.trim();
    if (!text || !supabase || !task.id) return;
    setNewTaskText("");
    const { data, error } = await supabase
      .from("appointment_tasks")
      .insert({ appointment_id: task.id, description: text })
      .select("id, description, completed, photo_url")
      .single();
    if (!error && data) {
      setApptTasks(prev => [...prev, data as AppointmentTask]);
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t));
    await supabase?.from("appointment_tasks").update({ completed }).eq("id", taskId);
  };

  const deleteTask = async (taskId: string) => {
    setApptTasks(prev => prev.filter(t => t.id !== taskId));
    await supabase?.from("appointment_tasks").delete().eq("id", taskId);
  };

  const uploadPhoto = async (taskId: string, file: File) => {
    if (!supabase || !task.id) return;
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, uploading: true } : t));
    const path = `${task.id}/${taskId}`;
    const { error: uploadError } = await supabase.storage
      .from("appointment-photos")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, uploading: false } : t));
      return;
    }
    const { data: urlData } = supabase.storage.from("appointment-photos").getPublicUrl(path);
    const photo_url = urlData.publicUrl;
    await supabase.from("appointment_tasks").update({ photo_url }).eq("id", taskId);
    setApptTasks(prev => prev.map(t => t.id === taskId ? { ...t, photo_url, uploading: false } : t));
  };

  const waHref = task.phone ? buildWaHref(task, appointmentDate ?? new Date(), businessPhone) : "";

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[100]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <Dialog.Panel className={`bg-white rounded-2xl w-full shadow-2xl overflow-hidden ${isNewTask ? "max-w-sm" : "max-w-md"}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {isNewTask ? "Nueva cita" : "Editar cita"}
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
            </div>
            <div className="mb-3">
              <label htmlFor="task-name" className={lbl}>Nombre</label>
              <input id="task-name" type="text" name="name" placeholder="Nombre" className={inp} value={task.name} onChange={onChange} />
            </div>
            <div className="mb-3">
              <label htmlFor="task-description" className={lbl}>Descripción</label>
              <textarea id="task-description" name="description" placeholder="Descripción" className={inp} value={task.description} onChange={onChange} />
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
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label htmlFor="task-start" className={lbl}>Hora inicio</label>
                <input id="task-start" type="time" name="start_time" className={inp} value={task.start_time} onChange={onChange} />
              </div>
              <div>
                <label htmlFor="task-end" className={lbl}>Hora fin</label>
                <input id="task-end" type="time" name="end_time" className={inp} value={task.end_time} onChange={onChange} />
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="task-status" className={lbl}>Estado</label>
              <select id="task-status" name="status" className={inp} value={task.status} onChange={onChange}>
                <option value="pending">Pendiente</option>
                <option value="active">Activo</option>
                <option value="done">Hecho</option>
              </select>
            </div>

            {errorMessage && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                {errorMessage}
              </p>
            )}

            {/* Task checklist — only for existing appointments */}
            {!isNewTask && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex-1">Tareas</span>
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTask()}
                    placeholder="Nueva tarea…"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                  />
                  <button
                    onClick={addTask}
                    disabled={!newTaskText.trim()}
                    className="p-1.5 rounded-lg bg-[#07C3F8] text-white hover:bg-[#06aad9] disabled:opacity-40 transition-colors"
                    aria-label="Agregar tarea"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {tasksLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : apptTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Sin tareas aún</p>
                ) : (
                  <ul className="space-y-2">
                    {apptTasks.map(t => (
                      <li key={t.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={e => toggleTask(t.id, e.target.checked)}
                          className="w-4 h-4 rounded accent-[#07C3F8] cursor-pointer shrink-0"
                        />
                        <span className={`flex-1 text-sm truncate ${t.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {t.description}
                        </span>

                        {/* Photo area */}
                        {t.uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                        ) : t.photo_url ? (
                          <a href={t.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={t.photo_url}
                              alt="evidencia"
                              className="w-12 h-12 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ) : (
                          <button
                            onClick={() => fileInputRefs.current[t.id]?.click()}
                            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-gray-100 transition-colors"
                            aria-label="Subir foto"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        )}

                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          ref={el => { fileInputRefs.current[t.id] = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) uploadPhoto(t.id, file);
                            e.target.value = "";
                          }}
                        />

                        <button
                          onClick={() => deleteTask(t.id)}
                          className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="Eliminar tarea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
            {!isNewTask && (
              <button onClick={() => task.id != null && onDelete(task.id)} className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                Eliminar
              </button>
            )}
            <button onClick={onSave} className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">
              Guardar
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
export default TaskModal;
