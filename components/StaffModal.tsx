"use client";
import { useState, useRef } from "react";
import Modal from "@/components/Modal";
import { inp, lbl } from "@/utils/styles";
import { waUrl, WaIcon } from "@/utils/wa";
import { createClient } from "@/utils/supabase/client";
import { Upload, Trash2 } from "lucide-react";

export interface StaffRecord {
  id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  photo_url: string | null;
  active: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  staff?: StaffRecord | null;
  onSaved: () => void;
}

export default function StaffModal({ isOpen, onClose, staff, onSaved }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: staff?.name ?? "",
    phone: staff?.phone ?? "",
    specialty: staff?.specialty ?? "",
    active: staff?.active ?? true,
  });
  const [photoUrl, setPhotoUrl] = useState(staff?.photo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when staff prop changes
  const isEdit = !!staff;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const staffId = staff?.id ?? crypto.randomUUID();
    const path = `${staffId}/${Date.now()}`;
    const { error } = await supabase.storage
      .from("staff-photos")
      .upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("staff-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      specialty: form.specialty.trim() || null,
      photo_url: photoUrl || null,
      active: form.active,
    };
    if (isEdit) {
      await supabase.from("staff").update(payload).eq("id", staff.id);
    } else {
      await supabase.from("staff").insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!staff) return;
    if (!confirm(`¿Eliminar a ${staff.name}? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    await supabase.from("staff").delete().eq("id", staff.id);
    setDeleting(false);
    onSaved();
    onClose();
  };

  const initials = form.name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Editar instalador" : "Nuevo instalador"}>
      <div className="space-y-4">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#07C3F8]/10 flex items-center justify-center shrink-0 overflow-hidden">
            {photoUrl ? (
              <img src={photoUrl} alt={form.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-[#07C3F8]">{initials || "?"}</span>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-sm font-medium text-[#07C3F8] hover:text-[#06aad9] transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Subiendo..." : "Subir foto"}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG — máx 2MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>

        {/* Name */}
        <div>
          <label className={lbl}>Nombre *</label>
          <input
            className={inp}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre completo"
          />
        </div>

        {/* Phone */}
        <div>
          <label className={lbl}>Teléfono</label>
          <div className="flex gap-2">
            <input
              className={inp}
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="Ej: 85282245"
            />
            {form.phone && (
              <a
                href={waUrl(form.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
              >
                <WaIcon /> WA
              </a>
            )}
          </div>
        </div>

        {/* Specialty */}
        <div>
          <label className={lbl}>Especialidad</label>
          <input
            className={inp}
            value={form.specialty}
            onChange={e => setForm({ ...form, specialty: e.target.value })}
            placeholder="Ej: Polarizado, Vinil, Pintura"
          />
        </div>

        {/* Active */}
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-gray-700">Activo</span>
          <button
            type="button"
            onClick={() => setForm({ ...form, active: !form.active })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.active ? "bg-[#07C3F8]" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.active ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className={`flex mt-6 pt-4 border-t border-gray-100 ${isEdit ? "justify-between" : "justify-end"}`}>
        {isEdit && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#07C3F8] hover:bg-[#06aad9] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
