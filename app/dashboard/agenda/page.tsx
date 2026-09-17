"use client";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskModal from "@/components/TaskModal";
import Modal from "@/components/Modal";
import { addNoteToSupabase, deleteNoteFromSupabase, updateNoteInSupabase } from "../../../utils/index";
import { findOrCreateCustomer, findOrCreateVehicle } from "@/utils/customers";
import { createClient } from "@/utils/supabase/client";
import { logAction } from "@/utils/auditLog";
import { getAppSetting, setAppSetting } from "@/utils/appSettings";
import { waUrl, WaIcon } from "@/utils/wa";
import { inp, lbl } from "@/utils/styles";
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, CalendarPlus, X, Settings } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { format, startOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale/es";

// ── Module-level constants (stable across renders) ──────────────────────────
const HOURS: string[] = [];
for (let h = 8; h <= 17; h++) {
  HOURS.push(`${h.toString().padStart(2, "0")}:00`);
  if (h !== 17) HOURS.push(`${h.toString().padStart(2, "0")}:30`);
}
HOURS.push("17:30");

function fmtTime(t: string): string {
  const [h, m] = t.slice(0, 5).split(":");
  return `${parseInt(h)}:${m}`;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
  return toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2);
}

function isTaskActiveDuringHour(start: string, end: string, hour: string): boolean {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const [ch, cm] = hour.split(":").map(Number);
  return ch * 60 + cm >= sh * 60 + sm && ch * 60 + cm < eh * 60 + em;
}

function getFirstHourIndex(startTime: string): number {
  const [h, m] = startTime.split(":").map(Number);
  const start = h * 60 + m;
  for (let i = 0; i < HOURS.length; i++) {
    const [hh, mm] = HOURS[i].split(":").map(Number);
    if (start <= hh * 60 + mm) return i;
  }
  return -1;
}

function getLastHourIndex(endTime: string): number {
  const [eh, em] = endTime.split(":").map(Number);
  const end = eh * 60 + em;
  for (let i = HOURS.length - 1; i >= 0; i--) {
    const [h, m] = HOURS[i].split(":").map(Number);
    if (h * 60 + m < end) return i;
  }
  return -1;
}
// ─────────────────────────────────────────────────────────────────────────────

interface DecodedToken { email: string; }

interface StaffMember { id: string; name: string; }

interface Appointment {
  id: string | number;
  start_time: string;
  end_time: string;
  assigned_person: string;
  staff_id?: string;
  name: string;
  phone: string;
  description: string;
  vehicle: string;
  status: "pending" | "active" | "done";
  appointment_date: string;
  customer_id?: string;
  vehicle_id?: string;
  appointment_tasks?: { id: string; description: string; completed: boolean }[];
}

interface WaitingEntry {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  description: string;
  created_at: string;
  status: "waiting" | "contacted" | "scheduled";
  pending_tasks?: string[];
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


const Agenda = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<{
    id?: string | number; start_time: string; end_time: string; assigned_person: string; staff_id?: string; name: string;
    phone: string; description: string; vehicle: string;
    status: "pending" | "active" | "done"; appointment_date: string;
    customer_id?: string; vehicle_id?: string;
  }>({ start_time: "", end_time: "", assigned_person: "", staff_id: undefined, name: "", phone: "", description: "", vehicle: "", status: "pending", appointment_date: new Date().toISOString() });
  const [notes, setNotes] = useState<Appointment[]>([]);
  const [isNewTask, setIsNewTask] = useState(true);
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reservingSlots, setReservingSlots] = useState<Record<string, string>>({});
  const channelRef = useRef<any>(null);
  const currentSlotRef = useRef<string | null>(null);
  const fetchNotesRef = useRef<(() => Promise<void>) | null>(null);
  const userRef = useRef<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const PEOPLE = useMemo(() => staff.map(s => s.name), [staff]);
  const GRID_COLS = useMemo(() => `72px repeat(${PEOPLE.length}, minmax(120px, 1fr))`, [PEOPLE]);

  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  // Waiting list state
  const [waitingList, setWaitingList] = useState<WaitingEntry[]>([]);
  const [isWaitingModalOpen, setIsWaitingModalOpen] = useState(false);
  const [editingWaiting, setEditingWaiting] = useState<WaitingEntry | null>(null);
  const [waitingForm, setWaitingForm] = useState({ name: "", phone: "", vehicle: "", description: "", status: "waiting" as WaitingEntry["status"] });
  const [waitingTasks, setWaitingTasks] = useState<string[]>([]);
  const [newWaitingTaskText, setNewWaitingTaskText] = useState("");
  const [pendingTasksForModal, setPendingTasksForModal] = useState<string[]>([]);
  const [pendingFromWaiting, setPendingFromWaiting] = useState<WaitingEntry | null>(null);
  const pendingWaitingIdRef = useRef<string | null>(null);

  // Week view state
  const [weekView, setWeekView] = useState(false);
  const [weekData, setWeekData] = useState<Record<string, Record<string, number>>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  // Settings
  const [businessPhone, setBusinessPhone] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPhone, setSettingsPhone] = useState("");
  const [dragging, setDragging] = useState<Appointment | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const fetchNotesForSelectedDate = async () => {
    const startOfDay = new Date(selectedDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate); endOfDay.setHours(23, 59, 59, 999);
    const { data, error } = await supabase.from("appointments")
      .select("*, appointment_tasks(id,description,completed)")
      .gte("appointment_date", startOfDay.toISOString())
      .lt("appointment_date", endOfDay.toISOString())
      .order("start_time", { ascending: true });
    if (error) setErrorMessage(`Error: ${error.message}`);
    else setNotes(data ?? []);
    setIsLoading(false);
  };

  const fetchWaitingList = async () => {
    const { data } = await supabase.from("waiting_list").select("*")
      .neq("status", "scheduled")
      .order("created_at", { ascending: true });
    if (data) setWaitingList(data as WaitingEntry[]);
  };

  const fetchWeekData = async (date: Date) => {
    setWeekLoading(true);
    const mon = startOfWeek(date, { weekStartsOn: 1 });
    const sun = addDays(mon, 6);
    sun.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("appointments")
      .select("assigned_person, appointment_date")
      .gte("appointment_date", mon.toISOString())
      .lte("appointment_date", sun.toISOString());
    const result: Record<string, Record<string, number>> = {};
    if (data) {
      for (const row of data) {
        const person = row.assigned_person as string;
        const dayKey = new Date(row.appointment_date).toISOString().split("T")[0];
        if (!result[person]) result[person] = {};
        result[person][dayKey] = (result[person][dayKey] ?? 0) + 1;
      }
    }
    setWeekData(result);
    setWeekLoading(false);
  };

  useEffect(() => { fetchNotesRef.current = fetchNotesForSelectedDate; userRef.current = user; });

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) { const decoded = jwtDecode<DecodedToken>(data.session.access_token); setUser(decoded.email); setUserEmail(decoded.email); }
      else setUser(null);
    };
    checkAuth();
    fetchNotesForSelectedDate();
  }, [selectedDate]);

  useEffect(() => {
    fetchWaitingList();
    getAppSetting("business_phone").then(v => { if (v) { setBusinessPhone(v); setSettingsPhone(v); } });
    supabase.from("staff").select("id, name").eq("active", true).order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setStaff(data as StaffMember[]); });
  }, []);

  useEffect(() => {
    if (weekView) fetchWeekData(selectedDate);
  }, [weekView, selectedDate]);

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

  // O(1) lookup per cell instead of O(n) find across 66 cells
  const notesIndex = useMemo(() => {
    const index = new Map<string, Appointment>();
    for (const note of notes) {
      for (const hour of HOURS) {
        if (isTaskActiveDuringHour(note.start_time, note.end_time, hour)) {
          index.set(`${note.assigned_person}-${hour}`, note);
        }
      }
    }
    return index;
  }, [notes]);

  const dailyLoad = useMemo(() =>
    PEOPLE.map(person => {
      const occupied = HOURS.filter(h => notesIndex.has(`${person}-${h}`)).length;
      return { person, occupied, total: HOURS.length };
    }),
    [notesIndex]
  );

  const weekDays = useMemo(() => {
    const mon = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [selectedDate]);

  const confirmAppt = async (id: string | number) => {
    await supabase.from("appointments").update({ status: "confirmed" }).eq("id", id);
    await fetchNotesForSelectedDate();
  };

  const handleDrop = async (targetPerson: string) => {
    if (!dragging || dragging.assigned_person === targetPerson) { setDragging(null); setDropTarget(null); return; }
    const conflict = notes.some(n =>
      n.id !== dragging.id &&
      n.assigned_person === targetPerson &&
      timesOverlap(n.start_time, n.end_time, dragging.start_time, dragging.end_time)
    );
    if (conflict) {
      setErrorMessage(`${targetPerson} ya tiene una cita en ese horario.`);
      setDragging(null); setDropTarget(null); return;
    }
    const staffMember = staff.find(s => s.name === targetPerson);
    await supabase.from("appointments").update({
      assigned_person: targetPerson,
      staff_id: staffMember?.id ?? null,
    }).eq("id", dragging.id);
    setDragging(null); setDropTarget(null);
    await fetchNotesForSelectedDate();
  };

  const handleSaveNote = async (pendingTasks?: string[]) => {
    if (!currentTask.name.trim() || !currentTask.phone.trim() || (!currentTask.vehicle.trim() && !currentTask.vehicle_id)) { setErrorMessage("Nombre, teléfono y vehículo son obligatorios."); return; }
    if (currentTask.phone.replace(/\D/g, "").length < 8) { setErrorMessage("El teléfono debe tener al menos 8 dígitos."); return; }
    if (isNewTask && (!pendingTasks || pendingTasks.length === 0)) { setErrorMessage("Agrega al menos una tarea."); return; }
    setErrorMessage("");
    const desc = `Cita de ${currentTask.name} — ${currentTask.assigned_person} ${currentTask.start_time}`;
    let customerId = currentTask.customer_id;
    let vehicleId = currentTask.vehicle_id;
    try {
      customerId = await findOrCreateCustomer(supabase, currentTask.phone, currentTask.name);
      vehicleId = await findOrCreateVehicle(supabase, customerId, currentTask.vehicle);
    } catch {
      // Non-fatal: appointment still saves without customer link
    }
    if (isNewTask) {
      const result = await addNoteToSupabase({ ...currentTask, appointment_date: selectedDate.toISOString(), customer_id: customerId, vehicle_id: vehicleId });
      if (result.error) { setErrorMessage(`Error: ${result.error.message}`); return; }
      const insertedId = String(result.data?.[0]?.id ?? "");
      await logAction(supabase, { table_name: "appointments", record_id: insertedId, action: "create", description: desc, user_email: userEmail });
      if (pendingTasks && pendingTasks.length > 0 && insertedId) {
        await supabase.from("appointment_tasks").insert(
          pendingTasks.map(t => ({ appointment_id: Number(insertedId), description: t }))
        );
      }
    } else {
      const result = await updateNoteInSupabase({ ...currentTask, appointment_date: selectedDate.toISOString(), customer_id: customerId, vehicle_id: vehicleId });
      if (result.error) { setErrorMessage(`Error: ${result.error.message}`); return; }
      await logAction(supabase, { table_name: "appointments", record_id: String(currentTask.id ?? ""), action: "update", description: desc, user_email: userEmail });
    }
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
    setCurrentTask({ start_time: "", end_time: "", assigned_person: "", staff_id: undefined, name: "", phone: "", description: "", vehicle: "", status: "pending", appointment_date: new Date().toISOString(), customer_id: undefined, vehicle_id: undefined });
  };

  const handleDeleteNote = async (id: number | string) => {
    const appt = notes.find(n => n.id === id);
    const { error } = await deleteNoteFromSupabase(id);
    if (error) { setErrorMessage(`Error: ${error.message}`); return; }
    await logAction(supabase, { table_name: "appointments", record_id: String(id), action: "delete", description: appt ? `Cita de ${appt.name} — ${appt.assigned_person} ${appt.start_time}` : undefined, user_email: userEmail });
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
      setPendingTasksForModal(prefill.pending_tasks ?? []);
    } else {
      setPendingTasksForModal([]);
    }
    const staffMember = staff.find(s => s.name === person);
    setCurrentTask({
      ...currentTask,
      start_time: hour,
      assigned_person: person,
      staff_id: staffMember?.id,
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
    setPendingTasksForModal([]);
    if (channelRef.current && currentSlotRef.current) { channelRef.current.send({ type: "broadcast", event: "slot-reserved", payload: { action: "release", slot: currentSlotRef.current, user } }); currentSlotRef.current = null; }
    setIsModalOpen(false);
  };

  // Waiting list handlers
  const saveWaiting = async () => {
    const entryId = editingWaiting ? editingWaiting.id : uuidv4();
    const payload = { ...waitingForm, pending_tasks: waitingTasks };
    if (editingWaiting) {
      await supabase.from("waiting_list").update(payload).eq("id", entryId);
    } else {
      await supabase.from("waiting_list").insert({ id: entryId, ...payload });
    }
    setIsWaitingModalOpen(false);
    setEditingWaiting(null);
    setWaitingForm({ name: "", phone: "", vehicle: "", description: "", status: "waiting" });
    setWaitingTasks([]);
    setNewWaitingTaskText("");
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
            <div className="grid bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: GRID_COLS }}>
              <div className="py-3 px-2 flex justify-center"><div className="h-3 w-8 bg-gray-200 rounded" /></div>
              {PEOPLE.map((_, i) => <div key={i} className="py-3 px-2 flex justify-center border-l border-gray-200"><div className="h-3 w-16 bg-gray-200 rounded" /></div>)}
            </div>
            {[...Array(12)].map((_, r) => (
              <div key={r} className={`grid border-b border-gray-100 ${r % 2 ? "bg-white" : "bg-gray-50/30"}`} style={{ gridTemplateColumns: GRID_COLS }}>
                <div className="py-3 px-2 flex justify-center"><div className="h-3 w-10 bg-gray-100 rounded" /></div>
                {PEOPLE.map((_, c) => <div key={c} className="border-l border-gray-100" style={{ minHeight: "3.25rem" }} />)}
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
        <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 ml-1">
            <button
              onClick={() => setWeekView(false)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${!weekView ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Día
            </button>
            <button
              onClick={() => setWeekView(true)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${weekView ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Semana
            </button>
          </div>
          <button
            onClick={() => { setSettingsPhone(businessPhone); setSettingsOpen(true); }}
            title="Configurar número del negocio"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors ml-1"
          >
            <Settings size={16} />
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
              { bg: "bg-sky-200",     label: "Pendiente",   desc: "Sin confirmar" },
              { bg: "bg-indigo-200",  label: "Confirmada",  desc: "Cliente confirmó" },
              { bg: "bg-amber-200",   label: "En proceso",  desc: "Trabajo iniciado" },
              { bg: "bg-emerald-200", label: "Completada",  desc: "Trabajo finalizado" },
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
          {!weekView && (
            <div className="mt-5 w-full space-y-2.5 px-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Carga del día</p>
              {dailyLoad.map(({ person, occupied, total }) => {
                const pct = total > 0 ? occupied / total : 0;
                const barColor = pct < 0.4 ? "bg-emerald-400" : pct < 0.7 ? "bg-amber-400" : "bg-red-400";
                return (
                  <div key={person}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{person}</span>
                      <span className="text-xs text-gray-400">{occupied}/{total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.round(pct * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

          {/* Schedule grid (day view) or Week table */}
          {weekView ? (
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-8">
              {weekLoading ? (
                <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Cargando semana...</div>
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Técnico</th>
                      {weekDays.map(day => (
                        <th key={day.toISOString()} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {format(day, "EEE d", { locale: es })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {PEOPLE.map(person => (
                      <tr key={person} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{person}</td>
                        {weekDays.map(day => {
                          const dayKey = day.toISOString().split("T")[0];
                          const count = weekData[person]?.[dayKey] ?? 0;
                          const cellStyle = count === 0
                            ? "bg-gray-100 text-gray-400"
                            : count <= 3 ? "bg-emerald-100 text-emerald-700"
                            : count <= 6 ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700";
                          return (
                            <td
                              key={dayKey}
                              className="px-3 py-3 text-center cursor-pointer hover:opacity-75 transition-opacity"
                              onClick={() => { setSelectedDate(day); setWeekView(false); }}
                            >
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-semibold ${cellStyle}`}>
                                {count || "—"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="min-w-max rounded-xl border border-gray-200 overflow-clip shadow-sm mb-8">
              {/* Grid header */}
              <div className="grid sticky top-0 z-[50] bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: GRID_COLS }}>
                <div className="text-center py-3 border-r border-gray-200 sticky left-0 z-[60] bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">Hora</div>
                {PEOPLE.map((person) => (
                  <div key={person} className="text-center py-3 border-r border-gray-200 last:border-r-0 text-xs font-semibold text-gray-700 uppercase tracking-wider">{person}</div>
                ))}
              </div>

              {/* Hour rows */}
              {HOURS.map((hour, hourIndex) => (
                <div key={hour} className={`grid border-b border-gray-100 last:border-b-0 ${hourIndex % 2 ? "bg-white" : "bg-gray-50/30"}`} style={{ gridTemplateColumns: GRID_COLS }}>
                  <div className="text-center text-xs py-3 border-r border-gray-200 sticky left-0 z-[40] bg-inherit text-gray-400 font-mono">{hour}</div>
                  {PEOPLE.map((person) => {
                    const task = notesIndex.get(`${person}-${hour}`);
                    const isFirstHour = task && getFirstHourIndex(task.start_time) === hourIndex;
                    const isLastHour  = task && getLastHourIndex(task.end_time) === hourIndex;
                    const status = task?.status;
                    const slotKey = `${person}-${hour}-${dateStr}`;
                    const reservingUser = !task && reservingSlots[slotKey] && reservingSlots[slotKey] !== user ? reservingSlots[slotKey] : null;

                    const accentColor =
                      status === "pending"   ? "#38bdf8"
                      : status === "confirmed" ? "#818cf8"
                      : status === "active"  ? "#fbbf24"
                      : status === "done"    ? "#34d399"
                      : "transparent";

                    const isDropping = dragging && dropTarget === person && person !== dragging.assigned_person;
                    const isDropConflict = isDropping && notes.some(n =>
                      n.id !== dragging!.id && n.assigned_person === person &&
                      timesOverlap(n.start_time, n.end_time, dragging!.start_time, dragging!.end_time)
                    );

                    const cellBase = "cursor-pointer border-r border-gray-100 last:border-r-0 transition-colors overflow-hidden min-w-0";
                    const cellBg = isDropConflict
                      ? "bg-red-50 border-2 border-red-300"
                      : isDropping
                      ? "bg-green-50 border-2 border-green-300"
                      : reservingUser
                      ? "bg-violet-50 hover:bg-violet-100"
                      : pendingFromWaiting && !task
                      ? "bg-green-50 hover:bg-green-100 border-dashed border-green-300"
                      : status === "pending"   ? "bg-sky-50 hover:bg-sky-100"
                      : status === "confirmed" ? "bg-indigo-50 hover:bg-indigo-100"
                      : status === "active"    ? "bg-amber-50 hover:bg-amber-100"
                      : status === "done"      ? "bg-emerald-50 hover:bg-emerald-100"
                      : "hover:bg-[#07C3F8]/5";

                    return (
                      <div
                        key={`${person}-${hour}`}
                        draggable={!!task}
                        className={`group ${cellBase} ${cellBg}`}
                        onDragStart={(e) => { if (task) { e.dataTransfer.effectAllowed = "move"; setDragging(task); } }}
                        onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                        onDragOver={(e) => { if (dragging && person !== dragging.assigned_person) { e.preventDefault(); setDropTarget(person); } }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
                        onDrop={(e) => { e.preventDefault(); handleDrop(person); }}
                        onClick={() => !dragging && (task ? (setCurrentTask(task), setIsNewTask(false), setIsModalOpen(true)) : handleNewTaskClick(hour, person))}
                        style={{
                          minHeight: "3.25rem",
                          borderBottom: isLastHour ? `2px solid ${accentColor}` : undefined,
                          borderLeft: task ? `3px solid ${accentColor}` : undefined,
                        }}
                      >
                        {isFirstHour && (
                          <div className="px-2 pt-2 pb-2 flex flex-col gap-1 min-w-0 overflow-hidden">
                            <div className="flex items-start justify-between gap-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate leading-tight">{task.name || "—"}</p>
                              {status === "pending" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); task.id != null && confirmAppt(task.id); }}
                                  title="Confirmar cita"
                                  className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center transition-colors"
                                >
                                  <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="#6366f1" strokeWidth="1.5"><path d="M2 5l2 2 4-4"/></svg>
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap">{fmtTime(task.start_time)}–{fmtTime(task.end_time)}</span>
                              {task.vehicle && <span className="text-[11px] text-gray-400 truncate">· {task.vehicle}</span>}
                            </div>
                            {task.appointment_tasks && task.appointment_tasks.length > 0 && (
                              <ul className="space-y-0.5">
                                {task.appointment_tasks.map(t => (
                                  <li key={t.id} className="flex items-start gap-1">
                                    <span className={`mt-px shrink-0 w-2.5 h-2.5 rounded-sm border flex items-center justify-center ${t.completed ? "bg-emerald-400 border-emerald-400" : "border-gray-300 bg-white"}`}>
                                      {t.completed && <svg viewBox="0 0 8 8" width="6" height="6" fill="white"><path d="M1 4l2 2 4-4"/></svg>}
                                    </span>
                                    <span className={`text-[11px] leading-tight truncate ${t.completed ? "line-through text-gray-300" : "text-gray-600"}`}>{t.description}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {task.description && <p className="text-[11px] text-gray-400 truncate leading-tight italic">{task.description}</p>}
                          </div>
                        )}
                        {reservingUser && <div className="px-2 py-1.5 text-[11px] text-violet-500 font-medium truncate">Agendando… ({reservingUser})</div>}
                        {pendingFromWaiting && !task && !reservingUser && (
                          <div className="hidden group-hover:flex px-2 py-1.5 items-center justify-center text-[11px] text-green-600 font-medium h-full">+ Agendar aquí</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Waiting list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Lista de espera</h2>
                <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{waitingList.length}</span>
              </div>
              <button
                onClick={() => { setEditingWaiting(null); setWaitingForm({ name: "", phone: "", vehicle: "", description: "", status: "waiting" }); setWaitingTasks([]); setNewWaitingTaskText(""); setIsWaitingModalOpen(true); }}
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
                        {["Nombre", "Teléfono", "Vehículo", "Tareas", "Notas", "Registrado", "Estado", ""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {waitingList.map((entry, idx) => (
                        <tr key={entry.id} className={`transition-colors ${pendingFromWaiting?.id === entry.id ? "bg-[#07C3F8]/5" : "hover:bg-gray-50"}`}>
                          <td className="px-4 py-3 text-sm text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <span>{entry.phone}</span>
                              {entry.phone && (
                                <a href={waUrl(entry.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${entry.name}`} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                                  <WaIcon />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{entry.vehicle}</td>
                          <td className="px-4 py-3">
                            {(entry.pending_tasks ?? []).length === 0 ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {(entry.pending_tasks ?? []).map((t, i) => (
                                  <li key={i} className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                    <span className="text-xs text-gray-600 whitespace-nowrap">{t}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
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
                                onClick={() => { setEditingWaiting(entry); setWaitingForm({ name: entry.name, phone: entry.phone, vehicle: entry.vehicle, description: entry.description, status: entry.status }); setWaitingTasks(entry.pending_tasks ?? []); setNewWaitingTaskText(""); setIsWaitingModalOpen(true); }}
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
        <TaskModal isOpen={isModalOpen} onClose={handleModalClose} onSave={handleSaveNote} task={currentTask} setTask={setCurrentTask} isNewTask={isNewTask} onDelete={handleDeleteNote} errorMessage={errorMessage} businessPhone={businessPhone} appointmentDate={selectedDate} supabase={supabase} initialPendingTasks={pendingTasksForModal} />
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Configuración">
          <div className="space-y-4">
            <div>
              <label className={lbl}>Número del negocio (WhatsApp)</label>
              <input
                className={inp}
                placeholder="Ej: 88001122 o 50688001122"
                value={settingsPhone}
                onChange={e => setSettingsPhone(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1.5">Se incluye en el mensaje de confirmación de citas.</p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={async () => {
                  await setAppSetting("business_phone", settingsPhone);
                  setBusinessPhone(settingsPhone);
                  setSettingsOpen(false);
                }}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Waiting list add/edit modal */}
      {isWaitingModalOpen && (
        <Modal isOpen={isWaitingModalOpen} onClose={() => { setIsWaitingModalOpen(false); setEditingWaiting(null); setWaitingTasks([]); setNewWaitingTaskText(""); }} title={editingWaiting ? "Editar cliente" : "Agregar a lista de espera"}>
          <div className="space-y-3">
            {/* Teléfono + WA */}
            <div>
              <label className={lbl}>Teléfono</label>
              <div className="flex items-center gap-2">
                <input className={inp} value={waitingForm.phone} onChange={e => setWaitingForm({ ...waitingForm, phone: e.target.value })} />
                {waitingForm.phone && (
                  <a
                    href={waUrl(waitingForm.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors"
                  >
                    <WaIcon />
                  </a>
                )}
              </div>
            </div>
            {/* Nombre */}
            <div><label className={lbl}>Nombre</label><input className={inp} value={waitingForm.name} onChange={e => setWaitingForm({ ...waitingForm, name: e.target.value })} /></div>
            {/* Vehículo */}
            <div><label className={lbl}>Vehículo</label><input className={inp} value={waitingForm.vehicle} onChange={e => setWaitingForm({ ...waitingForm, vehicle: e.target.value })} /></div>
            {/* Tareas */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex-1">Tareas</span>
                <input
                  type="text"
                  value={newWaitingTaskText}
                  onChange={e => setNewWaitingTaskText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return;
                    const text = newWaitingTaskText.trim();
                    if (text) { setWaitingTasks(prev => [...prev, text]); setNewWaitingTaskText(""); }
                  }}
                  placeholder="Nueva tarea…"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#07C3F8]"
                />
                <button
                  onClick={() => {
                    const text = newWaitingTaskText.trim();
                    if (text) { setWaitingTasks(prev => [...prev, text]); setNewWaitingTaskText(""); }
                  }}
                  disabled={!newWaitingTaskText.trim()}
                  className="p-1.5 rounded-lg bg-[#07C3F8] text-white hover:bg-[#06aad9] disabled:opacity-40 transition-colors"
                  aria-label="Agregar tarea"
                >
                  <Plus size={16} />
                </button>
              </div>
              {waitingTasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">Sin tareas aún</p>
              ) : (
                <ul className="space-y-2">
                  {waitingTasks.map((text, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700">{text}</span>
                      <button
                        onClick={() => setWaitingTasks(prev => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Eliminar tarea"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Estado */}
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={waitingForm.status} onChange={e => setWaitingForm({ ...waitingForm, status: e.target.value as WaitingEntry["status"] })}>
                <option value="waiting">En espera</option>
                <option value="contacted">Contactado</option>
              </select>
            </div>
            {/* Notas */}
            <div><label className={lbl}>Notas</label><textarea className={inp} value={waitingForm.description} onChange={e => setWaitingForm({ ...waitingForm, description: e.target.value })} /></div>
            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              {editingWaiting && (
                <button onClick={() => { deleteWaiting(editingWaiting.id); setIsWaitingModalOpen(false); setEditingWaiting(null); setWaitingTasks([]); }} className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
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
