"use client";
import { Edit, Trash2 } from "lucide-react";

interface InventoryItem {
  id: number;
  brand: string;
  model: string;
  year_start: number;
  year_end: number | null;
  doors: number;
  type: string;
  quantity: number;
  description: string;
  mold_number: string;
  user_name: string;
}

interface InventoryTableProps {
  data: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (allSelected: boolean) => void;
}

export default function InventoryTable({ data, onEdit, onDelete, selected, onToggle, onToggleAll }: InventoryTableProps) {
  const allSelected = data.length > 0 && data.every(item => selected.has(item.id));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={() => onToggleAll(allSelected)} className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]" />
              </th>
              {["Marca", "Modelo", "Desde", "Hasta", "Puertas", "Tipo", "Disp.", "Descripción", "Molde", "Usuario", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400 text-sm">No hay items en el inventario</td></tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className={`transition-colors ${selected.has(item.id) ? "bg-[#07C3F8]/5" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]" />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{item.brand}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{item.model}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.year_start}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.year_end ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-center">{item.doors}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.type}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#07C3F8] text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[180px] truncate">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{item.mold_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{item.user_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors"><Edit size={14} /></button>
                      <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
