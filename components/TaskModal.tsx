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
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-10 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
        <div className="relative bg-white rounded max-w-sm mx-auto p-6">
          <Dialog.Title className="text-lg font-bold">
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
            placeholder="Telefono"
            className="border p-2 mb-2 w-full"
            value={task.phone}
            onChange={handleChange}
          />
          <textarea
            name="description"
            className="textarea"
            placeholder="Descripcion"
            value={task.description}
            onChange={handleChange}
          ></textarea>
          <input
            type="text"
            name="vehicle"
            placeholder="Vehiculo"
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
            className="border p-2 mb-2 w-full"
            value={task.status}
            onChange={handleChange}
          >
            <option value="pending">Pendiente</option>
            <option value="active">Activo</option>
            <option value="done">Hecho</option>
          </select>
          <div className="flex justify-end mt-4">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
              onClick={onSave}
            >
              Guardar
            </button>
            {!isNewTask && (
              <button
                className="bg-red-500 text-white px-4 py-2 rounded mr-2"
                onClick={() => onDelete(task.id)}
              >
                Eliminar
              </button>
            )}
            <button
              className="bg-gray-500 text-white px-4 py-2 rounded"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default TaskModal;
