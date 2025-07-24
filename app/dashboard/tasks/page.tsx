"use client";
import { useEffect, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import { createClient } from "@/utils/supabase/client";
import { v4 as uuidv4 } from "uuid";

interface Task {
  id: string;
  name: string;
  phone: string;
  description: string;
  status: "Pending" | "Quoting" | "Quoted";
}

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<Omit<Task, "id">>({
    name: "",
    phone: "",
    description: "",
    status: "Pending",
  });

  const fetchTasks = async () => {
    const { data } = await supabase.from("pending_tasks").select("*");
    if (data) setTasks(data as Task[]);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async () => {
    if (editingTask) {
      await supabase
        .from("pending_tasks")
        .update(form)
        .eq("id", editingTask.id);
    } else {
      await supabase.from("pending_tasks").insert({
        id: uuidv4(),
        ...form,
      });
    }

    setIsOpen(false);
    setForm({ name: "", phone: "", description: "", status: "Pending" });
    setEditingTask(null);
    fetchTasks();
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      name: task.name,
      phone: task.phone,
      description: task.description,
      status: task.status,
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("pending_tasks").delete().eq("id", id);
    fetchTasks();
  };

  const statusColors: Record<Task["status"], string> = {
    Pending: "bg-yellow-200 text-yellow-800",
    Quoting: "bg-blue-200 text-blue-800",
    Quoted: "bg-green-200 text-green-800",
  };

  const statusLabels: Record<Task["status"], string> = {
    Pending: "Pendiente",
    Quoting: "Cotizando",
    Quoted: "Cotizado",
  };

  const renderTable = (tasksToRender: Task[], title: string) => (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <table className="min-w-full bg-white border border-gray-200 rounded shadow">
        <thead className="bg-[#DAF7FF] text-left">
          <tr>
            <th className="p-3 border-b">Nombre</th>
            <th className="p-3 border-b">Teléfono</th>
            <th className="p-3 border-b">Descripción</th>
            <th className="p-3 border-b">Estado</th>
            <th className="p-3 border-b">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tasksToRender.map((task) => (
            <tr key={task.id} className="hover:bg-gray-50">
              <td className="p-3 border-b">{task.name}</td>
              <td className="p-3 border-b">{task.phone}</td>
              <td className="p-3 border-b">{task.description}</td>
              <td className="p-3 border-b">
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    statusColors[task.status]
                  }`}
                >
                  {statusLabels[task.status]}
                </span>
              </td>
              <td className="p-3 border-b flex gap-2">
                <button
                  onClick={() => handleEdit(task)}
                  className="text-blue-600 hover:underline"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-red-600 hover:underline"
                >
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tareas</h1>
        <button
          className="bg-[#07C3F8] hover:bg-[#06aad9] text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={() => {
            setEditingTask(null);
            setForm({
              name: "",
              phone: "",
              description: "",
              status: "Pending",
            });
            setIsOpen(true);
          }}
        >
          <Plus size={18} />
          Nueva tarea
        </button>
      </div>

      {/* Tabla: Pendiente y Cotizando */}
      {renderTable(
        tasks.filter((t) => t.status !== "Quoted"),
        "Tareas Pendientes / Cotizando"
      )}

      {/* Tabla: Cotizado */}
      {renderTable(
        tasks.filter((t) => t.status === "Quoted"),
        "Tareas Cotizadas"
      )}

      {/* MODAL */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={editingTask ? "Editar tarea" : "Nueva tarea"}
        >
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-1">Nombre</label>
              <input
                className="w-full border border-gray-300 rounded p-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Teléfono</label>
              <input
                className="w-full border border-gray-300 rounded p-2"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Descripción</label>
              <input
                className="w-full border border-gray-300 rounded p-2"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Estado</label>
              <select
                className="w-full border border-gray-300 rounded p-2"
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as Task["status"],
                  })
                }
              >
                <option value="Pending">Pendiente</option>
                <option value="Quoting">Cotizando</option>
                <option value="Quoted">Cotizado</option>
              </select>
            </div>
            <div className="flex justify-end pt-4 gap-2">
              {editingTask && (
                <button
                  className="bg-red-500 text-white px-4 py-2 rounded"
                  onClick={() => {
                    handleDelete(editingTask.id);
                    setIsOpen(false);
                  }}
                >
                  Eliminar
                </button>
              )}
              <button
                className="bg-[#07C3F8] hover:bg-[#06aad9] text-white px-4 py-2 rounded"
                onClick={handleSubmit}
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
