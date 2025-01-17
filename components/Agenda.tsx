"use client";

import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskModal from "./TaskModal";
import {
  addNoteToSupabase,
  deleteNoteFromSupabase,
  updateNoteInSupabase,
} from "../utils/index";
import { createClient } from "@/utils/supabase/client";

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
  const [userEmail, setUserEmail] = useState(null);

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

  const getBgColorBasedOnStatus = (status: any) => {
    switch (status) {
      case "pending":
        return "bg-red-500"; // Rojo para pendiente
      case "active":
        return "bg-yellow-500"; // Amarillo para activo
      case "done":
        return "bg-green-500"; // Verde para hecho
      default:
        return "transparent"; // Transparente por defecto si no hay estado
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
      <div className="flex items-center justify-between p-4 bg-white shadow-md">
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date || new Date())}
          inline
        />
        <h1 className="text-4xl font-bold text-center">
          Agenda - {currentDate}
        </h1>
      </div>
      <div className="flex-grow overflow-auto">
        <div className="min-w-max bg-white shadow overflow-hidden rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-gray-200 text-lg font-bold">
            <div className="p-4 text-center border-b border-r border-gray-300">
              Hora
            </div>
            {people.map((person) => (
              <div
                key={person}
                className="p-4 text-center border-b border-gray-300"
              >
                {person}
              </div>
            ))}
          </div>
          {hours.map((hour, hourIndex) => (
            <div
              className={`grid grid-cols-1 md:grid-cols-6 gap-4 p-4 ${
                hourIndex % 2 ? "bg-gray-50" : "bg-white"
              }`}
              key={hour}
            >
              <div className="p-4 text-center border-r border-gray-300">
                {hour}
              </div>
              {people.map((person) => {
                const tasksForPersonAndHour = notes.filter(
                  (note) =>
                    note.assigned_person === person &&
                    isTaskActiveDuringHour(note.start_time, note.end_time, hour)
                );
                return (
                  <div
                    key={`${person}-${hour}`}
                    className={`p-4 border-r border-gray-300 cursor-pointer ${
                      tasksForPersonAndHour.length > 0
                        ? getBgColorBasedOnStatus(
                            tasksForPersonAndHour[0].status
                          )
                        : "bg-transparent"
                    }`}
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
                          <div key={taskIndex} className="text-sm">
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
