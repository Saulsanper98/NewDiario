"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardSignature,
  X,
  Loader2,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import type { ShiftHandoffActive } from "@/lib/types/shift-handoff";
import { Modal } from "@/components/ui/Modal";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Button } from "@/components/ui/Button";
import { Listbox } from "@/components/ui/Listbox";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import {
  SHIFT_LABELS,
  getCurrentShift,
} from "@/lib/utils";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const SHIFT_ICONS = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
} as const;

interface ShiftHandoffPanelProps {
  departmentId: string;
  initialHandoff: ShiftHandoffActive | null;
}

export function ShiftHandoffPanel({
  departmentId,
  initialHandoff,
}: ShiftHandoffPanelProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const L = theme === "light";
  const [handoff, setHandoff] = useState<ShiftHandoffActive | null>(
    initialHandoff
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shift, setShift] = useState<
    "MORNING" | "AFTERNOON" | "NIGHT"
  >(() => getCurrentShift());
  const [pendingText, setPendingText] = useState("");
  const [watchText, setWatchText] = useState("");
  const [avoidText, setAvoidText] = useState("");

  useEffect(() => {
    setHandoff(initialHandoff);
  }, [initialHandoff]);

  async function dismiss() {
    if (!handoff) return;
    setDismissing(true);
    try {
      const res = await fetch(`/api/shift-handoff/${handoff.id}/dismiss`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      setHandoff(null);
      toast.success("Semilla archivada");
      router.refresh();
    } catch {
      toast.error("No se pudo archivar");
    } finally {
      setDismissing(false);
    }
  }

  async function submitSeed() {
    setSaving(true);
    try {
      const res = await fetch("/api/shift-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          shift,
          pendingText,
          watchText,
          avoidText,
        }),
      });
      const data = (await res.json()) as { handoff?: ShiftHandoffActive; error?: unknown };
      if (!res.ok) throw new Error();
      if (data.handoff) {
        const h = data.handoff;
        setHandoff({
          ...h,
          createdAt:
            typeof h.createdAt === "string"
              ? h.createdAt
              : new Date(h.createdAt as unknown as Date).toISOString(),
        });
      }
      toast.success("Semilla guardada para el siguiente turno");
      setModalOpen(false);
      setPendingText("");
      setWatchText("");
      setAvoidText("");
      setShift(getCurrentShift());
      router.refresh();
    } catch {
      toast.error("No se pudo guardar la semilla");
    } finally {
      setSaving(false);
    }
  }

  const ShiftIcon = SHIFT_ICONS[handoff?.shift ?? "MORNING"];

  return (
    <div className="shrink-0 px-4 sm:px-6 pt-2 pb-1 space-y-2">
      {handoff && (
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3",
            L
              ? "border-amber-300 bg-amber-50/85"
              : "border-[#ffeb66]/28 bg-[#ffeb66]/[0.07]"
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardSignature
                className={cn(
                  "w-4 h-4 shrink-0",
                  L ? "text-amber-700" : "text-[#ffeb66]"
                )}
              />
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide truncate",
                  L ? "text-amber-800" : "text-[#ffeb66]"
                )}
              >
                Semilla del turno anterior
              </p>
            </div>
            <button
              type="button"
              onClick={() => void dismiss()}
              disabled={dismissing}
              className={cn(
                "shrink-0 p-1 rounded-lg disabled:opacity-50",
                L
                  ? "text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                  : "text-white/45 hover:text-white hover:bg-white/8"
              )}
              aria-label="Archivar semilla"
              title="Ya no mostrar (queda guardada en historial del servidor)"
            >
              {dismissing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </button>
          </div>
          <p
            className={cn(
              "text-[11px] mb-2 flex items-center gap-1.5 flex-wrap",
              L ? "text-amber-900/80" : "text-white/40"
            )}
          >
            <ShiftIcon
              className={cn(
                "w-3 h-3",
                L ? "text-amber-700" : "text-white/50"
              )}
            />
            <span>{SHIFT_LABELS[handoff.shift]}</span>
            <span>·</span>
            <UserProfilePopover
              userId={handoff.author.id}
              name={handoff.author.name}
              image={handoff.author.image}
            />
            <span>·</span>
            <span>
              {format(new Date(handoff.createdAt), "d MMM HH:mm", { locale: es })}
            </span>
          </p>
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            {[
              { key: "Pendiente", text: handoff.pendingText, tone: "amber" as const },
              { key: "Vigilar", text: handoff.watchText, tone: "sky" as const },
              { key: "No tocar / evitar", text: handoff.avoidText, tone: "rose" as const },
            ].map((b) => {
              const toneCls = L
                ? {
                    amber: "text-amber-800",
                    sky: "text-sky-800",
                    rose: "text-rose-800",
                  }[b.tone]
                : {
                    amber: "text-amber-200/80",
                    sky: "text-sky-200/80",
                    rose: "text-rose-200/80",
                  }[b.tone];
              return (
                <div
                  key={b.key}
                  className={cn(
                    "rounded-lg border p-2",
                    L
                      ? "bg-white border-amber-200/60"
                      : "bg-black/20 border-white/8"
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] font-medium uppercase mb-1",
                      toneCls
                    )}
                  >
                    {b.key}
                  </p>
                  <p
                    className={cn(
                      "whitespace-pre-wrap leading-snug",
                      L ? "text-zinc-800" : "text-white/75"
                    )}
                  >
                    {b.text || "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setShift(getCurrentShift());
            setModalOpen(true);
          }}
          className={cn(
            L
              ? "border-amber-300 text-amber-800 hover:bg-amber-50 hover:border-amber-400"
              : "border-[#ffeb66]/25 text-[#ffeb66]/90 hover:bg-[#ffeb66]/10"
          )}
        >
          <ClipboardSignature className="w-3.5 h-3.5" />
          Dejar semilla para el siguiente turno
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="Semilla de continuidad"
        description="Lo que vea el siguiente turno al abrir la bitácora (hasta archivarla)."
        size="lg"
      >
        <div className="space-y-4 px-1 pb-1">
          <div>
            <label
              className={cn(
                "block text-[11px] font-medium uppercase tracking-wide mb-1.5",
                L ? "text-zinc-500" : "text-white/45"
              )}
            >
              Turno desde el que dejas la nota
            </label>
            <Listbox
              value={shift}
              onChange={(v) =>
                setShift(v as "MORNING" | "AFTERNOON" | "NIGHT")
              }
              options={(
                Object.keys(SHIFT_LABELS) as (keyof typeof SHIFT_LABELS)[]
              ).map((k) => ({ value: k, label: SHIFT_LABELS[k] }))}
              light={L}
              ariaLabel="Turno desde el que dejas la nota"
            />
          </div>
          <Textarea
            light={L}
            tone="amber"
            label="¿Qué quedó colgado?"
            value={pendingText}
            onChange={(e) => setPendingText(e.target.value)}
            rows={3}
            placeholder="Seguimientos, cambios a medias, cosas sin cerrar…"
          />
          <Textarea
            light={L}
            tone="sky"
            label="Qué vigilar"
            value={watchText}
            onChange={(e) => setWatchText(e.target.value)}
            rows={3}
            placeholder="Servicios sensibles, ventanas, alertas…"
          />
          <Textarea
            light={L}
            tone="rose"
            label="Qué no tocar / evitar"
            value={avoidText}
            onChange={(e) => setAvoidText(e.target.value)}
            rows={3}
            placeholder="Equipos en mantenimiento, cambios recientes frágiles…"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className={cn(
                L &&
                  "border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 hover:border-zinc-300"
              )}
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={saving}
              onClick={() => void submitSeed()}
            >
              Publicar semilla
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
