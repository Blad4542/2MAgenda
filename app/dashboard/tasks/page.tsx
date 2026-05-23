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

const inp = "w-full border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors";
const lbl = "block text-sm font-medium text-gray-700 mb-1.5";

const statusStyle: Record<Task["status"], string> = {
  Pending: "bg-amber-50 text-amber-700 border border-amber-200",
  Quoting: "bg-blue-50 text-blue-700 border border-blue-200",
  Quoted:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
const statusLabel: Record<Task["status"], string> = {
  Pending: "Pendiente",
  Quoting: "Cotizando",
  Quoted:  "Cotizado",
};

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<Omit<Task, "id">>({ name: "", phone: "", description: "", status: "Pending" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    const { data } = await supabase.from("pending_tasks").select("*");
    if (data) setTasks(data as Task[]);
    setIsLoading(false);
  };
  useEffect(() => { fetchTasks(); }, []);

  const save = async () => {
    if (editing) await supabase.from("pending_tasks").update(form).eq("id", editing.id);
    else         await supabase.from("pending_tasks").insert({ id: uuidv4(), ...form });
    setIsOpen(false); setForm({ name: "", phone: "", description: "", status: "Pending" }); setEditing(null); fetchTasks();
  };
  const del = async (id: string) => {
    await supabase.from("pending_tasks").delete().eq("id", id);
    setSelected(p => { const n = new Set(p); n.delete(id); return n; }); fetchTasks();
  };
  const bulkDel = async (ids: string[]) => {
    await supabase.from("pending_tasks").delete().in("id", ids);
    setSelected(p => { const n = new Set(p); ids.forEach(id => n.delete(id)); return n; }); fetchTasks();
  };
  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (list: Task[], all: boolean) => setSelected(p => {
    const n = new Set(p); all ? list.forEach(t => n.delete(t.id)) : list.forEach(t => n.add(t.id)); return n;
  });

  const Table = ({ list, title }: { list: Task[]; title: string }) => {
    const sel = list.map(t => t.id).filter(id => selected.has(id));
    const all = list.length > 0 && sel.length === list.length;
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{list.length}</span>
          </div>
          {sel.length > 0 && (
            <button onClick={() => bulkDel(sel)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
              <Trash2 size={13} /> Eliminar seleccionados ({sel.length})
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400 text-sm">
            No hay tareas en esta sección
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 p-3 text-left">
                    <input type="checkbox" checked={all} onChange={() => toggleAll(list, all)} className="cursor-pointer accent-[#07C3F8] w-4 h-4" />
                  </th>
                  {["Nombre", "Teléfono", "Descripción", "Estado", ""].map(h => (
                    <th key={h} className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map(task => (
                  <tr key={task.id} className={`transition-colors ${selected.has(task.id) ? "bg-[#07C3F8]/5" : "hover:bg-gray-50"}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggle(task.id)} className="cursor-pointer accent-[#07C3F8] w-4 h-4" />
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-900">{task.name}</td>
                    <td className="p-3 text-sm text-gray-500">{task.phone}</td>
                    <td className="p-3 text-sm text-gray-500 max-w-xs truncate">{task.description}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle[task.status]}`}>
                        {statusLabel[task.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditing(task); setForm({ name: task.name, phone: task.phone, description: task.description, status: task.status }); setIsOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => del(task.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      <div className="flex justify-between items-center mb-8">
        <div><div className="h-7 w-52 bg-gray-200 rounded-lg mb-2" /><div className="h-4 w-48 bg-gray-100 rounded-lg" /></div>
        <div className="h-10 w-36 bg-gray-200 rounded-xl" />
      </div>
      {[4, 2].map((rows, t) => (
        <div key={t} className="mb-8">
          <div className="flex items-center gap-2 mb-3"><div className="h-5 w-40 bg-gray-200 rounded" /><div className="h-5 w-6 bg-gray-100 rounded-full" /></div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {[...Array(6)].map((_, i) => <th key={i} className="p-3"><div className="h-3 w-16 bg-gray-200 rounded" /></th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[...Array(rows)].map((_, i) => (
                  <tr key={i}>
                    <td className="p-3"><div className="w-4 h-4 bg-gray-100 rounded" /></td>
                    <td className="p-3"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                    <td className="p-3"><div className="h-4 w-24 bg-gray-100 rounded" /></td>
                    <td className="p-3"><div className="h-4 w-48 bg-gray-100 rounded" /></td>
                    <td className="p-3"><div className="h-6 w-20 bg-gray-100 rounded-full" /></td>
                    <td className="p-3"><div className="h-4 w-12 bg-gray-100 rounded" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones pendientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona las cotizaciones y su estado</p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ name: "", phone: "", description: "", status: "Pending" }); setIsOpen(true); }}
          className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus size={16} /> Nueva tarea
        </button>
      </div>

      <Table list={tasks.filter(t => t.status !== "Quoted")} title="Pendientes / Cotizando" />
      <Table list={tasks.filter(t => t.status === "Quoted")}  title="Cotizadas" />

      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? "Editar tarea" : "Nueva tarea"}>
          <div className="space-y-4">
            <div><label className={lbl}>Nombre</label><input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className={lbl}>Teléfono</label><input className={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className={lbl}>Descripción</label><input className={inp} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Task["status"] })}>
                <option value="Pending">Pendiente</option>
                <option value="Quoting">Cotizando</option>
                <option value="Quoted">Cotizado</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {editing && (
                <button onClick={() => { del(editing.id); setIsOpen(false); }} className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                  Eliminar
                </button>
              )}
              <button onClick={save} className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
