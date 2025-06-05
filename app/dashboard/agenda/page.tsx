"use client";
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskModal from "../../../components/TaskModal";
import {
  addNoteToSupabase,
  deleteNoteFromSupabase,
  updateNoteInSupabase,
} from "../../../utils/index";
import { createClient } from "@/utils/supabase/client";

interface DecodedToken {
  email: string;
}

const Agenda = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState({
    start_time: "",
    end_time: "",
    assigned_person: "",
    name: "",
    phone: "",
    description: "",
    vehicle: "",
    status: "pending", // Estado inicial
    appointment_date: new Date().toISOString(), // Inicializa con la fecha actual, se actualizará al seleccionar una fecha
  });
  const [notes, setNotes] = useState<any[]>([]);
  const [isNewTask, setIsNewTask] = useState(true);
  const [user, setUser] = useState<string | null>(null);

  const supabase = createClient();

  const currentDate = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchNotesForSelectedDate = async () => {
    // Establece el inicio y final del día seleccionado correctamente
    const startOfSelectedDay = new Date(selectedDate);
    startOfSelectedDay.setHours(0, 0, 0, 0);
    const endOfSelectedDay = new Date(selectedDate);
    endOfSelectedDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .gte("appointment_date", startOfSelectedDay.toISOString())
      .lt("appointment_date", endOfSelectedDay.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error al recuperar las notas:", error);
      setErrorMessage(`Error al recuperar las notas: ${error.message}`);
    } else {
      setNotes(data);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data && data.session) {
        const decoded = jwtDecode<DecodedToken>(data.session.access_token);
        setUser(decoded.email); // Establece el usuario solo si la sesión existe
      } else {
        setUser(null); // Establece el usuario a null si no hay sesión
      }
    };
    checkAuth();
    fetchNotesForSelectedDate();
  }, [selectedDate]);

  const hours: string[] = [];
  for (let hour = 8; hour <= 17; hour++) {
    hours.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour !== 17) {
      // Asegúrate de no agregar 5:30 PM en esta iteración
      hours.push(`${hour.toString().padStart(2, "0")}:30`);
    }
  }
  hours.push("17:30"); // Añade manualmente 5:30 PM al final del bucle

  const people = ["Josué", "Keilor", "Andrey", "Dylan", "Steven"];

  const handleCellClick = (hour: string, person: string): void => {
    const dateOfAppointment = new Date(selectedDate);
    const [hourOfDay, minutes] = hour.split(":").map(Number);

    dateOfAppointment.setHours(hourOfDay, minutes, 0);
    const startTime = dateOfAppointment.toISOString();

    dateOfAppointment.setMinutes(dateOfAppointment.getMinutes() + 59); // Suponiendo que cada cita dura 59 minutos
    const endTime = dateOfAppointment.toISOString();

    const existingTask = notes.find(
      (note) => note.start_time === startTime && note.assigned_person === person
    );

    if (existingTask) {
      setCurrentTask(existingTask);
      setIsNewTask(false);
    } else {
      setCurrentTask({
        start_time: startTime,
        end_time: endTime,
        assigned_person: person,
        name: "",
        phone: "",
        description: "",
        vehicle: "",
        status: "pending",
        appointment_date: selectedDate.toISOString(), // Utiliza la fecha seleccionada en el DatePicker
      });
      setIsNewTask(true);
    }
    setIsModalOpen(true);
  };

  const handleSaveNote = async () => {
    let result;
    if (isNewTask) {
      result = await addNoteToSupabase({
        ...currentTask,
        appointment_date: selectedDate.toISOString(), // Asegúrate de que se pasa la fecha correcta
      });
    } else {
      result = await updateNoteInSupabase({
        ...currentTask,
        appointment_date: selectedDate.toISOString(), // Asegúrate de que se actualiza la fecha si es una edición
      });
    }

    if (result.error) {
      console.error("Error al guardar la nota:", result.error.message);
      setErrorMessage(`Error al guardar la nota: ${result.error.message}`);
    } else {
      setIsModalOpen(false);
      await fetchNotesForSelectedDate(); // Recarga las notas para el día seleccionado
      setCurrentTask({
        start_time: "",
        end_time: "",
        assigned_person: "",
        name: "",
        phone: "",
        description: "",
        vehicle: "",
        status: "pending",
        appointment_date: new Date().toISOString(), // Restablece a la fecha actual para el estado inicial
      });
    }
  };

  const handleDeleteNote = async (id: number | string) => {
    const { error } = await deleteNoteFromSupabase(id);
    if (error) {
      console.error("Error al eliminar la nota:", error.message);
      setErrorMessage(`Error al eliminar la nota: ${error.message}`);
    } else {
      // Cierra el modal y actualiza la lista de notas.
      setIsModalOpen(false);
      fetchNotesForSelectedDate();
    }
  };

  const getBgColorBasedOnStatus = (status: any, isAdjacent: boolean) => {
    let baseClass = "p-4 cursor-pointer border-r border-gray-300"; // Clase base con borde
    if (isAdjacent) {
      baseClass = "p-4 cursor-pointer"; // Remueve el borde si es adyacente
    }

    switch (status) {
      case "pending":
        return `${baseClass} bg-red-500`;
      case "active":
        return `${baseClass} bg-yellow-500`;
      case "done":
        return `${baseClass} bg-green-500`;
      default:
        return `${baseClass} bg-transparent`;
    }
  };

  const isTaskActiveDuringHour = (
    start_time: any,
    end_time: any,
    hour: any
  ) => {
    // Asumiendo que start_time y end_time están en formato 'HH:MM'
    const [startHour, startMinute] = start_time.split(":").map(Number);
    const [endHour, endMinute] = end_time.split(":").map(Number);
    const [checkHour, checkMinute] = hour.split(":").map(Number);

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;
    const checkTimeMinutes = checkHour * 60 + checkMinute;

    return (
      checkTimeMinutes >= startTimeMinutes && checkTimeMinutes < endTimeMinutes
    );
  };

  const getFirstHourIndex = (taskStartTime: any, hours: any) => {
    const taskStart = taskStartTime.split(":").map(Number);
    const taskStartMinutes = taskStart[0] * 60 + taskStart[1];

    for (let i = 0; i < hours.length; i++) {
      const hourParts = hours[i].split(":").map(Number);
      const hourMinutes = hourParts[0] * 60 + hourParts[1];

      if (taskStartMinutes <= hourMinutes) {
        return i;
      }
    }

    return -1; // En caso de no encontrar una coincidencia, lo cual no debería ocurrir si las tareas siempre comienzan en una hora definida en `hours`
  };

  const handleNewTaskClick = (hour: string, person: string): void => {
    setCurrentTask({
      ...currentTask,
      start_time: hour,
      assigned_person: person,
      name: "",
      phone: "",
      description: "",
      vehicle: "",
      status: "pending",
    });
    setIsModalOpen(true);
    setIsNewTask(true);
  };

  const handleTaskClick = (task: any) => {
    setCurrentTask(task);
    setIsNewTask(false);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-[#ECF4F9] shadow-md">
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date || new Date())}
          inline
        />
        <h1 className="text-2xl md:text-4xl font-semibold text-gray-800 text-center md:text-left">
          {selectedDate
            .toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
            .toUpperCase()}
        </h1>
      </div>
      <div className="flex-grow overflow-auto bg-[#F7FAFC] p-4">
        <div className="overflow-x-auto">
          <div className="min-w-max shadow rounded-lg">
            <div className="grid grid-cols-[80px_repeat(5,1fr)] bg-[#CFEAFB] text-gray-900 font-semibold sticky top-0 z-10">
              <div className="text-center py-2 border-r border-gray-300 sticky left-0 z-10 bg-[#CFEAFB]">
                Hora
              </div>
              {people.map((person) => (
                <div
                  key={person}
                  className="text-center py-2 border-r border-gray-300"
                >
                  {person}
                </div>
              ))}
            </div>

            {hours.map((hour, hourIndex) => (
              <div
                key={hour}
                className={`grid grid-cols-[80px_repeat(5,1fr)] ${
                  hourIndex % 2 ? "bg-white" : "bg-[#F1F8FC]"
                }`}
              >
                <div className="text-center text-sm py-3 border-r border-gray-300">
                  {hour}
                </div>
                {people.map((person, index) => {
                  const tasksForPersonAndHour = notes.filter(
                    (note) =>
                      note.assigned_person === person &&
                      isTaskActiveDuringHour(
                        note.start_time,
                        note.end_time,
                        hour
                      )
                  );

                  const isAdjacent =
                    index < people.length - 1 &&
                    tasksForPersonAndHour.length > 0 &&
                    tasksForPersonAndHour[0]?.status ===
                      notes.find(
                        (nextNote) =>
                          nextNote.assigned_person === people[index + 1] &&
                          isTaskActiveDuringHour(
                            nextNote.start_time,
                            nextNote.end_time,
                            hour
                          )
                      )?.status;

                  const status = tasksForPersonAndHour[0]?.status;
                  const baseClass = `cursor-pointer border-r border-gray-200 transition-colors duration-200 ${
                    isAdjacent ? "" : "p-2"
                  } ${
                    status === "pending"
                      ? "bg-[#FDE2E4] hover:bg-[#FAC8CB]"
                      : status === "active"
                      ? "bg-[#FFF3CD] hover:bg-[#FFE69B]"
                      : status === "done"
                      ? "bg-[#D4EDDA] hover:bg-[#A8D5BA]"
                      : "bg-transparent"
                  }`;

                  return (
                    <div
                      key={`${person}-${hour}`}
                      className={baseClass}
                      onClick={() =>
                        tasksForPersonAndHour.length > 0
                          ? handleTaskClick(tasksForPersonAndHour[0])
                          : handleNewTaskClick(hour, person)
                      }
                      style={{ minHeight: "4rem" }}
                    >
                      {tasksForPersonAndHour.map(
                        (task, taskIndex) =>
                          getFirstHourIndex(task.start_time, hours) ===
                            hourIndex && (
                            <div
                              key={taskIndex}
                              className="text-xs text-gray-800 space-y-1"
                            >
                              <p>{task.name}</p>
                              <p>{task.phone}</p>
                              <p>{task.description}</p>
                              <p>{task.vehicle}</p>
                            </div>
                          )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveNote}
          task={currentTask}
          setTask={setCurrentTask}
          isNewTask={isNewTask}
          onDelete={handleDeleteNote}
        />
      )}

      {errorMessage && (
        <div className="text-red-500 text-center mt-4">{errorMessage}</div>
      )}
    </div>
  );
};

export default Agenda;
