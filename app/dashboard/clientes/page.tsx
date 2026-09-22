"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Search, Plus, Phone, ChevronRight, ChevronLeft } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { inp, lbl } from "@/utils/styles";

interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  created_at: string;
}

export default function ClientesPage() {
  useRequireRole(["admin"]);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "name_asc" | "name_desc">("recent");
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [filterMake, setFilterMake] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [vehicles, setVehicles] = useState<{ customer_id: string; make: string | null; model: string | null; year: number | null }[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: vData }] = await Promise.all([
      supabase.from("customers").select("id, name, phone, notes, created_at").order("created_at", { ascending: false }),
      supabase.from("vehicles").select("customer_id, make, model, year"),
    ]);
    setCustomers((data ?? []) as Customer[]);
    setVehicles((vData ?? []) as typeof vehicles);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const make = filterMake.trim().toLowerCase();
    const model = filterModel.trim().toLowerCase();
    const year = filterYear.trim();

    const vehicleMatchIds = (make || model || year)
      ? new Set(
          vehicles.filter(v =>
            (!make || (v.make ?? "").toLowerCase().includes(make)) &&
            (!model || (v.model ?? "").toLowerCase().includes(model)) &&
            (!year || String(v.year ?? "").includes(year))
          ).map(v => v.customer_id)
        )
      : null;

    let result = customers.filter(c => {
      if (onlyWithNotes && !c.notes?.trim()) return false;
      if (vehicleMatchIds && !vehicleMatchIds.has(c.id)) return false;
      if (!term) return true;
      return c.name.toLowerCase().includes(term) || (digits.length > 0 && c.phone.replace(/\D/g, "").includes(digits));
    });
    result = [...result].sort((a, b) => {
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "name_asc") return a.name.localeCompare(b.name, "es");
      if (sortBy === "name_desc") return b.name.localeCompare(a.name, "es");
      return 0;
    });
    return result;
  }, [customers, search, sortBy, onlyWithNotes, filterMake, filterModel, filterYear, vehicles]);

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const saveNewCustomer = async () => {
    if (!newForm.name.trim() || !newForm.phone.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("customers")
      .insert({ name: newForm.name.trim(), phone: newForm.phone.trim(), notes: newForm.notes.trim() || null })
      .select("id")
      .single();
    setSaving(false);
    setNewModalOpen(false);
    setNewForm({ name: "", phone: "", notes: "" });
    if (data?.id) {
      router.push(`/dashboard/clientes/${data.id}`);
    } else {
      fetchCustomers();
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Directorio de clientes del taller</p>
        </div>
        <button
          onClick={() => setNewModalOpen(true)}
          className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors text-sm"
        >
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(0); }}
          className="text-sm border border-gray-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8]"
        >
          <option value="recent">Más reciente</option>
          <option value="oldest">Más antiguo</option>
          <option value="name_asc">Nombre A→Z</option>
          <option value="name_desc">Nombre Z→A</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={onlyWithNotes}
            onChange={e => { setOnlyWithNotes(e.target.checked); setPage(0); }}
            className="rounded border-gray-300 text-[#07C3F8] focus:ring-[#07C3F8]"
          />
          Solo con notas
        </label>
        <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      {/* Vehicle filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 -mt-3">
        <input
          type="text" placeholder="Marca" value={filterMake}
          onChange={e => { setFilterMake(e.target.value); setPage(0); }}
          className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] w-32"
        />
        <input
          type="text" placeholder="Modelo" value={filterModel}
          onChange={e => { setFilterModel(e.target.value); setPage(0); }}
          className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] w-32"
        />
        <input
          type="text" placeholder="Año" value={filterYear}
          onChange={e => { setFilterYear(e.target.value); setPage(0); }}
          className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] w-24"
        />
        {(filterMake || filterModel || filterYear) && (
          <button
            onClick={() => { setFilterMake(""); setFilterModel(""); setFilterYear(""); setPage(0); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Limpiar vehículo
          </button>
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0">
              <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-40" />
                <div className="h-2.5 bg-gray-100 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && customers.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center text-gray-400 text-sm">
          No hay clientes registrados
        </div>
      )}

      {!loading && customers.length > 0 && filtered.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400 text-sm">
          No se encontraron resultados para "{search}"
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {paginated.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => router.push(`/dashboard/clientes/${c.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#07C3F8]/10 flex items-center justify-center shrink-0">
                    <span className="text-base font-bold text-[#07C3F8]">
                      {c.name[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                      <Phone size={10} aria-hidden="true" /> {c.phone}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-400">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New customer modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-base font-semibold text-gray-900">Nuevo cliente</h2>
              <button onClick={() => setNewModalOpen(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className={lbl}>Nombre</label>
                <input className={inp} value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="Nombre completo" />
              </div>
              <div>
                <label className={lbl}>Teléfono</label>
                <input className={inp} value={newForm.phone} onChange={e => setNewForm({ ...newForm, phone: e.target.value })} placeholder="Ej: 85282245" />
              </div>
              <div>
                <label className={lbl}>Notas (opcional)</label>
                <textarea className={inp} value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })} placeholder="Observaciones generales" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setNewModalOpen(false)} className="px-4 py-2 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button
                onClick={saveNewCustomer}
                disabled={saving || !newForm.name.trim() || !newForm.phone.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
