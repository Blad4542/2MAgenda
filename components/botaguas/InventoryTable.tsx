"use client";

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
}

interface InventoryTableProps {
  data: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}

export default function InventoryTable({ data, onEdit, onDelete }: InventoryTableProps) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full bg-white rounded-lg shadow-lg table-fixed">
        <thead className="bg-blue-500">
          <tr>
            {["Cantidad", "Molde", "Marca", "Modelo", "Año", "Puertas", "Tipo", "Descripción", "Acciones"].map(
              (header) => (
                <th
                  key={header}
                  className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-100 transition-colors">
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.mold_number}</td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.brand}</td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.model}</td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {item.year_end ? `${item.year_start} - ${item.year_end}` : `${item.year_start}`}
              </td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.doors}</td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.type}</td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.description}</td>
              <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex space-x-2">
                  <button onClick={() => onEdit(item)} className="text-blue-500 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => onDelete(item)} className="text-red-500 hover:underline">
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
