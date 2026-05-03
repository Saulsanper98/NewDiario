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
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
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
        <div className="rounded-xl border border-[#ffeb66]/28 bg-[#ffeb66]/[0.07] px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardSignature className="w-4 h-4 text-[#ffeb66] shrink-0" />
              <p className="text-xs font-semibold text-[#ffeb66] uppercase tracking-wide truncate">
                Semilla del turno anterior
              </p>
            </div>
            <button
              type="button"
              onClick={() => void dismiss()}
              disabled={dismissing}
              className="shrink-0 p-1 rounded-lg text-white/45 hover:text-white hover:bg-white/8 disabled:opacity-50"
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
          <p className="text-[11px] text-white/40 mb-2 flex items-center gap-1.5 flex-wrap">
            <ShiftIcon className="w-3 h-3 text-white/50" />
            <span>{SHIFT_LABELS[handoff.shift]}</span>
            <span>·</span>
            <span>{handoff.author.name}</span>
            <span>·</span>
            <span>
              {format(new Date(handoff.createdAt), "d MMM HH:mm", { locale: es })}
            </span>
          </p>
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded-lg bg-black/20 border border-white/8 p-2">
              <p className="text-[10px] font-medium text-amber-200/80 uppercase mb-1">
                Pendiente
              </p>
              <p className="text-white/75 whitespace-pre-wrap leading-snug">
                {handoff.pendingText || "—"}
              </p>
            </div>
            <div className="rounded-lg bg-black/20 border border-white/8 p-2">
              <p className="text-[10px] font-medium text-sky-200/80 uppercase mb-1">
                Vigilar
              </p>
              <p className="text-white/75 whitespace-pre-wrap leading-snug">
                {handoff.watchText || "—"}
              </p>
            </div>
            <div className="rounded-lg bg-black/20 border border-white/8 p-2 sm:col-span-1">
              <p className="text-[10px] font-medium text-rose-200/80 uppercase mb-1">
                No tocar / evitar
              </p>
              <p className="text-white/75 whitespace-pre-wrap leading-snug">
                {handoff.avoidText || "—"}
              </p>
            </div>
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
          className="border-[#ffeb66]/25 text-[#ffeb66]/90 hover:bg-[#ffeb66]/10"
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
            <label className="block text-[11px] font-medium text-white/45 uppercase tracking-wide mb-1.5">
              Turno desde el que dejas la nota
            </label>
            <select
              value={shift}
              onChange={(e) =>
                setShift(e.target.value as "MORNING" | "AFTERNOON" | "NIGHT")
              }
              className="w-full rounded-lg border border-white/12 bg-[#060912] px-3 py-2 text-sm text-white"
            >
              {(Object.keys(SHIFT_LABELS) as (keyof typeof SHIFT_LABELS)[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {SHIFT_LABELS[k]}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-amber-200/80 uppercase tracking-wide mb-1.5">
              ¿Qué quedó colgado?
            </label>
            <textarea
              value={pendingText}
              onChange={(e) => setPendingText(e.target.value)}
              rows={3}
              className={cn(
                "w-full rounded-lg border border-white/12 bg-[#060912] px-3 py-2 text-sm text-white",
                "placeholder:text-white/25 focus:border-[#ffeb66]/40 focus:outline-none focus:ring-1 focus:ring-[#ffeb66]/25"
              )}
              placeholder="Seguimientos, cambios a medias, cosas sin cerrar…"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-sky-200/80 uppercase tracking-wide mb-1.5">
              Qué vigilar
            </label>
            <textarea
              value={watchText}
              onChange={(e) => setWatchText(e.target.value)}
              rows={3}
              className={cn(
                "w-full rounded-lg border border-white/12 bg-[#060912] px-3 py-2 text-sm text-white",
                "placeholder:text-white/25 focus:border-[#ffeb66]/40 focus:outline-none focus:ring-1 focus:ring-[#ffeb66]/25"
              )}
              placeholder="Servicios sensibles, ventanas, alertas…"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-rose-200/80 uppercase tracking-wide mb-1.5">
              Qué no tocar / evitar
            </label>
            <textarea
              value={avoidText}
              onChange={(e) => setAvoidText(e.target.value)}
              rows={3}
              className={cn(
                "w-full rounded-lg border border-white/12 bg-[#060912] px-3 py-2 text-sm text-white",
                "placeholder:text-white/25 focus:border-[#ffeb66]/40 focus:outline-none focus:ring-1 focus:ring-[#ffeb66]/25"
              )}
              placeholder="Equipos en mantenimiento, cambios recientes frágiles…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
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
