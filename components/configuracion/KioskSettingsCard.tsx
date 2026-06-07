"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { BookOpen, FolderKanban, Loader2, MonitorPlay } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type KioskSection = "proyectos" | "bitacora";

interface KioskSettingsCardProps {
  initialSection: KioskSection;
  isLight: boolean;
}

/**
 * Tarjeta "Modo Datawall" en Configuración → Mi cuenta.
 *
 * Solo se renderiza desde MyProfileTab cuando la cuenta actual tiene
 * `kioskMode === true`. Permite cambiar qué sección operativa muestra
 * la cuenta (Proyectos o Bitácora) — el resto del sidebar queda oculto
 * y el middleware redirige cualquier otra ruta a la elegida.
 */
export function KioskSettingsCard({
  initialSection,
  isLight,
}: KioskSettingsCardProps) {
  const { update } = useSession();
  const [section, setSection] = useState<KioskSection>(initialSection);
  const [saving, setSaving] = useState(false);

  const options: { value: KioskSection; label: string; description: string; icon: React.ElementType }[] = [
    {
      value: "proyectos",
      label: "Proyectos",
      description: "Tablero Kanban / lista de tareas en pantalla.",
      icon: FolderKanban,
    },
    {
      value: "bitacora",
      label: "Bitácora",
      description: "Feed diario de notas y eventos del equipo.",
      icon: BookOpen,
    },
  ];

  async function selectSection(next: KioskSection) {
    if (next === section || saving) return;
    const previous = section;
    setSection(next);
    setSaving(true);
    try {
      const res = await fetch("/api/me/kiosk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskSection: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        kioskSection?: KioskSection;
        error?: string | Record<string, unknown>;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        );
      }
      // Refrescar el JWT cliente para que el sidebar/middleware vean la nueva sección
      // inmediatamente, sin necesidad de logout/login.
      await update({ kioskSection: next });
      toast.success(`Sección guardada: ${next === "bitacora" ? "Bitácora" : "Proyectos"}`);
    } catch (err) {
      setSection(previous);
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la sección del datawall.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={cn(
        "mt-6 overflow-hidden rounded-2xl border shadow-xl",
        isLight
          ? "border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/95 shadow-zinc-200/40"
          : "border-white/10 bg-gradient-to-b from-[#121a2e]/95 to-[#0d1427]/98 shadow-black/30",
      )}
    >
      <header
        className={cn(
          "flex items-start gap-3 px-6 py-5",
          isLight ? "border-b border-zinc-200/80" : "border-b border-white/8",
        )}
      >
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            isLight
              ? "bg-amber-100 text-amber-700"
              : "bg-amber-500/15 text-amber-300",
          )}
        >
          <MonitorPlay className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2
            className={cn(
              "text-base font-bold leading-tight",
              isLight ? "text-zinc-900" : "text-white",
            )}
          >
            Modo Datawall
          </h2>
          <p
            className={cn(
              "mt-0.5 text-xs leading-snug",
              isLight ? "text-zinc-500" : "text-white/55",
            )}
          >
            Esta cuenta está pensada para una pantalla siempre visible.
            Solo se mostrará la sección que elijas + esta página de
            configuración; el resto del menú queda oculto y los cambios
            que otros usuarios hagan se reflejan en tiempo real.
          </p>
        </div>
      </header>

      <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = section === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectSection(opt.value)}
              disabled={saving}
              aria-pressed={selected}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                selected
                  ? isLight
                    ? "border-amber-400 bg-amber-50/70 shadow-sm shadow-amber-200/50"
                    : "border-amber-400/60 bg-amber-500/[0.08] shadow-md shadow-amber-500/10"
                  : isLight
                    ? "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                saving && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors",
                  selected
                    ? isLight
                      ? "bg-amber-100 text-amber-700"
                      : "bg-amber-500/20 text-amber-300"
                    : isLight
                      ? "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
                      : "bg-white/[0.06] text-white/55 group-hover:bg-white/[0.10]",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isLight ? "text-zinc-900" : "text-white",
                  )}
                >
                  {opt.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[11.5px] leading-snug",
                    isLight ? "text-zinc-500" : "text-white/55",
                  )}
                >
                  {opt.description}
                </p>
              </div>
              {selected && saving && (
                <Loader2 className="absolute right-3 top-3 h-3.5 w-3.5 animate-spin text-amber-400" />
              )}
              {selected && !saving && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-3 top-3 inline-flex h-2 w-2 rounded-full",
                    isLight ? "bg-amber-500" : "bg-amber-400",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
