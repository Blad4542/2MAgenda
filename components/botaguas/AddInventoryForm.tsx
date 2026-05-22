"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface InventoryItem {
  id?: number;
  brand: string;
  model: string;
  year_start: number;
  year_end: number | null;
  doors: number;
  type: string;
  quantity: number;
  description: string;
  mold_number: string;
}

interface AddInventoryFormProps {
  onSubmit: (item: InventoryItem) => void;
  onClose: () => void;
  item?: InventoryItem;
}

const inp = "w-full border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors";
const lbl = "block text-sm font-medium text-gray-700 mb-1.5";

export default function AddInventoryForm({ onSubmit, onClose, item }: AddInventoryFormProps) {
  const [formData, setFormData] = useState<InventoryItem>({
    brand: "", model: "", year_start: 0, year_end: null, doors: 4, type: "", quantity: 0, description: "", mold_number: "",
  });

  useEffect(() => { if (item) setFormData(item); }, [item]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === "year_end" && value === "" ? null : value }));
  };

  const handleSubmit = () => {
    if (!formData.brand || !formData.model || !formData.year_start || !formData.doors || !formData.quantity || !formData.mold_number) {
      alert("Todos los campos (excepto Año Fin y Descripción) son obligatorios");
      return;
    }
    onSubmit(formData);
    setFormData({ brand: "", model: "", year_start: 0, year_end: null, doors: 4, type: "", quantity: 0, description: "", mold_number: "" });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-900">{item ? "Actualizar Item" : "Agregar Nuevo Item"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Marca</label><input name="brand" placeholder="Marca" value={formData.brand} onChange={handleInputChange} className={inp} /></div>
          <div><label className={lbl}>Modelo</label><input name="model" placeholder="Modelo" value={formData.model} onChange={handleInputChange} className={inp} /></div>
          <div><label className={lbl}>Desde (año)</label><input type="number" name="year_start" placeholder="Año inicio" value={formData.year_start} onChange={handleInputChange} className={inp} /></div>
          <div><label className={lbl}>Hasta (año, opcional)</label><input type="number" name="year_end" placeholder="Año fin" value={formData.year_end ?? ""} onChange={handleInputChange} className={inp} /></div>
          <div><label className={lbl}>Puertas</label><input type="number" name="doors" placeholder="Puertas" value={formData.doors} onChange={handleInputChange} className={inp} /></div>
          <div>
            <label className={lbl}>Tipo</label>
            <select name="type" value={formData.type} onChange={handleInputChange} className={inp}>
              <option value="">Seleccionar tipo</option>
              <option value="Parche">Parche</option>
              <option value="Empotrar">Empotrar</option>
            </select>
          </div>
          <div><label className={lbl}>Disponibles</label><input type="number" name="quantity" placeholder="Cantidad" value={formData.quantity} onChange={handleInputChange} className={inp} /></div>
          <div><label className={lbl}>Número de Molde</label><input name="mold_number" placeholder="Número de Molde" value={formData.mold_number} onChange={handleInputChange} className={inp} /></div>
          <div className="sm:col-span-2">
            <label className={lbl}>Descripción</label>
            <textarea name="description" placeholder="Descripción" value={formData.description} onChange={handleInputChange} className={`${inp} resize-none`} rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors">{item ? "Actualizar" : "Agregar"}</button>
        </div>
      </div>
    </div>
  );
}
