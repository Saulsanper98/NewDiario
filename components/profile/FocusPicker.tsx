"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface FocusPickerProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  /**
   * "avatar" → previsualización circular pequeña;
   * "banner" → previsualización rectangular ancha.
   */
  variant: "avatar" | "banner";
  initialFocusX?: number | null;
  initialFocusY?: number | null;
  /** Persiste el foco en la API. Recibe valores 0–100. */
  onSave: (focusX: number, focusY: number) => Promise<void> | void;
  title?: string;
}

/**
 * Modal de "modo enfoque":
 *
 * Muestra la imagen COMPLETA (sin recortar) y permite al usuario marcar
 * sobre ella qué punto debe quedar como centro focal cuando la imagen se
 * muestre recortada (object-cover) en su marco real. Una previsualización
 * en vivo al lado enseña cómo quedará el recorte final.
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
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);
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
    const el = imgRef.current;
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

  const defaultTitle =
    variant === "avatar"
      ? "Ajustar centro focal del avatar"
      : "Ajustar centro focal del fondo";

  // Aspect ratio para la zona de selección: usa el de la imagen original
  // (fallback 16/9). Garantiza que el click coincida píxel-a-píxel con la
  // imagen y permite ver toda la foto.
  const pickerAspect = naturalRatio ?? 16 / 9;
  const objectPosition = `${focusX}% ${focusY}%`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-6 overflow-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0d1427] p-5 shadow-2xl"
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
          Marca sobre la foto el punto que quieres que quede centrado cuando se
          recorte. La previsualización de la derecha muestra cómo se verá.
        </p>

        <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-start">
          {/* Zona de selección — imagen entera con su aspect ratio real */}
          <div
            ref={imgRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative w-full overflow-hidden rounded-xl border border-white/15 bg-black/40 select-none touch-none cursor-crosshair"
            style={{ aspectRatio: pickerAspect, maxHeight: "60vh" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setNaturalRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
              decoding="async"
            />
            {/* Cruceta del centro focal */}
            <span
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: `${focusX}%`,
                top: `${focusY}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span className="block h-6 w-6 rounded-full border-2 border-white/95 bg-[#ffeb66]/40 shadow-[0_0_0_4px_rgba(0,0,0,0.45)]" />
            </span>
            {/* Líneas guía */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-white/30"
              style={{ left: `${focusX}%` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-px bg-white/30"
              style={{ top: `${focusY}%` }}
            />
          </div>

          {/* Previsualización — cómo se verá ya recortado */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              Previsualización
            </p>
            <div
              className={cn(
                "relative overflow-hidden border border-white/20 bg-black/40",
                variant === "avatar"
                  ? "h-32 w-32 rounded-full"
                  : "h-24 w-full rounded-xl"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition }}
              />
            </div>
            {variant === "banner" && (
              <div className="relative h-12 w-full overflow-hidden rounded-md border border-white/10 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                  style={{ objectPosition }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e]/70 via-[#0a0f1e]/30 to-[#0a0f1e]/70" />
                <span className="absolute inset-0 flex items-center justify-start px-2 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  Vista fila usuarios
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-[11px] text-white/45">
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
