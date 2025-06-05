"use client";
import { Dialog } from "@headlessui/react";

const TaskModal = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
  setTask,
  isNewTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: number | string) => void;
  task: any;
  setTask: (task: any) => void;
  isNewTask: boolean;
}) => {
  const handleChange = (e: { target: { name: any; value: any } }) => {
    const { name, value } = e.target;
    setTask({ ...task, [name]: value });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[100]">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Centered modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <Dialog.Panel className="bg-white rounded max-w-sm w-full mx-4 p-6 shadow-xl z-[101]">
          <Dialog.Title className="text-lg font-bold mb-4">
            {isNewTask ? "Agregar Tarea" : "Editar Tarea"}
          </Dialog.Title>

          <input
            type="text"
            name="name"
            placeholder="Nombre"
            className="border p-2 mb-2 w-full"
            value={task.name}
            onChange={handleChange}
          />
          <input
            type="text"
            name="phone"
            placeholder="Teléfono"
            className="border p-2 mb-2 w-full"
            value={task.phone}
            onChange={handleChange}
          />
          <textarea
            name="description"
            className="border p-2 mb-2 w-full"
            placeholder="Descripción"
            value={task.description}
            onChange={handleChange}
          />
          <input
            type="text"
            name="vehicle"
            placeholder="Vehículo"
            className="border p-2 mb-2 w-full"
            value={task.vehicle}
            onChange={handleChange}
          />
          <input
            type="time"
            name="start_time"
            placeholder="Hora de inicio"
            className="border p-2 mb-2 w-full"
            value={task.start_time}
            onChange={handleChange}
          />
          <input
            type="time"
            name="end_time"
            placeholder="Hora de fin"
            className="border p-2 mb-2 w-full"
            value={task.end_time}
            onChange={handleChange}
          />
          <select
            name="status"
            className="border p-2 mb-4 w-full"
            value={task.status}
            onChange={handleChange}
          >
            <option value="pending">Pendiente</option>
            <option value="active">Activo</option>
            <option value="done">Hecho</option>
          </select>

          <div className="flex justify-end gap-2">
            {!isNewTask && (
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => onDelete(task.id)}
              >
                Eliminar
              </button>
            )}
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded"
              onClick={onSave}
            >
              Guardar
            </button>
            <button
              className="bg-gray-500 text-white px-4 py-2 rounded"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default TaskModal;
