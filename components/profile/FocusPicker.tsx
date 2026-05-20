"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

/**
 * Modal de "modo enfoque" con zoom y panning.
 *
 * - Muestra la imagen completa (sin recortar) y escala según el zoom.
 * - El usuario pincha (o arrastra) sobre la imagen para fijar el centro focal.
 * - La imagen se reposiciona instantáneamente para que el punto focal
 *   actual quede siempre en el centro de la zona de selección.
 * - El zoom (rueda, slider, botones) amplía la imagen alrededor del foco.
 * - Una vista previa a la derecha muestra el recorte final.
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
  const [zoom, setZoom] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);
  // Estado del arrastre. Guardamos foco y posicion iniciales del raton para
  // que el delta sea siempre relativo al inicio (sin acumular).
  const dragRef = useRef<{
    startFocusX: number;
    startFocusY: number;
    startPx: number;
    startPy: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFocusX(initialFocusX ?? 50);
    setFocusY(initialFocusY ?? 50);
    setZoom(1);
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

  const clamp = (v: number, min = 0, max = 100) =>
    Math.max(min, Math.min(max, v));

  function pointerToPercent(clientX: number, clientY: number) {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * 100;
    const py = ((clientY - rect.top) / rect.height) * 100;
    return { px, py };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const c = pointerToPercent(e.clientX, e.clientY);
    if (!c) return;
    dragRef.current = {
      startFocusX: focusX,
      startFocusY: focusY,
      startPx: c.px,
      startPy: c.py,
      moved: false,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const c = pointerToPercent(e.clientX, e.clientY);
    if (!c) return;
    const dx = c.px - dragRef.current.startPx;
    const dy = c.py - dragRef.current.startPy;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      dragRef.current.moved = true;
    }
    // Drag: el foco se desplaza desde el foco inicial siguiendo al raton.
    // Cuanto mayor el zoom, menor el desplazamiento real del foco (mas precision).
    setFocusX(clamp(dragRef.current.startFocusX + dx / zoom));
    setFocusY(clamp(dragRef.current.startFocusY + dy / zoom));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current && !dragRef.current.moved) {
      // Click sin drag: el punto clicado se convierte en el nuevo foco.
      const nx = clamp(
        dragRef.current.startFocusX +
          (dragRef.current.startPx - 50) / zoom
      );
      const ny = clamp(
        dragRef.current.startFocusY +
          (dragRef.current.startPy - 50) / zoom
      );
      setFocusX(nx);
      setFocusY(ny);
    }
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
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
    setZoom(1);
  }

  const defaultTitle =
    variant === "avatar"
      ? "Ajustar centro focal del avatar"
      : "Ajustar centro focal del fondo";

  const pickerAspect = naturalRatio ?? 16 / 9;
  const objectPosition = `${focusX}% ${focusY}%`;

  // Transformacion de la imagen: la escalamos por `zoom` desde la esquina
  // superior izquierda y luego la trasladamos para que el punto focal
  // (focusX%, focusY%) de la imagen original quede en el centro de la vista.
  const tx = 50 - focusX * zoom;
  const ty = 50 - focusY * zoom;

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
          Pulsa o arrastra sobre la foto para elegir el centro focal. Usa la
          rueda del ratón, el slider o los botones +/− para acercarte.
        </p>

        <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-start">
          {/* Zona de selección — imagen completa */}
          <div className="space-y-2">
            <div
              ref={imgRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
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
                style={{
                  transform: `translate(${tx}%, ${ty}%) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
                decoding="async"
              />
              {/* Cruceta del centro focal (siempre en el centro de la vista) */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <span className="block h-6 w-6 rounded-full border-2 border-white/95 bg-[#ffeb66]/40 shadow-[0_0_0_4px_rgba(0,0,0,0.45)]" />
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/25"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-white/25"
              />
              <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
                {zoom.toFixed(2)}x
              </span>
            </div>

            {/* Controles de zoom */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
                }
                disabled={zoom <= MIN_ZOOM}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40"
                title="Reducir zoom"
                aria-label="Reducir zoom"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[#ffeb66]"
                aria-label="Zoom"
              />
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
                }
                disabled={zoom >= MAX_ZOOM}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40"
                title="Ampliar zoom"
                aria-label="Ampliar zoom"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
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
