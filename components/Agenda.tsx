"use client";
import React, { useEffect, useState } from "react";
import TaskModal from "./TaskModal";
import { addNoteToSupabase } from "../utils/index";
import { createClient } from "@/utils/supabase/client";

const Agenda = () => {
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

  const supabase = createClient();

  const fetchNotes = async () => {
    const { data, error } = await supabase.from("appointments").select("*");
    console.log("log de data", data);
    if (error) {
      console.error("Error al recuperar las notas:", error);
    } else {
      setNotes(data);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

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

  const handleCellClick = (hour: any, person: any) => {
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
  };

  const handleSaveNote = async () => {
    const { data, error } = await addNoteToSupabase(currentTask);
    if (error) {
      console.error("Error al guardar la nota:", error.message);
      setErrorMessage(`Error al guardar la nota: ${error.message}`);
    } else {
      setIsModalOpen(false); // Cierra el modal correctamente
      fetchNotes();
      setCurrentTask({
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
      setErrorMessage(""); // Limpia cualquier mensaje de error anterior

      // Opcional: Recargar las notas desde Supabase para reflejar la nueva nota
      // Considera llamar aquí a fetchNotes() si necesitas actualizar la lista de notas
    }
  };

  // Función para determinar si una nota debe mostrarse en un intervalo de hora específico
  const noteMatchesInterval = (noteCreatedAt: any, interval: any) => {
    // Convierte el timestamp de la nota a un objeto Date
    const noteDate = new Date(noteCreatedAt);
    // Formatea tanto la hora de la nota como el intervalo para comparación
    const noteHour = noteDate.getHours();
    const noteMinutes = noteDate.getMinutes();
    const [intervalHour, intervalMinutes] = interval.split(":").map(Number);

    // Determina si la nota cae dentro del intervalo de tiempo específico
    return (
      noteHour === intervalHour &&
      noteMinutes >= intervalMinutes &&
      noteMinutes < intervalMinutes + 30
    );
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

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-auto overflow-auto">
        <div className="flex flex-col bg-white shadow overflow-hidden rounded-lg w-full">
          <div className="grid grid-cols-5 text-sm font-medium text-gray-700">
            <div className="border-r border-b p-4 text-center bg-gray-100 sticky left-0">
              Hora
            </div>
            {people.map((person) => (
              <div key={person} className="p-4 border-b border-r text-center">
                {person}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 overflow-auto">
            {hours.map((hour, hourIndex) => (
              <React.Fragment key={hour}>
                <div
                  className={`p-4 border-r ${
                    hourIndex % 2 === 0 ? "bg-gray-50" : ""
                  } sticky left-0`}
                >
                  {hour}
                </div>
                {people.map((person, personIndex) => {
                  // Filtra las notas por persona y verifica si están activas durante esta hora.
                  const tasksForPersonAndHour = notes.filter(
                    (note) =>
                      note.assigned_person === person &&
                      isTaskActiveDuringHour(
                        note.start_time,
                        note.end_time,
                        hour
                      )
                  );

                  // Solo muestra detalles para la primera franja horaria de la tarea.
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
                      onClick={() => handleCellClick(hour, person)}
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
        />
      </div>
    </div>
  );
};

export default Agenda;
