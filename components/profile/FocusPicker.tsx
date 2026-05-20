"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface FocusPickerProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  /** "avatar" → marco circular pequeño; "banner" → marco rectangular ancho. */
  variant: "avatar" | "banner";
  initialFocusX?: number | null;
  initialFocusY?: number | null;
  /** Persiste el foco en la API. Recibe valores 0–100. */
  onSave: (focusX: number, focusY: number) => Promise<void> | void;
  title?: string;
}

/**
 * Modal de "modo enfoque": muestra la imagen tal y como se mostrará en el marco final
 * (avatar circular o banner rectangular) y permite al usuario arrastrar la imagen para
 * elegir qué parte queda dentro del marco. Internamente lo que cambia es `object-position`.
 */
export function FocusPicker({
  open,
  onClose,
  imageUrl,
  variant,
  initialFocusX,
  initialFocusY,
  onSave,
  title,
}: FocusPickerProps) {
  const [focusX, setFocusX] = useState<number>(initialFocusX ?? 50);
  const [focusY, setFocusY] = useState<number>(initialFocusY ?? 50);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setFocusX(initialFocusX ?? 50);
    setFocusY(initialFocusY ?? 50);
  }, [open, initialFocusX, initialFocusY]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function updateFromPointer(clientX: number, clientY: number) {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setFocusX(Math.max(0, Math.min(100, x)));
    setFocusY(Math.max(0, Math.min(100, y)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromPointer(e.clientX, e.clientY);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(
        Math.round(focusX * 10) / 10,
        Math.round(focusY * 10) / 10
      );
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el enfoque"
      );
    } finally {
      setSaving(false);
    }
  }

  function resetCenter() {
    setFocusX(50);
    setFocusY(50);
  }

  const frameClass =
    variant === "avatar"
      ? "h-64 w-64 rounded-full"
      : "h-40 w-full rounded-xl";

  const defaultTitle =
    variant === "avatar" ? "Ajustar enfoque del avatar" : "Ajustar enfoque del fondo";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1427] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/85">
            {title ?? defaultTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white/80"
          >
            Cerrar
          </button>
        </div>

        <p className="mb-3 text-[11px] text-white/45">
          Arrastra dentro del marco para mover el punto de la imagen que quieres que se vea.
        </p>

        <div className="flex flex-col items-center gap-3">
          <div
            ref={frameRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={cn(
              "relative overflow-hidden border border-white/15 bg-black/30 select-none touch-none cursor-grab active:cursor-grabbing",
              frameClass
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: `${focusX}% ${focusY}%` }}
            />
            {/* Cruceta del punto de foco */}
            <span
              aria-hidden
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-white/10 shadow-[0_0_0_3px_rgba(0,0,0,0.45)]"
              style={{ left: `${focusX}%`, top: `${focusY}%` }}
            />
          </div>

          <div className="flex items-center gap-4 text-[11px] text-white/45">
            <span>X: {focusX.toFixed(0)}%</span>
            <span>Y: {focusY.toFixed(0)}%</span>
            <button
              type="button"
              onClick={resetCenter}
              className="text-[#ffeb66]/80 hover:text-[#ffeb66]"
            >
              Centrar
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/12 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#ffeb66]/90 px-3 py-1.5 text-xs font-semibold text-[#0d1427] hover:bg-[#ffeb66] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar enfoque"}
          </button>
        </div>
      </div>
    </div>
  );
}
