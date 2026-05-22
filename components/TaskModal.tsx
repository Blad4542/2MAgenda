"use client";
import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";

const inp = "w-full border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors";

const TaskModal = ({
  isOpen, onClose, onSave, onDelete, task, setTask, isNewTask, errorMessage,
}: {
  isOpen: boolean; onClose: () => void; onSave: () => void;
  onDelete: (id: number | string) => void; task: any; setTask: (t: any) => void;
  isNewTask: boolean; errorMessage?: string;
}) => {
  const onChange = (e: any) => setTask({ ...task, [e.target.name]: e.target.value });

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[100]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {isNewTask ? "Nueva cita" : "Editar cita"}
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <input type="text"  name="name"        placeholder="Nombre"      className={inp} value={task.name}        onChange={onChange} />
            <input type="text"  name="phone"       placeholder="Teléfono"    className={inp} value={task.phone}       onChange={onChange} />
            <textarea           name="description" placeholder="Descripción" className={inp} value={task.description} onChange={onChange} />
            <input type="text"  name="vehicle"     placeholder="Vehículo"    className={inp} value={task.vehicle}     onChange={onChange} />
            <div className="grid grid-cols-2 gap-2">
              <input type="time" name="start_time" className={inp} value={task.start_time} onChange={onChange} />
              <input type="time" name="end_time"   className={inp} value={task.end_time}   onChange={onChange} />
            </div>
            <select name="status" className={inp} value={task.status} onChange={onChange}>
              <option value="pending">Pendiente</option>
              <option value="active">Activo</option>
              <option value="done">Hecho</option>
            </select>

            {errorMessage && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
            {!isNewTask && (
              <button onClick={() => onDelete(task.id)} className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
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
