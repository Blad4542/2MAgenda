"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Search, Plus, Phone, Calendar, ChevronRight } from "lucide-react";
import { inp, lbl } from "@/utils/styles";

interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  created_at: string;
  appointment_count?: number;
}

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, notes, created_at")
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Fetch appointment counts in parallel
    const counts = await Promise.all(
      data.map(c =>
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", c.id)
          .then(({ count }) => ({ id: c.id, count: count ?? 0 }))
      )
    );
    const countMap = Object.fromEntries(counts.map(c => [c.id, c.count]));
    setCustomers(data.map(c => ({ ...c, appointment_count: countMap[c.id] ?? 0 })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().replace(/\D/g, "").trim();
    if (!q && !search.trim()) return customers;
    return customers.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(search.toLowerCase());
      const phoneMatch = c.phone.replace(/\D/g, "").includes(q);
      return nameMatch || phoneMatch;
    });
  }, [customers, search]);

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

      {/* Search */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#07C3F8] focus:border-transparent transition-colors"
        />
      </div>

      {loading && (
        <div className="text-center text-sm text-gray-400 py-16 animate-pulse">Cargando...</div>
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
            {filtered.map(c => (
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
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Phone size={10} aria-hidden="true" /> {c.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} aria-hidden="true" />
                        {c.appointment_count} cita{c.appointment_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
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
