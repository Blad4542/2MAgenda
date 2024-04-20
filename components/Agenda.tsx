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
    appointment_time: "",
    assigned_person: "",
    name: "",
    phone: "",
    description: "",
    vehicle: "",
    status: "pending", // Estado inicial
  });
  const [notes, setNotes] = useState<any[]>([]);
  const [isNewTask, setIsNewTask] = useState(true);

  const supabase = createClient();

  const currentDate = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchNotesForSelectedDate = async () => {
    const startOfDay = new Date(
      selectedDate.setHours(0, 0, 0, 0)
    ).toISOString();
    const endOfDay = new Date(
      selectedDate.setHours(23, 59, 59, 999)
    ).toISOString();

    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .gte("created_at", startOfDay)
      .lt("created_at", endOfDay)
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

  const people = ["Keilor", "Andrey", "Dylan", "Steven"];

  const handleCellClick = (hour: string, person: string): void => {
    const existingTask = notes.find(
      (note) =>
        note.appointment_time === hour && note.assigned_person === person
    );
    if (existingTask) {
      setCurrentTask(existingTask);
      setIsNewTask(false);
    } else {
      setCurrentTask({
        start_time: `${selectedDate.toISOString().split("T")[0]}T${hour}`,
        end_time: `${selectedDate.toISOString().split("T")[0]}T${hour}`,
        appointment_time: hour,
        assigned_person: person,
        name: "",
        phone: "",
        description: "",
        vehicle: "",
        status: "pending",
      });
      setIsNewTask(true);
    }
    setIsModalOpen(true);
  };

  const handleSaveNote = async () => {
    let result;
    if (isNewTask) {
      // Llama a la función para agregar una nueva tarea
      result = await addNoteToSupabase(currentTask);
    } else {
      // Llama a la función para actualizar una tarea existente usando su ID
      result = await updateNoteInSupabase(currentTask);
    }

    if (result.error) {
      console.error("Error al guardar la nota:", result.error.message);
      setErrorMessage(`Error al guardar la nota: ${result.error.message}`);
    } else {
      setIsModalOpen(false);
      fetchNotesForSelectedDate(); // Recarga las notas para reflejar los cambios
      setCurrentTask({
        // Limpia el formulario
        start_time: "",
        end_time: "",
        appointment_time: "",
        assigned_person: "",
        name: "",
        phone: "",
        description: "",
        vehicle: "",
        status: "pending",
      });
      setErrorMessage("");
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
      appointment_time: hour,
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
    <div className="h-screen flex flex-col">
      <div className=" flex">
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date || new Date())}
          inline
        />

        <div className="flex-1 w-full mt-20 text-4xl text-center">
          Agenda - {currentDate}
        </div>
      </div>
      <div className="flex flex-auto overflow-auto">
        <div className="flex flex-col bg-white shadow overflow-hidden rounded-lg w-full">
          <div className="grid grid-cols-5 text-sm font-medium text-gray-700">
            <div className="text-xl border-r border-b p-4 text-center bg-gray-100 sticky left-0">
              Hora
            </div>
            {people.map((person) => (
              <div
                key={person}
                className="p-4 border-b border-r text-center text-xl"
              >
                {person}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 overflow-auto">
            {hours.map((hour, hourIndex) => (
              <React.Fragment key={hour}>
                <div
                  className={`text-xl p-4 border-r${
                    hourIndex % 2 === 0 ? "bg-gray-50" : ""
                  } sticky left-0`}
                >
                  {hour}
                </div>
                {people.map((person, personIndex) => {
                  const tasksForPersonAndHour = notes.filter(
                    (note) =>
                      note.assigned_person === person &&
                      isTaskActiveDuringHour(
                        note.start_time,
                        note.end_time,
                        hour
                      )
                  );
                  return (
                    <div
                      key={`${person}-${hour}`}
                      className={`col-span-1 p-4 border-r cursor-pointer hover:bg-gray-200 ${
                        tasksForPersonAndHour.length > 0
                          ? getBgColorBasedOnStatus(
                              tasksForPersonAndHour[0].status
                            )
                          : "transparent"
                      }`}
                      onClick={() =>
                        tasksForPersonAndHour.length > 0
                          ? handleTaskClick(tasksForPersonAndHour[0])
                          : handleNewTaskClick(hour, person)
                      }
                    >
                      {tasksForPersonAndHour.map((task, taskIndex) => {
                        const firstHourIndex = getFirstHourIndex(
                          task.start_time,
                          hours
                        );
                        const showTaskDetails = firstHourIndex === hourIndex;
                        return showTaskDetails ? (
                          <div key={taskIndex}>
                            <p>{task.name}</p>
                            <p>{task.phone}</p>
                            <p>{task.description}</p>
                            <p>{task.vehicle}</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveNote}
          task={currentTask}
          setTask={setCurrentTask}
          isNewTask={isNewTask}
          onDelete={handleDeleteNote}
        />
      </div>
    </div>
  );
};

export default Agenda;
