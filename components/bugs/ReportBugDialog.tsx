"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Bug,
  Globe,
  Send,
  TriangleAlert,
  Zap,
  CircleDot,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";
import { BugReportPriority } from "@/app/generated/prisma/enums";
import { BUG_REPORT_PRIORITY_LABELS } from "@/lib/bug-reports";

interface ReportBugDialogProps {
  open: boolean;
  onClose: () => void;
}

const PRIORITY_OPTIONS: Array<{
  value: BugReportPriority;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Estilo del card cuando NO está seleccionado (oscuro). */
  idle: string;
  /** Estilo del card cuando NO está seleccionado (light). */
  idleLight: string;
  /** Estilo del card cuando ESTÁ seleccionado (oscuro). */
  active: string;
  /** Estilo del card cuando ESTÁ seleccionado (light). */
  activeLight: string;
  /** Color del icono. */
  iconColor: string;
  iconColorLight: string;
}> = [
  {
    value: BugReportPriority.LOW,
    label: BUG_REPORT_PRIORITY_LABELS.LOW,
    hint: "Pequeño detalle, puede esperar",
    icon: CircleDot,
    idle: "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
    idleLight: "border-zinc-200 bg-white hover:bg-zinc-50",
    active:
      "border-zinc-400/40 bg-zinc-400/10 ring-1 ring-zinc-400/30 shadow-sm",
    activeLight:
      "border-zinc-400 bg-zinc-50 ring-1 ring-zinc-300 shadow-sm",
    iconColor: "text-zinc-300",
    iconColorLight: "text-zinc-600",
  },
  {
    value: BugReportPriority.MEDIUM,
    label: BUG_REPORT_PRIORITY_LABELS.MEDIUM,
    hint: "Molesta pero puedo trabajar",
    icon: TriangleAlert,
    idle: "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
    idleLight: "border-zinc-200 bg-white hover:bg-zinc-50",
    active:
      "border-amber-400/45 bg-amber-400/10 ring-1 ring-amber-400/40 shadow-sm shadow-amber-500/10",
    activeLight:
      "border-amber-400 bg-amber-50 ring-1 ring-amber-300 shadow-sm",
    iconColor: "text-amber-300",
    iconColorLight: "text-amber-700",
  },
  {
    value: BugReportPriority.HIGH,
    label: BUG_REPORT_PRIORITY_LABELS.HIGH,
    hint: "Me bloquea, urgente",
    icon: Zap,
    idle: "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
    idleLight: "border-zinc-200 bg-white hover:bg-zinc-50",
    active:
      "border-rose-400/45 bg-rose-400/10 ring-1 ring-rose-400/40 shadow-sm shadow-rose-500/10",
    activeLight:
      "border-rose-400 bg-rose-50 ring-1 ring-rose-300 shadow-sm",
    iconColor: "text-rose-300",
    iconColorLight: "text-rose-700",
  },
];

const MAX_DESCRIPTION = 10000;
const MIN_DESCRIPTION = 10;

export function ReportBugDialog({ open, onClose }: ReportBugDialogProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const pathname = usePathname();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<BugReportPriority>(
    BugReportPriority.MEDIUM
  );
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setPriority(BugReportPriority.MEDIUM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const pageUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${pathname}${window.location.search}`
          : pathname;

      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          pageUrl,
          priority,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data?.error;
        if (err && typeof err === "object") {
          const first = Object.values(err as Record<string, string[]>)[0]?.[0];
          throw new Error(first ?? "No se pudo enviar el reporte");
        }
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo enviar el reporte"
        );
      }
      toast.success("Reporte enviado. Gracias por avisar.");
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  }

  const descLen = description.length;
  const descTooShort = descLen > 0 && descLen < MIN_DESCRIPTION;
  const descRatio = Math.min(descLen / MAX_DESCRIPTION, 1);
  const titleLen = title.length;

  const inputBase = cn(
    "w-full rounded-xl border px-3.5 text-sm transition-colors focus:outline-none focus:ring-2",
    L
      ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:ring-amber-400/25"
      : "border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 focus:border-[#ffeb66]/55 focus:ring-[#ffeb66]/20"
  );

  return (
    <Modal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Hero del diálogo ── */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-4 sm:p-5",
            L
              ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-amber-50/60 to-orange-50/40"
              : "border-[#ffeb66]/20 bg-gradient-to-br from-[#ffeb66]/[0.08] via-amber-500/[0.04] to-orange-500/[0.04]"
          )}
        >
          {/* Patrón de fondo decorativo */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#ffeb66]/15 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-rose-400/10 blur-2xl"
          />

          <div className="relative flex items-start gap-3.5">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-sm",
                L
                  ? "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 ring-amber-200"
                  : "bg-gradient-to-br from-[#ffeb66]/25 to-amber-500/15 text-[#ffeb66] ring-[#ffeb66]/30"
              )}
            >
              <Bug className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2
                  id="modal-title"
                  className={cn(
                    "text-base font-bold leading-tight",
                    L ? "text-zinc-900" : "text-white"
                  )}
                >
                  Reportar un bug
                </h2>
                <Sparkles
                  className={cn(
                    "h-3.5 w-3.5",
                    L ? "text-amber-500" : "text-[#ffeb66]/70"
                  )}
                  aria-hidden
                />
              </div>
              <p
                className={cn(
                  "mt-0.5 text-[12.5px] leading-snug",
                  L ? "text-zinc-600" : "text-white/60"
                )}
              >
                Cuéntanos qué ha fallado. Adjuntaremos la página actual para
                ayudar a localizar el fallo.
              </p>
            </div>
          </div>
        </div>

        {/* ── Título ── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="bug-title"
              className={cn(
                "text-[11px] font-bold uppercase tracking-[0.14em]",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Título breve <span className="text-rose-400">*</span>
            </label>
            <span
              className={cn(
                "text-[10px] tabular-nums",
                L ? "text-zinc-400" : "text-white/30",
                titleLen > 180 && (L ? "text-amber-600" : "text-amber-300")
              )}
            >
              {titleLen}/200
            </span>
          </div>
          <input
            id="bug-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            autoFocus
            placeholder="Ej. No guarda la nota al publicar"
            className={cn(inputBase, "h-10")}
          />
        </div>

        {/* ── Descripción ── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="bug-description"
              className={cn(
                "text-[11px] font-bold uppercase tracking-[0.14em]",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Qué pasó <span className="text-rose-400">*</span>
            </label>
            <span
              className={cn(
                "text-[10px] tabular-nums",
                descTooShort
                  ? L
                    ? "text-amber-700"
                    : "text-amber-300"
                  : L
                    ? "text-zinc-400"
                    : "text-white/30"
              )}
            >
              {descTooShort
                ? `Mínimo ${MIN_DESCRIPTION} caracteres`
                : `${descLen}/${MAX_DESCRIPTION}`}
            </span>
          </div>
          <textarea
            id="bug-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={MIN_DESCRIPTION}
            maxLength={MAX_DESCRIPTION}
            rows={5}
            placeholder={
              "Por ejemplo:\n  1. Abro la bitácora\n  2. Pulso publicar\n  3. Sale toast de error pero la entrada no se guarda"
            }
            className={cn(inputBase, "resize-y py-2.5 leading-relaxed")}
          />
          {/* Barra de progreso del contador */}
          <div
            className={cn(
              "h-0.5 w-full overflow-hidden rounded-full",
              L ? "bg-zinc-100" : "bg-white/8"
            )}
          >
            <div
              className={cn(
                "h-full transition-all",
                descRatio < 0.7
                  ? L
                    ? "bg-emerald-400"
                    : "bg-emerald-400/70"
                  : descRatio < 0.95
                    ? L
                      ? "bg-amber-400"
                      : "bg-amber-400/70"
                    : L
                      ? "bg-rose-500"
                      : "bg-rose-400/70"
              )}
              style={{ width: `${Math.max(descRatio * 100, descLen > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>

        {/* ── Urgencia (pills tarjeta) ── */}
        <div className="flex flex-col gap-2">
          <label
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.14em]",
              L ? "text-zinc-600" : "text-white/55"
            )}
          >
            ¿Qué tan urgente es?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = priority === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  aria-pressed={selected}
                  className={cn(
                    "group flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all",
                    L
                      ? selected
                        ? opt.activeLight
                        : opt.idleLight
                      : selected
                        ? opt.active
                        : opt.idle
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-transform group-hover:scale-110",
                        L ? opt.iconColorLight : opt.iconColor
                      )}
                    />
                    {selected && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          L ? opt.iconColorLight : opt.iconColor,
                          L
                            ? "bg-current shadow-[0_0_0_3px_currentColor]/20"
                            : "bg-current"
                        )}
                      />
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-[12.5px] font-semibold leading-none",
                      L ? "text-zinc-900" : "text-white/90"
                    )}
                  >
                    {opt.label}
                  </p>
                  <p
                    className={cn(
                      "text-[10.5px] leading-tight",
                      L ? "text-zinc-500" : "text-white/45"
                    )}
                  >
                    {opt.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Contexto: página actual ── */}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
            L
              ? "border-zinc-200 bg-zinc-50"
              : "border-white/8 bg-white/[0.03]"
          )}
        >
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              L
                ? "bg-white text-zinc-500 ring-1 ring-zinc-200"
                : "bg-white/[0.05] text-white/55 ring-1 ring-white/8"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[9.5px] font-bold uppercase tracking-[0.14em] leading-none",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              Página actual · se adjuntará
            </p>
            <p
              className={cn(
                "mt-0.5 text-[11.5px] font-mono truncate",
                L ? "text-zinc-700" : "text-white/70"
              )}
              title={pathname}
            >
              {pathname}
            </p>
          </div>
        </div>

        {/* ── Acciones ── */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={submitting || descTooShort || titleLen === 0}
          >
            <Send className="h-3.5 w-3.5" />
            Enviar reporte
          </Button>
        </div>
      </form>
    </Modal>
  );
}
