"use client";
import { useState, useEffect } from "react";

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

export default function AddInventoryForm({
  onSubmit,
  onClose,
  item,
}: AddInventoryFormProps) {
  const [formData, setFormData] = useState<InventoryItem>({
    brand: "",
    model: "",
    year_start: 0,
    year_end: null,
    doors: 4,
    type: "",
    quantity: 0,
    description: "",
    mold_number: "",
  });

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "year_end" && value === "" ? null : value,
    }));
  };

  const handleSubmit = () => {
    if (
      !formData.brand ||
      !formData.model ||
      !formData.year_start ||
      !formData.doors ||
      !formData.quantity ||
      !formData.mold_number
    ) {
      alert(
        "Todos los campos (excepto Año Fin y Descripción) son obligatorios"
      );
      return;
    }
    onSubmit(formData);
    setFormData({
      brand: "",
      model: "",
      year_start: 0,
      year_end: null,
      doors: 4,
      type: "",
      quantity: 0,
      description: "",
      mold_number: "",
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10 p-4 sm:p-8">
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-lg shadow-lg w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-screen overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-semibold text-center text-blue-600 mb-4">
          {item ? "Actualizar Item" : "Agregar Nuevo Item"}
        </h2>
        <form className="space-y-4">
          <label className="block text-gray-700">Marca</label>
          <input
            name="brand"
            placeholder="Marca"
            value={formData.brand}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block text-gray-700">Modelo</label>
          <input
            name="model"
            placeholder="Modelo"
            value={formData.model}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block text-gray-700">Desde</label>
          <input
            type="number"
            name="year_start"
            placeholder="Año Inicio"
            value={formData.year_start}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block text-gray-700">Hasta (opcional)</label>
          <input
            type="number"
            name="year_end"
            placeholder="Año Fin"
            value={formData.year_end ?? ""}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block text-gray-700">Puertas</label>
          <input
            type="number"
            name="doors"
            placeholder="Puertas"
            value={formData.doors}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block text-gray-700">Tipo</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Tipo</option>
            <option value="Parche">Parche</option>
            <option value="Empotrar">Empotrar</option>
          </select>

          <label className="block text-gray-700">Disponibles</label>
          <input
            type="number"
            name="quantity"
            placeholder="Cantidad"
            value={formData.quantity}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block text-gray-700">Descripción</label>
          <textarea
            name="description"
            placeholder="Descripción"
            value={formData.description}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block text-gray-700">Número de Molde</label>
          <input
            name="mold_number"
            placeholder="Número de Molde"
            value={formData.mold_number}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </form>
        <div className="flex flex-col sm:flex-row justify-end mt-4 space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            {item ? "Actualizar" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}
