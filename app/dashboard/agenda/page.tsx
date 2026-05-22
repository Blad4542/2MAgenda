"use client";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskModal from "@/components/TaskModal";
import { addNoteToSupabase, deleteNoteFromSupabase, updateNoteInSupabase } from "../../../utils/index";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DecodedToken { email: string; }

const Agenda = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<{
    start_time: string; end_time: string; assigned_person: string; name: string;
    phone: string; description: string; vehicle: string;
    status: "pending" | "active" | "done"; appointment_date: string;
  }>({ start_time: "", end_time: "", assigned_person: "", name: "", phone: "", description: "", vehicle: "", status: "pending", appointment_date: new Date().toISOString() });
  const [notes, setNotes] = useState<any[]>([]);
  const [isNewTask, setIsNewTask] = useState(true);
  const [user, setUser] = useState<string | null>(null);
  const [reservingSlots, setReservingSlots] = useState<Record<string, string>>({});
  const channelRef = useRef<any>(null);
  const currentSlotRef = useRef<string | null>(null);
  const fetchNotesRef = useRef<(() => Promise<void>) | null>(null);
  const userRef = useRef<string | null>(null);
  const supabase = createClient();

  const fetchNotesForSelectedDate = async () => {
    const startOfDay = new Date(selectedDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate); endOfDay.setHours(23, 59, 59, 999);
    const { data, error } = await supabase.from("appointments").select("*")
      .gte("appointment_date", startOfDay.toISOString())
      .lt("appointment_date", endOfDay.toISOString())
      .order("start_time", { ascending: true });
    if (error) setErrorMessage(`Error: ${error.message}`);
    else setNotes(data);
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

  const people = ["Botaguas", "Keilor", "Andrey", "Dylan", "Kenneth"];

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
    setCurrentTask({ ...currentTask, start_time: hour, assigned_person: person, name: "", phone: "", description: "", vehicle: "", status: "pending" });
    setIsModalOpen(true);
    setIsNewTask(true);
  };

  const handleModalClose = () => {
    setErrorMessage("");
    if (channelRef.current && currentSlotRef.current) { channelRef.current.send({ type: "broadcast", event: "slot-reserved", payload: { action: "release", slot: currentSlotRef.current, user } }); currentSlotRef.current = null; }
    setIsModalOpen(false);
  };

  const dateStr = selectedDate.toISOString().split("T")[0];
  const prevDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  const nextDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });

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

      {/* Main layout: calendar sidebar + schedule grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar sidebar — desktop only */}
        <div className="hidden lg:flex flex-col items-center p-4 bg-gray-50 border-r border-gray-200 shrink-0">
          <DatePicker selected={selectedDate} onChange={(date) => setSelectedDate(date || new Date())} inline />
        </div>

        {/* Schedule grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-max rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Grid header */}
            <div className="grid grid-cols-[72px_repeat(5,minmax(120px,1fr))] sticky top-0 z-[50] bg-gray-50 border-b border-gray-200">
              <div className="text-center py-3 border-r border-gray-200 sticky left-0 z-[60] bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">Hora</div>
              {people.map((person) => (
                <div key={person} className="text-center py-3 border-r border-gray-200 last:border-r-0 text-xs font-semibold text-gray-700 uppercase tracking-wider">{person}</div>
              ))}
            </div>

            {/* Hour rows */}
            {hours.map((hour, hourIndex) => (
              <div key={hour} className={`grid grid-cols-[72px_repeat(5,minmax(120px,1fr))] border-b border-gray-100 last:border-b-0 ${hourIndex % 2 ? "bg-white" : "bg-gray-50/30"}`}>
                <div className="text-center text-xs py-3 border-r border-gray-200 sticky left-0 z-[40] bg-inherit text-gray-400 font-mono">{hour}</div>
                {people.map((person) => {
                  const task = notes.find((note) => note.assigned_person === person && isTaskActiveDuringHour(note.start_time, note.end_time, hour));
                  const isFirstHour = task && getFirstHourIndex(task.start_time, hours) === hourIndex;
                  const isLastHour  = task && getLastHourIndex(task.end_time, hours) === hourIndex;
                  const status = task?.status;
                  const slotKey = `${person}-${hour}-${dateStr}`;
                  const reservingUser = !task && reservingSlots[slotKey] && reservingSlots[slotKey] !== user ? reservingSlots[slotKey] : null;

                  const cellClass = reservingUser
                    ? "cursor-pointer border-r border-gray-200 last:border-r-0 px-2 py-1.5 bg-blue-50 transition-colors"
                    : `cursor-pointer border-r border-gray-200 last:border-r-0 px-2 py-1.5 transition-colors ${
                        status === "pending" ? "bg-red-50 hover:bg-red-100"
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
        </div>
      </div>

      {isModalOpen && (
        <TaskModal isOpen={isModalOpen} onClose={handleModalClose} onSave={handleSaveNote} task={currentTask} setTask={setCurrentTask} isNewTask={isNewTask} onDelete={handleDeleteNote} errorMessage={errorMessage} />
      )}

      {errorMessage && !isModalOpen && (
        <div className="text-red-600 text-center p-3 bg-red-50 border-t border-red-200 text-sm shrink-0">{errorMessage}</div>
      )}
    </div>
  );
};

export default Agenda;
