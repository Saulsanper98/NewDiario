"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Building2, Users, Plus } from "lucide-react";

const PALETTE_COLORS = [
  "#ffeb66", "#ff6b6b", "#ff9f43", "#48dbfb", "#1dd1a1",
  "#c56ef3", "#54a0ff", "#fd79a8", "#00d2d3", "#a29bfe",
];
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { ConfigPageDepartment } from "@/lib/types/config";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";

interface DepartmentsTabProps {
  departments: ConfigPageDepartment[];
  isSuperAdmin: boolean;
}

export function DepartmentsTab({ departments, isSuperAdmin }: DepartmentsTabProps) {
  const { accent, withAlpha } = useAccentForUi();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState("#FFEB66");

  function openModal() {
    setName("");
    setAccentColor("#FFEB66");
    setModalOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) {
      toast.error("Nombre demasiado corto");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, accentColor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : "No se pudo crear el departamento";
        throw new Error(msg);
      }
      toast.success("Departamento creado");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">
          {departments.length} departamento{departments.length !== 1 ? "s" : ""}
        </p>
        {isSuperAdmin && (
          <Button variant="primary" size="md" type="button" onClick={openModal}>
            <Plus className="w-3.5 h-3.5" />
            Nuevo departamento
          </Button>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo departamento"
        description="El identificador URL (slug) se generará automáticamente a partir del nombre."
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej. Sistemas"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Color de acento
            </label>
            {/* Palette chips */}
            <div className="flex flex-wrap gap-1.5 mb-1">
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setAccentColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: accentColor === c ? "white" : "transparent",
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-14 rounded border border-white/10 bg-transparent cursor-pointer"
              />
              <span className="text-xs text-white/40 font-mono">{accentColor}</span>
              {/* Live preview */}
              <div className="flex items-center gap-2 ml-auto px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: `${accentColor}18`, borderLeft: `3px solid ${accentColor}` }}>
                <Building2 className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                <span className="text-xs font-medium" style={{ color: accentColor }}>
                  {name.trim() || "Previsualización"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Crear
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="glass rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: withAlpha(dept.accentColor, "20") }}
              >
                <Building2
                  className="w-5 h-5"
                  style={{ color: accent(dept.accentColor) }}
                />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{dept.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Users className="w-3 h-3 text-white/30" />
                  <span className="text-xs text-white/40">
                    {dept._count.members} miembro
                    {dept._count.members !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dept.isArchived && (
                <Badge variant="error" size="sm">
                  Archivado
                </Badge>
              )}
              <div
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: accent(dept.accentColor) }}
                title={`Color: ${dept.accentColor}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
