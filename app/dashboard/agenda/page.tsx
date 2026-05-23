"use client";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskModal from "@/components/TaskModal";
import Modal from "@/components/Modal";
import { addNoteToSupabase, deleteNoteFromSupabase, updateNoteInSupabase } from "../../../utils/index";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, CalendarPlus, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";

interface DecodedToken { email: string; }

interface Appointment {
  id: string | number;
  start_time: string;
  end_time: string;
  assigned_person: string;
  name: string;
  phone: string;
  description: string;
  vehicle: string;
  status: "pending" | "active" | "done";
  appointment_date: string;
}

interface WaitingEntry {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  description: string;
  created_at: string;
  status: "waiting" | "contacted" | "scheduled";
}

const waitingStatusStyle: Record<WaitingEntry["status"], string> = {
  waiting:   "bg-amber-50 text-amber-700 border border-amber-200",
  contacted: "bg-blue-50 text-blue-700 border border-blue-200",
  scheduled: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
const waitingStatusLabel: Record<WaitingEntry["status"], string> = {
  waiting:   "En espera",
  contacted: "Contactado",
  scheduled: "Agendado",
};

const inp = "w-full border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors";
const lbl = "block text-sm font-medium text-gray-700 mb-1.5";

const Agenda = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<{
    start_time: string; end_time: string; assigned_person: string; name: string;
    phone: string; description: string; vehicle: string;
    status: "pending" | "active" | "done"; appointment_date: string;
  }>({ start_time: "", end_time: "", assigned_person: "", name: "", phone: "", description: "", vehicle: "", status: "pending", appointment_date: new Date().toISOString() });
  const [notes, setNotes] = useState<Appointment[]>([]);
  const [isNewTask, setIsNewTask] = useState(true);
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reservingSlots, setReservingSlots] = useState<Record<string, string>>({});
  const channelRef = useRef<any>(null);
  const currentSlotRef = useRef<string | null>(null);
  const fetchNotesRef = useRef<(() => Promise<void>) | null>(null);
  const userRef = useRef<string | null>(null);
  const supabase = createClient();

  // Waiting list state
  const [waitingList, setWaitingList] = useState<WaitingEntry[]>([]);
  const [isWaitingModalOpen, setIsWaitingModalOpen] = useState(false);
  const [editingWaiting, setEditingWaiting] = useState<WaitingEntry | null>(null);
  const [waitingForm, setWaitingForm] = useState({ name: "", phone: "", vehicle: "", description: "", status: "waiting" as WaitingEntry["status"] });
  const [pendingFromWaiting, setPendingFromWaiting] = useState<WaitingEntry | null>(null);
  const pendingWaitingIdRef = useRef<string | null>(null);

  const fetchNotesForSelectedDate = async () => {
    const startOfDay = new Date(selectedDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate); endOfDay.setHours(23, 59, 59, 999);
    const { data, error } = await supabase.from("appointments").select("*")
      .gte("appointment_date", startOfDay.toISOString())
      .lt("appointment_date", endOfDay.toISOString())
      .order("start_time", { ascending: true });
    if (error) setErrorMessage(`Error: ${error.message}`);
    else setNotes(data);
    setIsLoading(false);
  };

  const fetchWaitingList = async () => {
    const { data } = await supabase.from("waiting_list").select("*")
      .neq("status", "scheduled")
      .order("created_at", { ascending: true });
    if (data) setWaitingList(data as WaitingEntry[]);
  };

  useEffect(() => { fetchNotesRef.current = fetchNotesForSelectedDate; userRef.current = user; });

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) { const decoded = jwtDecode<DecodedToken>(data.session.access_token); setUser(decoded.email); }
      else setUser(null);
    };
    checkAuth();
    fetchNotesForSelectedDate();
  }, [selectedDate]);

  useEffect(() => {
    fetchWaitingList();
  }, []);

  useEffect(() => {
    const channel = supabase.channel("agenda-reservations");
    channel
      .on("broadcast", { event: "slot-reserved" }, ({ payload }: any) => {
        if (payload.action === "reserve") setReservingSlots((prev) => ({ ...prev, [payload.slot]: payload.user }));
        else setReservingSlots((prev) => { const next = { ...prev }; delete next[payload.slot]; return next; });
      })
      .on("broadcast", { event: "appointments-updated" }, () => { fetchNotesRef.current?.(); });
    channel.subscribe((status) => { if (status === "SUBSCRIBED") channelRef.current = channel; });
    const handleUnload = () => {
      if (channelRef.current && currentSlotRef.current)
        channelRef.current.send({ type: "broadcast", event: "slot-reserved", payload: { action: "release", slot: currentSlotRef.current, user: userRef.current } });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => { window.removeEventListener("beforeunload", handleUnload); supabase.removeChannel(channel); };
  }, []);

  const hours: string[] = [];
  for (let h = 8; h <= 17; h++) { hours.push(`${h.toString().padStart(2, "0")}:00`); if (h !== 17) hours.push(`${h.toString().padStart(2, "0")}:30`); }
  hours.push("17:30");

  const people = ["Botaguas", "Keilor", "Andrey", "Dylan A", "Dylan S", "Bicri"];

  const isTaskActiveDuringHour = (start: any, end: any, hour: any) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const [ch, cm] = hour.split(":").map(Number);
    return ch * 60 + cm >= sh * 60 + sm && ch * 60 + cm < eh * 60 + em;
  };

  const getFirstHourIndex = (startTime: any, hours: any) => {
    const [h, m] = startTime.split(":").map(Number);
    const start = h * 60 + m;
    for (let i = 0; i < hours.length; i++) { const [hh, mm] = hours[i].split(":").map(Number); if (start <= hh * 60 + mm) return i; }
    return -1;
  };

  const getLastHourIndex = (endTime: string, hours: string[]) => {
    const [eh, em] = endTime.split(":").map(Number);
    const end = eh * 60 + em;
    for (let i = hours.length - 1; i >= 0; i--) { const [h, m] = hours[i].split(":").map(Number); if (h * 60 + m < end) return i; }
    return -1;
  };

  const handleSaveNote = async () => {
    if (!currentTask.name.trim() || !currentTask.phone.trim() || !currentTask.vehicle.trim()) { setErrorMessage("Nombre, teléfono y vehículo son obligatorios."); return; }
    setErrorMessage("");
    const result = isNewTask
      ? await addNoteToSupabase({ ...currentTask, appointment_date: selectedDate.toISOString() })
      : await updateNoteInSupabase({ ...currentTask, appointment_date: selectedDate.toISOString() });
    if (result.error) { setErrorMessage(`Error: ${result.error.message}`); return; }
    if (channelRef.current && currentSlotRef.current) { channelRef.current.send({ type: "broadcast", event: "slot-reserved", payload: { action: "release", slot: currentSlotRef.current, user } }); currentSlotRef.current = null; }
    channelRef.current?.send({ type: "broadcast", event: "appointments-updated", payload: {} });
    // If scheduled from waiting list, mark as scheduled
    if (pendingWaitingIdRef.current) {
      await supabase.from("waiting_list").update({ status: "scheduled" }).eq("id", pendingWaitingIdRef.current);
      pendingWaitingIdRef.current = null;
      fetchWaitingList();
    }
    setIsModalOpen(false);
    await fetchNotesForSelectedDate();
    setCurrentTask({ start_time: "", end_time: "", assigned_person: "", name: "", phone: "", description: "", vehicle: "", status: "pending", appointment_date: new Date().toISOString() });
  };

  const handleDeleteNote = async (id: number | string) => {
    const { error } = await deleteNoteFromSupabase(id);
    if (error) { setErrorMessage(`Error: ${error.message}`); return; }
    if (channelRef.current && currentSlotRef.current) { channelRef.current.send({ type: "broadcast", event: "slot-reserved", payload: { action: "release", slot: currentSlotRef.current, user } }); currentSlotRef.current = null; }
    channelRef.current?.send({ type: "broadcast", event: "appointments-updated", payload: {} });
    setIsModalOpen(false);
    fetchNotesForSelectedDate();
  };

  const handleNewTaskClick = async (hour: string, person: string) => {
    if (user && channelRef.current) {
      const slot = `${person}-${hour}-${selectedDate.toISOString().split("T")[0]}`;
      currentSlotRef.current = slot;
      channelRef.current.send({ type: "broadcast", event: "slot-reserved", payload: { action: "reserve", slot, user } });
    }
    const prefill = pendingFromWaiting;
    if (prefill) {
      pendingWaitingIdRef.current = prefill.id;
      setPendingFromWaiting(null);
    }
    setCurrentTask({
      ...currentTask,
      start_time: hour,
      assigned_person: person,
      name: prefill?.name ?? "",
      phone: prefill?.phone ?? "",
      description: prefill?.description ?? "",
      vehicle: prefill?.vehicle ?? "",
      status: "pending",
    });
    setIsModalOpen(true);
    setIsNewTask(true);
  };

  const handleModalClose = () => {
    setErrorMessage("");
    pendingWaitingIdRef.current = null;
    if (channelRef.current && currentSlotRef.current) { channelRef.current.send({ type: "broadcast", event: "slot-reserved", payload: { action: "release", slot: currentSlotRef.current, user } }); currentSlotRef.current = null; }
    setIsModalOpen(false);
  };

  // Waiting list handlers
  const saveWaiting = async () => {
    if (editingWaiting) {
      await supabase.from("waiting_list").update(waitingForm).eq("id", editingWaiting.id);
    } else {
      await supabase.from("waiting_list").insert({ id: uuidv4(), ...waitingForm });
    }
    setIsWaitingModalOpen(false);
    setEditingWaiting(null);
    setWaitingForm({ name: "", phone: "", vehicle: "", description: "", status: "waiting" });
    fetchWaitingList();
  };

  const deleteWaiting = async (id: string) => {
    await supabase.from("waiting_list").delete().eq("id", id);
    if (pendingFromWaiting?.id === id) setPendingFromWaiting(null);
    fetchWaitingList();
  };

  const dateStr = selectedDate.toISOString().split("T")[0];
  const prevDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  const nextDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });

  if (isLoading) return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="h-5 w-56 bg-gray-200 rounded-lg" />
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 bg-gray-100 rounded-lg" /><div className="w-14 h-7 bg-gray-100 rounded-lg" /><div className="w-7 h-7 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex flex-col items-center p-4 bg-gray-50 border-r border-gray-200 shrink-0">
          <div className="w-[270px] h-[280px] bg-gray-200 rounded-xl" />
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-max rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[72px_repeat(6,minmax(120px,1fr))] bg-gray-50 border-b border-gray-200">
              <div className="py-3 px-2 flex justify-center"><div className="h-3 w-8 bg-gray-200 rounded" /></div>
              {[...Array(6)].map((_, i) => <div key={i} className="py-3 px-2 flex justify-center border-l border-gray-200"><div className="h-3 w-16 bg-gray-200 rounded" /></div>)}
            </div>
            {[...Array(12)].map((_, r) => (
              <div key={r} className={`grid grid-cols-[72px_repeat(6,minmax(120px,1fr))] border-b border-gray-100 ${r % 2 ? "bg-white" : "bg-gray-50/30"}`}>
                <div className="py-3 px-2 flex justify-center"><div className="h-3 w-10 bg-gray-100 rounded" /></div>
                {[...Array(6)].map((_, c) => <div key={c} className="border-l border-gray-100" style={{ minHeight: "3.25rem" }} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Date navigation bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-sm md:text-base font-semibold text-gray-900 capitalize">
          {selectedDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </h1>
        <div className="flex items-center gap-1.5">
          <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1 text-sm font-medium bg-[#07C3F8]/10 text-[#07C3F8] rounded-lg hover:bg-[#07C3F8]/20 transition-colors">
            Hoy
          </button>
          <button onClick={nextDay} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main layout: calendar sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar sidebar — desktop only */}
        <div className="hidden lg:flex flex-col items-center p-4 bg-gray-50 border-r border-gray-200 shrink-0">
          <DatePicker selected={selectedDate} onChange={(date) => setSelectedDate(date || new Date())} inline />
          <div className="mt-4 w-full space-y-1.5 px-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estados</p>
            {[
              { bg: "bg-sky-200",     label: "Pendiente",   desc: "Agendado, sin iniciar" },
              { bg: "bg-amber-200",   label: "Activo",      desc: "En proceso" },
              { bg: "bg-emerald-200", label: "Completado",  desc: "Trabajo finalizado" },
              { bg: "bg-violet-200",  label: "Reservando",  desc: "Otro usuario agendando" },
            ].map(({ bg, label, desc }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-sm shrink-0 ${bg}`} />
                <div>
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                  <span className="text-xs text-gray-400"> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule grid + waiting list */}
        <div className="flex-1 overflow-auto p-4">

          {/* Pending-from-waiting banner */}
          {pendingFromWaiting && (
            <div className="mb-4 flex items-center justify-between gap-3 bg-[#07C3F8]/10 border border-[#07C3F8]/30 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-[#07C3F8]">
                Selecciona un slot para <span className="font-bold">{pendingFromWaiting.name}</span> — haz clic en cualquier celda disponible
              </p>
              <button onClick={() => setPendingFromWaiting(null)} className="shrink-0 text-[#07C3F8] hover:text-[#06aad9] transition-colors">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Schedule grid */}
          <div className="min-w-max rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-8">
            {/* Grid header */}
            <div className="grid grid-cols-[72px_repeat(6,minmax(120px,1fr))] sticky top-0 z-[50] bg-gray-50 border-b border-gray-200">
              <div className="text-center py-3 border-r border-gray-200 sticky left-0 z-[60] bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">Hora</div>
              {people.map((person) => (
                <div key={person} className="text-center py-3 border-r border-gray-200 last:border-r-0 text-xs font-semibold text-gray-700 uppercase tracking-wider">{person}</div>
              ))}
            </div>

            {/* Hour rows */}
            {hours.map((hour, hourIndex) => (
              <div key={hour} className={`grid grid-cols-[72px_repeat(6,minmax(120px,1fr))] border-b border-gray-100 last:border-b-0 ${hourIndex % 2 ? "bg-white" : "bg-gray-50/30"}`}>
                <div className="text-center text-xs py-3 border-r border-gray-200 sticky left-0 z-[40] bg-inherit text-gray-400 font-mono">{hour}</div>
                {people.map((person) => {
                  const task = notes.find((note) => note.assigned_person === person && isTaskActiveDuringHour(note.start_time, note.end_time, hour));
                  const isFirstHour = task && getFirstHourIndex(task.start_time, hours) === hourIndex;
                  const isLastHour  = task && getLastHourIndex(task.end_time, hours) === hourIndex;
                  const status = task?.status;
                  const slotKey = `${person}-${hour}-${dateStr}`;
                  const reservingUser = !task && reservingSlots[slotKey] && reservingSlots[slotKey] !== user ? reservingSlots[slotKey] : null;

                  const cellClass = reservingUser
                    ? "cursor-pointer border-r border-gray-200 last:border-r-0 px-2 py-1.5 bg-violet-50 transition-colors"
                    : pendingFromWaiting && !task
                    ? "cursor-pointer border-r border-gray-200 last:border-r-0 px-2 py-1.5 bg-[#07C3F8]/5 hover:bg-[#07C3F8]/15 transition-colors"
                    : `cursor-pointer border-r border-gray-200 last:border-r-0 px-2 py-1.5 transition-colors ${
                        status === "pending" ? "bg-sky-50 hover:bg-sky-100"
                        : status === "active" ? "bg-amber-50 hover:bg-amber-100"
                        : status === "done"   ? "bg-emerald-50 hover:bg-emerald-100"
                        : "hover:bg-[#07C3F8]/5"
                      }`;

                  return (
                    <div
                      key={`${person}-${hour}`}
                      className={cellClass}
                      onClick={() => task ? (setCurrentTask(task), setIsNewTask(false), setIsModalOpen(true)) : handleNewTaskClick(hour, person)}
                      style={{ minHeight: "3.25rem", borderBottom: isLastHour ? "2px solid #07C3F8" : undefined }}
                    >
                      {isFirstHour && (
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-gray-800 leading-tight">{task.name || "—"}</p>
                          <p className="text-gray-500">{task.phone || "—"}</p>
                          <p className="text-gray-400 truncate">{task.vehicle || "—"}</p>
                        </div>
                      )}
                      {reservingUser && <div className="text-xs text-[#07C3F8] font-medium">Agendando... ({reservingUser})</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Waiting list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Lista de espera</h2>
                <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{waitingList.length}</span>
              </div>
              <button
                onClick={() => { setEditingWaiting(null); setWaitingForm({ name: "", phone: "", vehicle: "", description: "", status: "waiting" }); setIsWaitingModalOpen(true); }}
                className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-3 py-2 text-sm rounded-xl shadow-sm transition-colors"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>

            {waitingList.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400 text-sm">
                No hay clientes en lista de espera
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                        {["Nombre", "Teléfono", "Vehículo", "Descripción", "Registrado", "Estado", ""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {waitingList.map((entry, idx) => (
                        <tr key={entry.id} className={`transition-colors ${pendingFromWaiting?.id === entry.id ? "bg-[#07C3F8]/5" : "hover:bg-gray-50"}`}>
                          <td className="px-4 py-3 text-sm text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{entry.phone}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{entry.vehicle}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{entry.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                            {format(new Date(entry.created_at), "dd/MM/yyyy", { locale: es })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${waitingStatusStyle[entry.status]}`}>
                              {waitingStatusLabel[entry.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setPendingFromWaiting(pendingFromWaiting?.id === entry.id ? null : entry)}
                                title="Agendar"
                                className={`p-1.5 rounded-lg transition-colors ${pendingFromWaiting?.id === entry.id ? "text-[#07C3F8] bg-[#07C3F8]/10" : "text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10"}`}
                              >
                                <CalendarPlus size={14} />
                              </button>
                              <button
                                onClick={() => { setEditingWaiting(entry); setWaitingForm({ name: entry.name, phone: entry.phone, vehicle: entry.vehicle, description: entry.description, status: entry.status }); setIsWaitingModalOpen(true); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => deleteWaiting(entry.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {isModalOpen && (
        <TaskModal isOpen={isModalOpen} onClose={handleModalClose} onSave={handleSaveNote} task={currentTask} setTask={setCurrentTask} isNewTask={isNewTask} onDelete={handleDeleteNote} errorMessage={errorMessage} />
      )}

      {/* Waiting list add/edit modal */}
      {isWaitingModalOpen && (
        <Modal isOpen={isWaitingModalOpen} onClose={() => { setIsWaitingModalOpen(false); setEditingWaiting(null); }} title={editingWaiting ? "Editar cliente" : "Agregar a lista de espera"}>
          <div className="space-y-4">
            <div><label className={lbl}>Nombre</label><input className={inp} value={waitingForm.name} onChange={e => setWaitingForm({ ...waitingForm, name: e.target.value })} /></div>
            <div><label className={lbl}>Teléfono</label><input className={inp} value={waitingForm.phone} onChange={e => setWaitingForm({ ...waitingForm, phone: e.target.value })} /></div>
            <div><label className={lbl}>Vehículo</label><input className={inp} value={waitingForm.vehicle} onChange={e => setWaitingForm({ ...waitingForm, vehicle: e.target.value })} /></div>
            <div><label className={lbl}>Descripción del servicio</label><input className={inp} value={waitingForm.description} onChange={e => setWaitingForm({ ...waitingForm, description: e.target.value })} /></div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={waitingForm.status} onChange={e => setWaitingForm({ ...waitingForm, status: e.target.value as WaitingEntry["status"] })}>
                <option value="waiting">En espera</option>
                <option value="contacted">Contactado</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {editingWaiting && (
                <button onClick={() => { deleteWaiting(editingWaiting.id); setIsWaitingModalOpen(false); setEditingWaiting(null); }} className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                  Eliminar
                </button>
              )}
              <button onClick={saveWaiting} className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {errorMessage && !isModalOpen && (
        <div className="text-red-600 text-center p-3 bg-red-50 border-t border-red-200 text-sm shrink-0">{errorMessage}</div>
      )}
    </div>
  );
};

export default Agenda;
