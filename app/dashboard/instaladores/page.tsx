"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Plus, Phone, ChevronDown, ChevronUp, Pencil, ChevronLeft, ChevronRight, X } from "lucide-react";
import { waUrl, WaIcon } from "@/utils/wa";
import StaffModal, { StaffRecord } from "@/components/StaffModal";

interface Appointment {
  id: string;
  name: string;
  vehicle: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_date: string;
  status: string | null;
  description: string | null;
  phone: string | null;
}

interface ApptTask {
  id: string;
  description: string;
  completed: boolean;
  photo_urls: string[] | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pendiente",   color: "bg-yellow-100 text-yellow-700" },
  active:    { label: "En proceso",  color: "bg-amber-100 text-amber-700" },
  done:      { label: "Completada",  color: "bg-green-100 text-green-700" },
  confirmed: { label: "Confirmada",  color: "bg-blue-100 text-blue-700" },
  completed: { label: "Completada",  color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelada",   color: "bg-red-100 text-red-700" },
};

const PAGE_SIZE = 10;

function PhotoLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={url}
        alt={name}
        className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 p-2 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function ApptDetailModal({
  appt,
  onClose,
}: {
  appt: Appointment;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<ApptTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("appointment_tasks")
      .select("id,description,completed,photo_urls")
      .eq("appointment_id", appt.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setTasks(data ?? []); setLoading(false); });
  }, [appt.id, supabase]);

  const statusInfo = STATUS_LABEL[appt.status ?? ""] ?? { label: appt.status ?? "—", color: "bg-gray-100 text-gray-500" };

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{appt.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{appt.appointment_date.slice(0, 10)}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 overflow-y-auto space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Vehículo</p>
                <p className="font-medium text-gray-900">{appt.vehicle || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Hora</p>
                <p className="font-medium text-gray-900">
                  {appt.start_time && appt.end_time
                    ? `${appt.start_time.slice(0, 5)}–${appt.end_time.slice(0, 5)}`
                    : appt.start_time?.slice(0, 5) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Estado</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              {appt.phone && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Teléfono</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900">{appt.phone}</span>
                    <a href={waUrl(appt.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-green-600">
                      <WaIcon /> WA
                    </a>
                  </div>
                </div>
              )}
            </div>

            {appt.description && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Notas</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">{appt.description}</p>
              </div>
            )}

            {/* Tasks */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Tareas</p>
              {loading && <p className="text-xs text-gray-400 animate-pulse">Cargando...</p>}
              {!loading && tasks.length === 0 && <p className="text-xs text-gray-400">Sin tareas</p>}
              {!loading && tasks.length > 0 && (
                <ul className="space-y-3">
                  {tasks.map(t => (
                    <li key={t.id}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${t.completed ? "bg-emerald-400 border-emerald-400" : "border-gray-300"}`}>
                          {t.completed && (
                            <svg viewBox="0 0 8 8" width="8" height="8" fill="white"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none"/></svg>
                          )}
                        </span>
                        <span className={`text-sm ${t.completed ? "line-through text-gray-400" : "text-gray-800"}`}>{t.description}</span>
                      </div>
                      {t.photo_urls && t.photo_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 pl-6">
                          {t.photo_urls.map((url, i) => (
                            <button key={i} onClick={() => setLightboxUrl(url)} className="shrink-0">
                              <img
                                src={url}
                                alt={`foto ${i + 1}`}
                                className="w-16 h-16 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      {lightboxUrl && <PhotoLightbox url={lightboxUrl} name={appt.name} onClose={() => setLightboxUrl(null)} />}
    </>
  );
}

function StaffCard({
  s,
  onEdit,
}: {
  s: StaffRecord;
  onEdit: (s: StaffRecord) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [expanded, setExpanded] = useState(false);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  const fetchAppts = useCallback(async () => {
    setLoadingAppts(true);
    const { data } = await supabase
      .from("appointments")
      .select("id,name,vehicle,start_time,end_time,appointment_date,status,description,phone")
      .eq("staff_id", s.id)
      .order("appointment_date", { ascending: false });
    setAppts(data ?? []);
    setLoadingAppts(false);
  }, [supabase, s.id]);

  const handleToggle = () => {
    if (!expanded && appts.length === 0) fetchAppts();
    setExpanded(v => !v);
  };

  const initials = s.name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");

  const totalPages = Math.ceil(appts.length / PAGE_SIZE);
  const pageAppts = appts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition-opacity ${!s.active ? "opacity-50" : ""}`}>
      {/* Card header */}
      <div className="p-5 flex items-start gap-4">
        {/* Avatar */}
        <div
          className={`w-14 h-14 rounded-xl bg-[#07C3F8]/10 flex items-center justify-center shrink-0 overflow-hidden ${s.photo_url ? "cursor-zoom-in" : ""}`}
          onClick={() => s.photo_url && setLightbox(true)}
        >
          {s.photo_url ? (
            <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-[#07C3F8]">{initials || "?"}</span>
          )}
        </div>
        {lightbox && s.photo_url && (
          <PhotoLightbox url={s.photo_url} name={s.name} onClose={() => setLightbox(false)} />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{s.name}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {s.active ? "Activo" : "Inactivo"}
            </span>
          </div>
          {s.specialty && <p className="text-xs text-gray-500 mt-0.5">{s.specialty}</p>}
          {s.phone && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Phone className="w-3 h-3" aria-hidden="true" /> {s.phone}
              </span>
              <a href={waUrl(s.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors">
                <WaIcon /> WA
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(s)}
            aria-label="Editar instalador"
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#07C3F8] hover:bg-[#07C3F8]/10 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ver citas toggle */}
      <button
        onClick={handleToggle}
        className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span>Ver citas {appts.length > 0 ? `(${appts.length})` : ""}</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Appointment history */}
      {expanded && (
        <div className="border-t border-gray-100">
          {loadingAppts && <p className="text-xs text-gray-400 text-center py-4 animate-pulse">Cargando...</p>}
          {!loadingAppts && appts.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin citas registradas</p>}
          {!loadingAppts && appts.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-left">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Cliente</th>
                      <th className="px-4 py-2 font-medium hidden sm:table-cell">Vehículo</th>
                      <th className="px-4 py-2 font-medium hidden sm:table-cell">Hora</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageAppts.map(a => {
                      const statusInfo = STATUS_LABEL[a.status ?? ""] ?? { label: a.status ?? "—", color: "bg-gray-100 text-gray-500" };
                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedAppt(a)}
                        >
                          <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{a.appointment_date.slice(0, 10)}</td>
                          <td className="px-4 py-2 text-gray-900 font-medium">{a.name}</td>
                          <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{a.vehicle ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-500 hidden sm:table-cell whitespace-nowrap">
                            {a.start_time && a.end_time ? `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}` : a.start_time?.slice(0, 5) ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-400">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, appts.length)} de {appts.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {selectedAppt && (
        <ApptDetailModal appt={selectedAppt} onClose={() => setSelectedAppt(null)} />
      )}
    </div>
  );
}

export default function InstaladoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRecord | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/dashboard"); return; }
      supabase
        .from("user_roles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()
        .then(({ data: roleData }) => {
          if (roleData?.role !== "admin") router.replace("/dashboard");
        });
    });
  }, []);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("staff")
      .select("id,name,phone,specialty,photo_url,active")
      .order("name");
    setStaff((data as StaffRecord[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (s: StaffRecord) => { setEditing(s); setModalOpen(true); };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instaladores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Equipo de trabajo del taller</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#07C3F8] hover:bg-[#06aad9] text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors text-sm"
        >
          <Plus size={16} /> Agregar instalador
        </button>
      </div>

      {loading && <div className="text-center text-sm text-gray-400 py-16 animate-pulse">Cargando...</div>}

      {!loading && staff.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center text-gray-400 text-sm">
          No hay instaladores registrados
        </div>
      )}

      {!loading && staff.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {staff.map(s => (
            <StaffCard key={s.id} s={s} onEdit={openEdit} />
          ))}
        </div>
      )}

      {modalOpen && (
        <StaffModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          staff={editing}
          onSaved={fetchStaff}
        />
      )}
    </div>
  );
}
