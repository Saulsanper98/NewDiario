"use client";


import { isLightTheme } from "@/lib/theme";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Building2,
  Users,
  Plus,
  Archive,
  Sparkles,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { ConfigPageDepartment } from "@/lib/types/config";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

const PALETTE_COLORS = [
  "#ffeb66",
  "#ff6b6b",
  "#ff9f43",
  "#48dbfb",
  "#1dd1a1",
  "#c56ef3",
  "#54a0ff",
  "#fd79a8",
  "#00d2d3",
  "#a29bfe",
];

interface DepartmentsTabProps {
  departments: ConfigPageDepartment[];
  isSuperAdmin: boolean;
  isPlatformOwner: boolean;
}

export function DepartmentsTab({
  departments,
  isPlatformOwner,
}: DepartmentsTabProps) {
  const { accent, withAlpha } = useAccentForUi();
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState("#FFEB66");

  const stats = useMemo(() => {
    const total = departments.length;
    const archived = departments.filter((d) => d.isArchived).length;
    const active = total - archived;
    const members = departments.reduce((acc, d) => acc + d._count.members, 0);
    return { total, archived, active, members };
  }, [departments]);

  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
      return a.name.localeCompare(b.name, "es");
    });
  }, [departments]);

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
    <div className="config-departments-root space-y-5">
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border px-5 py-5 sm:px-6 sm:py-6",
          L
            ? "border-indigo-200 bg-gradient-to-br from-white via-indigo-50/55 to-sky-50/40 shadow-[var(--lt-shadow-glass)]"
            : "border-indigo-400/22 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-indigo-500/[0.07]",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-14 -right-20 h-48 w-48 rounded-full blur-3xl",
            L ? "bg-indigo-200/55" : "bg-indigo-500/14",
          )}
        />
        {/* Mobile: stack vertical — icono+texto arriba, boton de accion
            abajo a ancho completo. Antes el boton "Nuevo departamento"
            ocupaba ~50% del ancho y forzaba al texto a una columna ultra
            estrecha donde cada palabra caia en su propia linea. */}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 sm:flex-1 sm:min-w-0">
            <div
              className={cn(
                "shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl",
                L
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-indigo-500/15 text-indigo-300 border border-indigo-400/30",
              )}
            >
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                  L ? "text-zinc-500" : "text-white/40",
                )}
              >
                Configuración · Departamentos
              </p>
              <h2
                className={cn(
                  "text-lg sm:text-xl font-semibold leading-tight tracking-tight",
                  L ? "text-zinc-900" : "text-white",
                )}
              >
                Departamentos
              </h2>
              <p
                className={cn(
                  "mt-1.5 text-xs sm:text-sm leading-relaxed [overflow-wrap:break-word]",
                  L ? "text-zinc-600" : "text-white/55",
                )}
              >
                Crea y organiza los departamentos a los que pertenecen tus
                compañeros. El color de acento se aplica en bitácora, proyectos
                y el resto de la app.
              </p>
            </div>
          </div>
          {isPlatformOwner && (
            <div className="w-full sm:w-auto sm:shrink-0">
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={openModal}
                className="w-full justify-center sm:w-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo departamento
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          L={L}
          label="Departamentos"
          value={stats.total}
          icon={<Building2 className="w-4 h-4" />}
          tone={L ? "text-indigo-700 bg-indigo-100 border-indigo-200" : "text-indigo-300 bg-indigo-500/12 border-indigo-400/25"}
        />
        <KpiCard
          L={L}
          label="Activos"
          value={stats.active}
          icon={<Sparkles className="w-4 h-4" />}
          tone={L ? "text-emerald-700 bg-emerald-100 border-emerald-200" : "text-emerald-300 bg-emerald-500/12 border-emerald-400/25"}
        />
        <KpiCard
          L={L}
          label="Miembros"
          value={stats.members}
          icon={<Users className="w-4 h-4" />}
          tone={L ? "text-sky-700 bg-sky-100 border-sky-200" : "text-sky-300 bg-sky-500/12 border-sky-400/25"}
        />
        <KpiCard
          L={L}
          label="Archivados"
          value={stats.archived}
          icon={<Archive className="w-4 h-4" />}
          tone={
            stats.archived > 0
              ? L
                ? "text-amber-700 bg-amber-100 border-amber-200"
                : "text-amber-300 bg-amber-500/12 border-amber-400/25"
              : L
                ? "text-zinc-500 bg-zinc-100 border-zinc-200"
                : "text-white/40 bg-white/5 border-white/10"
          }
        />
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo departamento"
        description="El identificador URL (slug) se generará automáticamente a partir del nombre."
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            light={L}
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej. Sistemas"
          />
          <div className="flex flex-col gap-1.5">
            <label
              className={cn(
                "text-xs font-medium uppercase tracking-wide flex items-center gap-1.5",
                L ? "text-zinc-500" : "text-white/60",
              )}
            >
              <Palette className="w-3.5 h-3.5" />
              Color de acento
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setAccentColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor:
                      accentColor.toLowerCase() === c.toLowerCase()
                        ? L
                          ? "#18181b"
                          : "white"
                        : "transparent",
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className={cn(
                  "h-9 w-14 rounded cursor-pointer",
                  L
                    ? "border border-zinc-200 bg-white"
                    : "border border-white/10 bg-transparent",
                )}
              />
              <span
                className={cn(
                  "text-xs font-mono",
                  L ? "text-zinc-500" : "text-white/40",
                )}
              >
                {accentColor}
              </span>
              <div
                className="flex items-center gap-2 ml-auto px-2.5 py-1.5 rounded-lg"
                style={{
                  backgroundColor: `${accentColor}18`,
                  borderLeft: `3px solid ${accentColor}`,
                }}
              >
                <Building2
                  className="w-4 h-4 shrink-0"
                  style={{ color: accentColor }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: accentColor }}
                >
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

      {/* Lista */}
      {sortedDepartments.length === 0 ? (
        <EmptyDepartmentsState L={L} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedDepartments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              L={L}
              accent={accent}
              withAlpha={withAlpha}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  L,
  label,
  value,
  icon,
  tone,
}: {
  L: boolean;
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 sm:p-3.5 flex items-center gap-3 transition-colors",
        L
          ? "border-black/[0.07] bg-white/82 shadow-[var(--lt-shadow-glass)]"
          : "glass",
      )}
    >
      <div
        className={cn(
          "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border",
          tone,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[10.5px] font-semibold uppercase tracking-wider leading-tight",
            L ? "text-zinc-500" : "text-white/45",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "text-lg font-semibold leading-tight tabular-nums",
            L ? "text-zinc-900" : "text-white",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function DepartmentCard({
  dept,
  L,
  accent,
  withAlpha,
}: {
  dept: ConfigPageDepartment;
  L: boolean;
  accent: (c: string) => string;
  withAlpha: (c: string, alpha: string) => string;
}) {
  const accentColor = accent(dept.accentColor);
  const memberCount = dept._count.members;
  return (
    <Card
      light={L}
      className={cn(
        "relative overflow-hidden flex items-start justify-between gap-4 transition-colors",
        dept.isArchived
          ? L
            ? "opacity-80 hover:opacity-100"
            : "opacity-75 hover:opacity-100"
          : L
            ? "hover:border-black/[0.14]"
            : "hover:border-white/20",
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-center gap-3 min-w-0 pl-1">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
          style={{
            backgroundColor: withAlpha(dept.accentColor, "1f"),
            borderColor: withAlpha(dept.accentColor, "30"),
            color: accentColor,
          }}
        >
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold text-sm leading-tight truncate",
              L ? "text-zinc-900" : "text-white",
            )}
          >
            {dept.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <Users
              className={cn(
                "w-3 h-3 shrink-0",
                L ? "text-zinc-400" : "text-white/35",
              )}
            />
            <span
              className={cn(
                "text-xs",
                L ? "text-zinc-500" : "text-white/45",
              )}
            >
              {memberCount === 0
                ? "Sin miembros"
                : memberCount === 1
                  ? "1 miembro activo"
                  : `${memberCount} miembros activos`}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        {dept.isArchived ? (
          <Badge variant="error" size="sm">
            Archivado
          </Badge>
        ) : (
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
              L
                ? "text-emerald-700 bg-emerald-100"
                : "text-emerald-300 bg-emerald-500/12",
            )}
          >
            Activo
          </span>
        )}
        <div
          className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 rounded font-mono text-[10px]",
            L
              ? "bg-zinc-100 text-zinc-600 border border-zinc-200"
              : "bg-white/5 text-white/55 border border-white/10",
          )}
          title={`Color: ${dept.accentColor}`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full border"
            style={{
              backgroundColor: accentColor,
              borderColor: L ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.2)",
            }}
          />
          {dept.accentColor.toUpperCase()}
        </div>
      </div>
    </Card>
  );
}

function EmptyDepartmentsState({ L }: { L: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed p-8 sm:p-10 text-center",
        L
          ? "border-zinc-300 bg-white/60"
          : "border-white/12 bg-white/[0.03]",
      )}
    >
      <div
        className={cn(
          "mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-3",
          L
            ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
            : "bg-indigo-500/15 text-indigo-300 border border-indigo-400/30",
        )}
      >
        <Building2 className="w-6 h-6" />
      </div>
      <h3
        className={cn(
          "text-sm font-semibold mb-1",
          L ? "text-zinc-900" : "text-white",
        )}
      >
        Aún no hay departamentos
      </h3>
      <p
        className={cn(
          "text-xs",
          L ? "text-zinc-500" : "text-white/50",
        )}
      >
        Crea el primer departamento para empezar a organizar a tu equipo.
      </p>
    </div>
  );
}
