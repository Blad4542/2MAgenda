"use client";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import AddInventoryForm from "@/components/botaguas/AddInventoryForm";
import InventoryTable from "@/components/botaguas/InventoryTable";
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Search, Download } from "lucide-react";
import { exportCsv } from "@/utils/exportCsv";

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

interface DecodedToken { email: string; }

const ITEMS_PER_PAGE = 25;

const sel = "border border-gray-300 text-gray-900 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors w-full sm:w-auto";

export default function InventoryPage() {
  const supabase = createClient();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [searchText, setSearchText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | undefined>();
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const extractFilters = (data: InventoryItem[]) => {
    setBrands(Array.from(new Set(data.map((item) => item.brand))));
    setModels(Array.from(new Set(data.map((item) => item.model))));
    setYears(
      Array.from(new Set(data.flatMap((item) => [item.year_start, item.year_end]).filter((y) => y !== null)))
        .sort((a, b) => (b as number) - (a as number)) as number[]
    );
  };

  const fetchInventory = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("botaguas").select("*");
      if (error) console.error("Error:", error.message);
      else if (data) { setInventory(data as InventoryItem[]); setFilteredInventory(data as InventoryItem[]); extractFilters(data as InventoryItem[]); }
    } catch (e) { console.error(e); }
  }, [supabase]);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) { const decoded = jwtDecode<DecodedToken>(data.session.access_token); setUser(decoded.email); }
      await fetchInventory();
      setLoading(false);
    };
    loadUser();
  }, [fetchInventory, supabase]);

  const filterData = (brand: string, model: string, year: number | "", text: string) => {
    let filtered = inventory;
    if (brand) filtered = filtered.filter((item) => item.brand === brand);
    if (model) filtered = filtered.filter((item) => item.model === model);
    if (year !== "") filtered = filtered.filter((item) => item.year_start <= year && (item.year_end === null || item.year_end >= year));
    if (text.trim()) {
      const q = text.toLowerCase();
      filtered = filtered.filter((item) =>
        item.mold_number.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    setFilteredInventory(filtered);
    setCurrentPage(1);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddOrUpdateItem: any = async (item: Omit<InventoryItem, "id"> | InventoryItem) => {
    let error;
    if ("id" in item && item.id) {
      const { error: e } = await supabase.from("botaguas").update({ ...item, user_name: user || null }).eq("id", item.id);
      error = e;
    } else {
      const { data: existing, error: fetchError } = await supabase.from("botaguas").select("mold_number").eq("mold_number", item.mold_number).single();
      if (fetchError && fetchError.code !== "PGRST116") { console.error(fetchError.message); return; }
      if (existing) { alert(`El número de molde ${item.mold_number} ya existe.`); return; }
      const { error: e } = await supabase.from("botaguas").insert([{ ...item, brand: item.brand.toUpperCase(), model: item.model.toUpperCase(), user_name: user?.toUpperCase() || null }]);
      error = e;
    }
    if (error) console.error(error.message);
    else { fetchInventory(); setIsModalOpen(false); setItemToEdit(undefined); }
  };

  const toggleItem = (id: number) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (allSelected: boolean) => setSelected(allSelected ? new Set() : new Set(paginatedData.map(i => i.id)));
  const bulkDel = async () => {
    await supabase.from("botaguas").delete().in("id", Array.from(selected));
    setSelected(new Set()); fetchInventory();
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from("botaguas").delete().eq("id", itemToDelete.id);
    if (error) console.error(error.message);
    else {
      setInventory((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setFilteredInventory((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setItemToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const totalPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
  const paginatedData = filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#07C3F8] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario Botaguas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona el inventario de botaguas</p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button onClick={bulkDel} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <Trash2 size={16} /> Eliminar ({selected.size})
            </button>
          )}
          <button
            onClick={() => exportCsv(filteredInventory.map(i => ({ Marca: i.brand, Modelo: i.model, "Año inicio": i.year_start, "Año fin": i.year_end ?? "", Puertas: i.doors, Tipo: i.type, Cantidad: i.quantity, Descripción: i.description, "Nro. Molde": i.mold_number })), "botaguas.csv")}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Download size={16} /> Exportar
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors">
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      {isModalOpen && (
        <AddInventoryForm onSubmit={handleAddOrUpdateItem} onClose={() => { setIsModalOpen(false); setItemToEdit(undefined); }} item={itemToEdit} />
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <h2 className="text-base font-semibold text-gray-900 mb-2">¿Eliminar este item?</h2>
              <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex justify-center gap-3 px-6 pb-6">
              <button onClick={() => { setItemToDelete(null); setIsDeleteModalOpen(false); }} className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">Cancelar</button>
              <button onClick={confirmDeleteItem} className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por molde o descripción..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); filterData(selectedBrand, selectedModel, selectedYear, e.target.value); }}
            className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
          />
        </div>
        <select value={selectedBrand} onChange={(e) => { setSelectedBrand(e.target.value); filterData(e.target.value, selectedModel, selectedYear, searchText); }} className={sel}>
          <option value="">Todas las marcas</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={selectedModel} onChange={(e) => { setSelectedModel(e.target.value); filterData(selectedBrand, e.target.value, selectedYear, searchText); }} className={sel}>
          <option value="">Todos los modelos</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={(e) => { const y = e.target.value ? parseInt(e.target.value, 10) : ""; setSelectedYear(y); filterData(selectedBrand, selectedModel, y, searchText); }} className={sel}>
          <option value="">Todos los años</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {(selectedBrand || selectedModel || selectedYear !== "" || searchText) && (
          <button onClick={() => { setSelectedBrand(""); setSelectedModel(""); setSelectedYear(""); setSearchText(""); setFilteredInventory(inventory); setCurrentPage(1); }} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm transition-colors">
            <X size={13} /> Limpiar
          </button>
        )}
        <span className="ml-auto self-center text-sm text-gray-400">{filteredInventory.length} resultado{filteredInventory.length !== 1 ? "s" : ""}</span>
      </div>

      <InventoryTable data={paginatedData} onEdit={(item) => { setItemToEdit(item); setIsModalOpen(true); }} onDelete={(item) => { setItemToDelete(item); setIsDeleteModalOpen(true); }} selected={selected} onToggle={toggleItem} onToggleAll={toggleAll} />

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 1} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={15} /> Anterior
          </button>
          <span className="text-sm text-gray-500">Página <span className="text-gray-900 font-medium">{currentPage}</span> de {totalPages}</span>
          <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Siguiente <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
