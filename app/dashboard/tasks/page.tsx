"use client";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Search, X, Download, ListChecks } from "lucide-react";
import Modal from "@/components/Modal";
import { createClient } from "@/utils/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { exportCsv } from "@/utils/exportCsv";
import { logAction } from "@/utils/auditLog";
import { waUrl, WaIcon } from "@/utils/wa";
import { useRequireRole } from "@/hooks/useRequireRole";
import { inp, lbl } from "@/utils/styles";
import { lookupCustomer, getCustomerVehicles, findOrCreateCustomer, findOrCreateVehicle, buildVehicleDescription, vehicleLabel, type VehicleRecord } from "@/utils/customers";

interface Task {
  id: string;
  name: string;
  phone: string;
  description: string;
  status: "Pending" | "Quoting" | "Quoted" | "Waiting";
  vehicle?: string;
  customer_id?: string;
  vehicle_id?: string;
  notes?: string;
  image_url?: string;
}

interface QuoteItem {
  id: string;
  task_id: string;
  description: string;
}

const PAGE_SIZE = 50;

const statusStyle: Record<Task["status"], string> = {
  Pending: "bg-amber-50 text-amber-700 border border-amber-200",
  Quoting: "bg-blue-50 text-blue-700 border border-blue-200",
  Quoted:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Waiting: "bg-purple-50 text-purple-700 border border-purple-200",
};
const statusLabel: Record<Task["status"], string> = {
  Pending: "Pendiente",
  Quoting: "Cotizando",
  Quoted:  "Cotizado",
  Waiting: "Lista de espera",
};

interface TableProps {
  list: Task[];
  title: string;
  selected: Set<string>;
  itemCounts: Record<string, number>;
  taskDescriptions: Record<string, string[]>;
  onToggle: (id: string) => void;
  onToggleAll: (list: Task[], all: boolean) => void;
  onBulkDelete: (ids: string[]) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onRowClick: (task: Task) => void;
  isDropTarget?: boolean;
  onRowDragStart?: (task: Task) => void;
  onDrop?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
}

const Table = memo(function Table({ list, title, selected, itemCounts, taskDescriptions, onToggle, onToggleAll, onBulkDelete, onEdit, onDelete, onRowClick, isDropTarget, onRowDragStart, onDrop, onDragOver, onDragLeave }: TableProps) {
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
          <button onClick={() => onBulkDelete(sel)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
            <Trash2 size={13} aria-hidden="true" /> Eliminar seleccionados ({sel.length})
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          className={`border-2 border-dashed rounded-2xl p-10 text-center text-sm transition-colors ${isDropTarget ? "border-[#07C3F8] bg-[#07C3F8]/5 text-[#07C3F8]" : "border-gray-200 bg-white text-gray-400"}`}
        >
          {isDropTarget ? "Suelta aquí" : "No hay tareas en esta sección"}
        </div>
      ) : (
        <div
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          className={`bg-white rounded-2xl shadow-sm border overflow-x-auto transition-colors ${isDropTarget ? "border-[#07C3F8] ring-2 ring-[#07C3F8]/30" : "border-gray-200"}`}
        >
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{width: "40px"}} />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[20%]" />
              <col className="w-[16%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col style={{width: "80px"}} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 p-3 text-left">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={() => onToggleAll(list, all)}
                    aria-label="Seleccionar todos"
                    className="cursor-pointer accent-[#07C3F8] w-4 h-4"
                  />
                </th>
                {["Nombre", "Teléfono", "Vehículo", "Descripción", "Tareas", "Notas", "Estado", ""].map(h => (
                  <th key={h} className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(task => (
                <tr
                  key={task.id}
                  draggable
                  onDragStart={() => onRowDragStart?.(task)}
                  onClick={() => onRowClick(task)}
                  className={`transition-colors cursor-pointer cursor-grab active:cursor-grabbing ${selected.has(task.id) ? "bg-[#07C3F8]/5" : "hover:bg-gray-50"}`}
                >
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(task.id)}
                      onChange={() => onToggle(task.id)}
                      aria-label={`Seleccionar ${task.name}`}
                      className="cursor-pointer accent-[#07C3F8] w-4 h-4"
                    />
                  </td>
                  <td className="p-3 text-sm font-medium text-gray-900 truncate">{task.name}</td>
                  <td className="p-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{task.phone}</span>
                      {task.phone && (
                        <a href={waUrl(task.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${task.name}`} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <WaIcon />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-gray-500 truncate">{task.vehicle || "—"}</td>
                  <td className="p-3 text-sm text-gray-500"><div className="line-clamp-3">{task.description || "—"}</div></td>
                  <td className="p-3">
                    {(taskDescriptions[task.id] ?? []).length === 0 ? (
                      <span className="text-gray-300 text-xs">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {(taskDescriptions[task.id] ?? []).slice(0, 3).map((d, i) => (
                          <div key={i} className="flex items-start gap-1 text-xs text-gray-600">
                            <span className="text-gray-400 shrink-0">•</span>
                            <span className="truncate">{d}</span>
                          </div>
                        ))}
                        {(taskDescriptions[task.id] ?? []).length > 3 && (
                          <span className="text-xs text-[#07C3F8]">+{(taskDescriptions[task.id] ?? []).length - 3} más</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-500"><div className="line-clamp-3">{task.notes || "—"}</div></td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusStyle[task.status]}`}>
                      {statusLabel[task.status]}
                    </span>
                  </td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => onEdit(task)}
                        aria-label={`Editar ${task.name}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors"
                      >
                        <Edit size={14} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => onDelete(task.id)}
                        aria-label={`Eliminar ${task.name}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} aria-hidden="true" />
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
});

export default function TasksPage() {
  useRequireRole(["admin", "asistente"]);
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<Omit<Task, "id">>({ name: "", phone: "", description: "", status: "Pending", vehicle: "", customer_id: undefined, vehicle_id: undefined, notes: "", image_url: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [customerVehicles, setCustomerVehicles] = useState<VehicleRecord[]>([]);
  const [isNewVehicle, setIsNewVehicle] = useState(true);
  const [vehicleFields, setVehicleFields] = useState({ make: "", model: "", year: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<"pending" | "quoted" | "waiting" | null>(null);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [taskDescriptions, setTaskDescriptions] = useState<Record<string, string[]>>({});
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailItems, setDetailItems] = useState<QuoteItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchTasks = useCallback(async (p = 0, s = "") => {
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("pending_tasks")
      .select("*", { count: "exact" })
      .range(from, to);
    if (s.trim()) q = q.or(`name.ilike.%${s.trim()}%,description.ilike.%${s.trim()}%`);
    const { data, count } = await q;
    if (data) {
      const customerIds = Array.from(new Set(data.filter(t => t.customer_id).map(t => t.customer_id as string)));
      let nameMap: Record<string, { name: string; phone: string }> = {};
      if (customerIds.length > 0) {
        const { data: custs } = await supabase.from("customers").select("id, name, phone").in("id", customerIds);
        if (custs) custs.forEach(c => { nameMap[c.id] = { name: c.name, phone: c.phone }; });
      }
      const mapped = data.map(t => {
        if (t.customer_id && nameMap[t.customer_id]) {
          const c = nameMap[t.customer_id];
          return { ...t, name: c.name || t.name, phone: c.phone || t.phone };
        }
        return t;
      }) as Task[];
      setTasks(mapped);

      const ids = mapped.map(t => t.id);
      if (ids.length > 0) {
        const { data: items } = await supabase.from("quote_items").select("task_id, description").in("task_id", ids);
        if (items) {
          const counts: Record<string, number> = {};
          const descs: Record<string, string[]> = {};
          for (const item of items) {
            counts[item.task_id] = (counts[item.task_id] ?? 0) + 1;
            if (!descs[item.task_id]) descs[item.task_id] = [];
            descs[item.task_id].push(item.description);
          }
          setItemCounts(counts);
          setTaskDescriptions(descs);
        }
      }
    }
    if (count !== null) setTotal(count);
    setIsLoading(false);
  }, [supabase]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
    setSelected(new Set());
    fetchTasks(0, value);
  };

  useEffect(() => {
    fetchTasks(0);
    supabase.auth.getSession().then(({ data }) => { if (data.session) setUserEmail(data.session.user.email); });
  }, [fetchTasks, supabase]);

  const goToPage = (p: number) => {
    setPage(p);
    setSelected(new Set());
    fetchTasks(p, search);
  };

  const onPhoneBlur = async () => {
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 6) return;
    const match = await lookupCustomer(supabase, form.phone);
    if (!match) { setCustomerVehicles([]); setIsNewVehicle(true); return; }
    const vehicles = await getCustomerVehicles(supabase, match.id);
    setCustomerVehicles(vehicles);
    setIsNewVehicle(vehicles.length === 0);
    const firstV = vehicles[0];
    if (firstV) setVehicleFields({ make: firstV.make ?? "", model: firstV.model ?? "", year: firstV.year ? String(firstV.year) : "" });
    setForm(f => ({
      ...f,
      name: f.name || match.name,
      customer_id: match.id,
      vehicle_id: firstV?.id ?? undefined,
      vehicle: firstV ? vehicleLabel(firstV) : f.vehicle,
    }));
  };

  const onVehicleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") {
      setIsNewVehicle(true);
      setVehicleFields({ make: "", model: "", year: "" });
      setForm(f => ({ ...f, vehicle: "", vehicle_id: undefined }));
    } else {
      const found = customerVehicles.find(v => v.id === val);
      if (found) {
        setIsNewVehicle(false);
        setVehicleFields({ make: found.make ?? "", model: found.model ?? "", year: found.year ? String(found.year) : "" });
        setForm(f => ({ ...f, vehicle: vehicleLabel(found), vehicle_id: found.id }));
      }
    }
  };

  const resetForm = () => {
    setForm({ name: "", phone: "", description: "", status: "Pending", vehicle: "", customer_id: undefined, vehicle_id: undefined, notes: "", image_url: "" });
    setFormError("");
    setVehicleFields({ make: "", model: "", year: "" });
    setCustomerVehicles([]);
    setIsNewVehicle(true);
    setImageFile(null);
    setDetailItems([]);
    setDetailTask(null);
    setNewItemText("");
  };

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError("Nombre y teléfono son obligatorios.");
      return;
    }
    setFormError("");
    let customerId = form.customer_id;
    let vehicleId = form.vehicle_id;
    let imageUrl = form.image_url ?? "";
    try {
      if (form.phone.replace(/\D/g, "").length >= 6) {
        customerId = await findOrCreateCustomer(supabase, form.phone, form.name);
        const vDesc = buildVehicleDescription(vehicleFields.make, vehicleFields.model, vehicleFields.year) || form.vehicle || "";
        if (vDesc.trim()) vehicleId = await findOrCreateVehicle(supabase, customerId, { make: vehicleFields.make, model: vehicleFields.model, year: vehicleFields.year, description: vDesc });
      }
    } catch { /* non-fatal */ }

    if (imageFile) {
      try {
        const ext = imageFile.name.split(".").pop() ?? "jpg";
        const taskId = editing?.id ?? uuidv4();
        const path = `${taskId}_${Date.now()}.${ext}`;
        const { data: uploaded, error: upErr } = await supabase.storage.from("task-images").upload(path, imageFile, { upsert: true });
        if (!upErr && uploaded) {
          const { data: { publicUrl } } = supabase.storage.from("task-images").getPublicUrl(uploaded.path);
          imageUrl = publicUrl;
        }
      } catch { /* non-fatal */ }
    }

    if (editing) {
      await supabase.from("pending_tasks").update({ ...form, customer_id: customerId, vehicle_id: vehicleId, image_url: imageUrl }).eq("id", editing.id);
      await logAction(supabase, { table_name: "pending_tasks", record_id: editing.id, action: "update", description: `Cotización de ${form.name}`, user_email: userEmail });
    } else {
      const id = uuidv4();
      await supabase.from("pending_tasks").insert({ id, ...form, customer_id: customerId, vehicle_id: vehicleId, image_url: imageUrl });
      await logAction(supabase, { table_name: "pending_tasks", record_id: id, action: "create", description: `Cotización de ${form.name}`, user_email: userEmail });
    }
    setIsOpen(false); resetForm(); setEditing(null); fetchTasks(page, search);
  };

  const del = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    await supabase.from("pending_tasks").delete().eq("id", id);
    await logAction(supabase, { table_name: "pending_tasks", record_id: id, action: "delete", description: task ? `Cotización de ${task.name}` : undefined, user_email: userEmail });
    setSelected(p => { const n = new Set(p); n.delete(id); return n; }); fetchTasks(page, search);
  };
  const bulkDel = async (ids: string[]) => {
    await supabase.from("pending_tasks").delete().in("id", ids);
    await Promise.all(ids.map(id => {
      const t = tasks.find(x => x.id === id);
      return logAction(supabase, { table_name: "pending_tasks", record_id: id, action: "delete", description: t ? `Cotización de ${t.name}` : undefined, user_email: userEmail });
    }));
    setSelected(p => { const n = new Set(p); ids.forEach(id => n.delete(id)); return n; }); fetchTasks(page, search);
  };
  const handleDrop = async (target: "pending" | "quoted" | "waiting") => {
    setDropTarget(null);
    if (!draggingTask) return;
    const statusMap: Record<typeof target, Task["status"]> = { pending: "Pending", quoted: "Quoted", waiting: "Waiting" };
    const newStatus = statusMap[target];
    if (draggingTask.status === newStatus) { setDraggingTask(null); return; }
    setTasks(prev => prev.map(t => t.id === draggingTask.id ? { ...t, status: newStatus } : t));
    await supabase.from("pending_tasks").update({ status: newStatus }).eq("id", draggingTask.id);
    await logAction(supabase, { table_name: "pending_tasks", record_id: draggingTask.id, action: "update", description: `Cotización de ${draggingTask.name} → ${statusLabel[newStatus]}`, user_email: userEmail });
    setDraggingTask(null);
  };

  const openDetail = async (task: Task) => {
    setDetailTask(task);
    setNewItemText("");
    const { data } = await supabase.from("quote_items").select("id, task_id, description").eq("task_id", task.id).order("created_at", { ascending: true });
    setDetailItems((data ?? []) as QuoteItem[]);
    setIsDetailOpen(true);
  };

  const addItem = async () => {
    if (!newItemText.trim() || !detailTask) return;
    const id = uuidv4();
    const desc = newItemText.trim();
    const item: QuoteItem = { id, task_id: detailTask.id, description: desc };
    await supabase.from("quote_items").insert({ id, task_id: detailTask.id, description: desc });
    setDetailItems(prev => [...prev, item]);
    setItemCounts(prev => ({ ...prev, [detailTask.id]: (prev[detailTask.id] ?? 0) + 1 }));
    setTaskDescriptions(prev => ({ ...prev, [detailTask.id]: [...(prev[detailTask.id] ?? []), desc] }));
    setNewItemText("");
  };

  const removeItem = async (itemId: string) => {
    if (!detailTask) return;
    const removed = detailItems.find(i => i.id === itemId);
    await supabase.from("quote_items").delete().eq("id", itemId);
    setDetailItems(prev => prev.filter(i => i.id !== itemId));
    setItemCounts(prev => ({ ...prev, [detailTask.id]: Math.max(0, (prev[detailTask.id] ?? 1) - 1) }));
    if (removed) {
      setTaskDescriptions(prev => {
        const arr = [...(prev[detailTask.id] ?? [])];
        const idx = arr.indexOf(removed.description);
        if (idx > -1) arr.splice(idx, 1);
        return { ...prev, [detailTask.id]: arr };
      });
    }
  };

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (list: Task[], all: boolean) => setSelected(p => {
    const n = new Set(p); all ? list.forEach(t => n.delete(t.id)) : list.forEach(t => n.add(t.id)); return n;
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const makeEditHandler = () => async (task: Task) => {
    setEditing(task);
    setForm({ name: task.name, phone: task.phone, description: task.description, status: task.status, vehicle: task.vehicle ?? "", customer_id: task.customer_id, vehicle_id: task.vehicle_id, notes: task.notes ?? "", image_url: task.image_url ?? "" });
    setImageFile(null);
    // Parse vehicle description into structured fields (best-effort)
    const vDesc = task.vehicle ?? "";
    const parts = vDesc.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const isYear = /^\d{4}$/.test(last) && Number(last) >= 1900 && Number(last) <= 2100;
    if (isYear && parts.length >= 3) setVehicleFields({ make: parts[0], model: parts.slice(1, -1).join(" "), year: last });
    else if (parts.length >= 2) setVehicleFields({ make: parts[0], model: parts.slice(1).join(" "), year: "" });
    else setVehicleFields({ make: vDesc, model: "", year: "" });
    if (task.customer_id) {
      const vehicles = await getCustomerVehicles(supabase, task.customer_id);
      setCustomerVehicles(vehicles);
      setIsNewVehicle(!task.vehicle_id);
      if (task.vehicle_id) {
        const veh = vehicles.find(v => v.id === task.vehicle_id);
        if (veh?.make) setVehicleFields({ make: veh.make ?? "", model: veh.model ?? "", year: veh.year ? String(veh.year) : "" });
      }
      if (!task.name.trim() || !task.phone.trim()) {
        const { data: cust } = await supabase.from("customers").select("name, phone").eq("id", task.customer_id).single();
        if (cust) setForm(prev => ({ ...prev, name: cust.name || prev.name, phone: cust.phone || prev.phone }));
      }
    } else { setCustomerVehicles([]); setIsNewVehicle(true); }
    // Load quote items for edit modal
    setDetailTask(task);
    setNewItemText("");
    const { data: items } = await supabase.from("quote_items").select("id, task_id, description").eq("task_id", task.id).order("created_at", { ascending: true });
    setDetailItems((items ?? []) as QuoteItem[]);
    setFormError("");
    setIsOpen(true);
  };

  if (isLoading) return (
    <div className="p-6 animate-pulse">
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

  const editTask = makeEditHandler();
  const sharedTableProps = {
    selected, itemCounts, taskDescriptions, onToggle: toggle, onToggleAll: toggleAll, onBulkDelete: bulkDel,
    onRowClick: editTask, onRowDragStart: setDraggingTask,
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona las cotizaciones y su estado</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportCsv(tasks.map(t => ({ Nombre: t.name, Teléfono: t.phone, Vehículo: t.vehicle ?? "", Descripción: t.description, Notas: t.notes ?? "", Estado: t.status })), "cotizaciones.csv")}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Download size={16} aria-hidden="true" /> Exportar
          </button>
          <button
            onClick={() => { setEditing(null); resetForm(); setIsOpen(true); }}
            className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> Nueva cotización
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar por nombre o descripción..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
        />
        {search && (
          <button onClick={() => handleSearch("")} aria-label="Limpiar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      <Table
        {...sharedTableProps}
        list={tasks.filter(t => t.status !== "Quoted" && t.status !== "Waiting")}
        title="Pendientes / Cotizando"
        onEdit={editTask}
        onDelete={del}
        isDropTarget={dropTarget === "pending"}
        onDrop={() => handleDrop("pending")}
        onDragOver={e => { e.preventDefault(); setDropTarget("pending"); }}
        onDragLeave={() => setDropTarget(null)}
      />
      <Table
        {...sharedTableProps}
        list={tasks.filter(t => t.status === "Quoted")}
        title="Cotizadas"
        onEdit={editTask}
        onDelete={del}
        isDropTarget={dropTarget === "quoted"}
        onDrop={() => handleDrop("quoted")}
        onDragOver={e => { e.preventDefault(); setDropTarget("quoted"); }}
        onDragLeave={() => setDropTarget(null)}
      />
      <Table
        {...sharedTableProps}
        list={tasks.filter(t => t.status === "Waiting")}
        title="Lista de espera"
        onEdit={editTask}
        onDelete={del}
        isDropTarget={dropTarget === "waiting"}
        onDrop={() => handleDrop("waiting")}
        onDragOver={e => { e.preventDefault(); setDropTarget("waiting"); }}
        onDragLeave={() => setDropTarget(null)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-gray-500">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              aria-label="Página anterior"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="text-sm text-gray-700 font-medium">{page + 1} / {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages - 1}
              aria-label="Página siguiente"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => { setIsOpen(false); resetForm(); setEditing(null); }} title={editing ? "Editar cotización" : "Nueva cotización"}>
          <div className="space-y-4">
            <div>
              <label className={lbl}>Teléfono</label>
              <input className={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} onBlur={onPhoneBlur} />
            </div>
            <div><label className={lbl}>Nombre</label><input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label className={lbl}>Vehículo</label>
              {customerVehicles.length > 0 && (
                <select className={inp} value={isNewVehicle ? "__new__" : (form.vehicle_id ?? "")} onChange={onVehicleSelect}>
                  {customerVehicles.map(v => <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}
                  <option value="__new__">+ Nuevo vehículo</option>
                </select>
              )}
              {(customerVehicles.length === 0 || isNewVehicle) && (
                <div className={`grid grid-cols-3 gap-2 ${customerVehicles.length > 0 ? "mt-2" : ""}`}>
                  <input className={inp} placeholder="Marca" value={vehicleFields.make} onChange={e => { const u = { ...vehicleFields, make: e.target.value }; setVehicleFields(u); setForm(f => ({ ...f, vehicle: buildVehicleDescription(u.make, u.model, u.year) })); }} />
                  <input className={inp} placeholder="Modelo" value={vehicleFields.model} onChange={e => { const u = { ...vehicleFields, model: e.target.value }; setVehicleFields(u); setForm(f => ({ ...f, vehicle: buildVehicleDescription(u.make, u.model, u.year) })); }} />
                  <input className={inp} placeholder="Año" value={vehicleFields.year} onChange={e => { const u = { ...vehicleFields, year: e.target.value }; setVehicleFields(u); setForm(f => ({ ...f, vehicle: buildVehicleDescription(u.make, u.model, u.year) })); }} />
                </div>
              )}
            </div>
            <div><label className={lbl}>Descripción</label><input className={inp} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><label className={lbl}>Notas</label><textarea className={`${inp} resize-none`} rows={2} value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Task["status"] })}>
                <option value="Pending">Pendiente</option>
                <option value="Quoting">Cotizando</option>
                <option value="Quoted">Cotizado</option>
                <option value="Waiting">Lista de espera</option>
              </select>
            </div>

            {/* Imagen (opcional) */}
            <div>
              <label className={lbl}>Imagen <span className="text-gray-400 font-normal">(opcional)</span></label>
              {(form.image_url || imageFile) && (
                <div className="mb-2 relative inline-block">
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : form.image_url!}
                    alt="Vista previa"
                    className="h-32 w-auto rounded-xl border border-gray-200 object-cover"
                  />
                  <button
                    onClick={() => { setImageFile(null); setForm(f => ({ ...f, image_url: "" })); }}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-0.5 text-gray-400 hover:text-red-500 shadow-sm"
                    aria-label="Quitar imagen"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#07C3F8]/10 file:text-[#07C3F8] hover:file:bg-[#07C3F8]/20 cursor-pointer"
                onChange={e => { const f = e.target.files?.[0] ?? null; setImageFile(f); }}
              />
            </div>

            {/* Tareas */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Tareas</h3>
              {detailItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">Sin tareas aún</p>
              ) : (
                <ul className="space-y-1.5 mb-3">
                  {detailItems.map((item, idx) => (
                    <li key={item.id} className="flex items-center gap-2 group">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}.</span>
                      <span className="flex-1 text-sm text-gray-700">{item.description}</span>
                      <button onClick={() => removeItem(item.id)} aria-label="Eliminar tarea" className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-all">
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  className={`${inp} flex-1`}
                  placeholder="Nueva tarea..."
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                />
                <button onClick={addItem} disabled={!newItemText.trim()} className="px-3 py-2 rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                  <Plus size={15} />
                </button>
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
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
